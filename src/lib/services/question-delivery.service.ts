import { StudentAuthContext } from '../core/auth';
import { queryPostgres } from '../core/postgres';
import { ExamRandomizationService } from './exam-randomization.service';
import { QuestionTypeRegistry } from '../core/question-types';

export interface StudentOptionDTO {
  id: string;
  displayPosition: number;
  label: string; // 'A', 'B', 'C', 'D'
  text: string;
  mediaUrl?: string | null;
}

export interface StudentQuestionDTO {
  id: string;
  number: number;
  type: string;
  questionText: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  options?: StudentOptionDTO[];
  matchingItems?: {
    leftItems: Array<{ id: string; text: string }>;
    rightItems: Array<{ id: string; text: string }>;
  };
  points: number;
  section: string;
  userAnswer?: {
    value: any;
    state: 'UNANSWERED' | 'ANSWERED' | 'CLEARED';
    isDoubtful: boolean;
    version: number;
    savedAt?: string;
  };
}

/**
 * Sanitasi HTML dasar untuk mencegah eksekusi <script> atau XSS berbahaya dalam teks soal.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
    .replace(/javascript:\s*/gi, '');
}

export class QuestionDeliveryService {
  /**
   * Serializer sentral yang secara mutlak menghapus data rahasia
   * (kunci jawaban, rubrik penilaian, catatan guru, dsb) sebelum dikirim ke siswa.
   */
  static serializeQuestionForStudent(
    questionConfig: any,
    displayPosition: number,
    optionOrderList?: Array<{ option_id: string; display_position: number }>,
    section: string = 'MAIN',
    points: number = 1.0
  ): StudentQuestionDTO {
    const rawType = questionConfig.type || 'PILIHAN_GANDA';
    const qText = sanitizeHtml(questionConfig.questionText || questionConfig.question_text || '');
    const qId = questionConfig.id;

    const dto: StudentQuestionDTO = {
      id: qId,
      number: displayPosition,
      type: rawType,
      questionText: qText,
      mediaUrl: questionConfig.mediaUrl || questionConfig.media_url || null,
      mediaType: questionConfig.mediaType || questionConfig.media_type || 'NONE',
      points: Number(points || questionConfig.weight || 1.0),
      section: section || 'MAIN',
    };

    // Format Opsi Jawaban (PILIHAN GANDA & PG KOMPLEKS)
    const rawOptions: any[] = Array.isArray(questionConfig.options)
      ? questionConfig.options
      : Array.isArray(questionConfig.options_json)
      ? questionConfig.options_json
      : [];

    if (rawOptions.length > 0) {
      // Petakan opsi dengan display order jika tersedia
      const optMap = new Map<string, number>();
      if (Array.isArray(optionOrderList) && optionOrderList.length > 0) {
        for (const o of optionOrderList) {
          optMap.set(o.option_id, o.display_position);
        }
      }

      const formattedOptions: StudentOptionDTO[] = rawOptions.map((opt, idx) => {
        const optId = typeof opt === 'object' && opt !== null ? opt.id || `opt_${idx + 1}` : `opt_${idx + 1}`;
        const optText = typeof opt === 'object' && opt !== null ? opt.text || opt.label || '' : String(opt);
        const orderPos = optMap.get(optId) ?? idx + 1;
        const label = String.fromCharCode(64 + Math.min(26, Math.max(1, orderPos))); // 'A', 'B', 'C', 'D'

        return {
          id: optId,
          displayPosition: orderPos,
          label,
          text: sanitizeHtml(optText),
          mediaUrl: typeof opt === 'object' ? opt.mediaUrl || opt.media_url || null : null,
        };
      });

      // Urutkan berdasarkan displayPosition
      formattedOptions.sort((a, b) => a.displayPosition - b.displayPosition);
      dto.options = formattedOptions;
    }

    // Format MENJODOHKAN
    if (rawType === 'MENJODOHKAN') {
      const leftItems = Array.isArray(questionConfig.leftItems)
        ? questionConfig.leftItems
        : Array.isArray(questionConfig.options)
        ? questionConfig.options.filter((i: any) => i.side === 'LEFT' || !i.side)
        : [];
      const rightItems = Array.isArray(questionConfig.rightItems)
        ? questionConfig.rightItems
        : Array.isArray(questionConfig.options)
        ? questionConfig.options.filter((i: any) => i.side === 'RIGHT')
        : [];

      dto.matchingItems = {
        leftItems: leftItems.map((item: any, idx: number) => ({
          id: item.id || `left_${idx + 1}`,
          text: sanitizeHtml(item.text || String(item)),
        })),
        rightItems: rightItems.map((item: any, idx: number) => ({
          id: item.id || `right_${idx + 1}`,
          text: sanitizeHtml(item.text || String(item)),
        })),
      };
    }

    // Format BENAR_SALAH
    if (rawType === 'BENAR_SALAH' && (!dto.options || dto.options.length === 0)) {
      dto.options = [
        { id: 'opt_true', displayPosition: 1, label: 'A', text: 'Benar' },
        { id: 'opt_false', displayPosition: 2, label: 'B', text: 'Salah' },
      ];
    }

    // DEFENSE-IN-DEPTH: Pastikan TIDAK PERNAH membocorkan field sensitif
    const forbiddenFields = [
      'answerKey',
      'answer_key',
      'answer_key_json',
      'rubric',
      'rubric_json',
      'explanation',
      'teacher_internal_note',
      'teacherInternalNote',
      'internal_note',
      'scoring_guide',
      'expectedAnswer',
      'isCorrect',
    ];

    for (const field of forbiddenFields) {
      delete (dto as any)[field];
    }

    return dto;
  }

  /**
   * Mengambil lembar soal lengkap yang aman untuk siswa dalam sesi pengerjaan saat ini.
   */
  static async getSessionQuestions(authContext: StudentAuthContext) {
    const { sessionId, examId } = authContext;

    // 1. Ambil susunan soal terurut dari Randomization Engine
    const orderedQRows = await ExamRandomizationService.getSessionQuestionOrder(sessionId);

    // 2. Ambil seluruh opsi terurut untuk sesi ini
    const optRows = await queryPostgres(
      `SELECT question_id, option_id, display_position
       FROM option_order_maps
       WHERE session_id = $1
       ORDER BY question_id, display_position ASC;`,
      [sessionId]
    );

    const optMapByQ = new Map<string, Array<{ option_id: string; display_position: number }>>();
    for (const opt of optRows.rows) {
      if (!optMapByQ.has(opt.question_id)) {
        optMapByQ.set(opt.question_id, []);
      }
      optMapByQ.get(opt.question_id)!.push({
        option_id: opt.option_id,
        display_position: opt.display_position,
      });
    }

    // 3. Ambil jawaban tersimpan siswa
    const ansRows = await queryPostgres(
      `SELECT question_id, answer_value_json, is_doubtful, marked_for_review, state, version, updated_at
       FROM student_answers
       WHERE session_id = $1;`,
      [sessionId]
    );

    const answersMap = new Map<string, any>();
    for (const ans of ansRows.rows) {
      answersMap.set(ans.question_id, {
        value: ans.answer_value_json,
        state: ans.state || (ans.answer_value_json !== null ? 'ANSWERED' : 'UNANSWERED'),
        isDoubtful: Boolean(ans.marked_for_review ?? ans.is_doubtful),
        version: Number(ans.version || 1),
        savedAt: ans.updated_at,
      });
    }

    // 4. Bangun daftar DTO soal
    const questions: StudentQuestionDTO[] = [];
    for (const qRow of orderedQRows) {
      const config = qRow.configuration_json || {};
      const qId = qRow.question_id || config.id;
      const opts = optMapByQ.get(qId);
      const studentDto = this.serializeQuestionForStudent(
        { ...config, id: qId },
        qRow.display_position,
        opts,
        qRow.section,
        qRow.points
      );

      const existingAns = answersMap.get(qId);
      if (existingAns) {
        studentDto.userAnswer = existingAns;
      }

      questions.push(studentDto);
    }

    return questions;
  }

  /**
   * Mengambil butir soal tunggal berdasarkan questionId dengan validasi kepemilikan sesi (IDOR check).
   */
  static async getQuestionById(authContext: StudentAuthContext, questionId: string) {
    const { sessionId } = authContext;

    // Pastikan questionId terdaftar dalam question_order_maps sesi ini
    const qRowRes = await queryPostgres(
      `SELECT qm.display_position, qm.question_id, qm.snapshot_question_id,
              sq.section, sq.points, sq.position as snapshot_position,
              sq.configuration_json
       FROM question_order_maps qm
       JOIN exam_snapshot_questions sq ON qm.snapshot_question_id = sq.id
       WHERE qm.session_id = $1 AND qm.question_id = $2
       LIMIT 1;`,
      [sessionId, questionId]
    );

    if (qRowRes.rows.length === 0) {
      throw new Error('Akses ditolak: Soal tidak terdaftar dalam paket ujian sesi Anda (IDOR violation).');
    }

    const qRow = qRowRes.rows[0];
    const opts = await ExamRandomizationService.getSessionOptionOrder(sessionId, questionId);

    // Ambil jawaban jika ada
    const ansRes = await queryPostgres(
      `SELECT answer_value_json, is_doubtful, marked_for_review, state, version, updated_at
       FROM student_answers
       WHERE session_id = $1 AND question_id = $2
       LIMIT 1;`,
      [sessionId, questionId]
    );

    const dto = this.serializeQuestionForStudent(
      { ...qRow.configuration_json, id: qRow.question_id },
      qRow.display_position,
      opts,
      qRow.section,
      qRow.points
    );

    if (ansRes.rows.length > 0) {
      const ans = ansRes.rows[0];
      dto.userAnswer = {
        value: ans.answer_value_json,
        state: ans.state || (ans.answer_value_json !== null ? 'ANSWERED' : 'UNANSWERED'),
        isDoubtful: Boolean(ans.marked_for_review ?? ans.is_doubtful),
        version: Number(ans.version || 1),
        savedAt: ans.updated_at,
      };
    }

    return dto;
  }
}
