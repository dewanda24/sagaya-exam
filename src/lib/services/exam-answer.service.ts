import { StudentAuthContext } from '../core/auth';
import { queryPostgres, withTransaction } from '../core/postgres';
import { sanitizeHtml } from './question-delivery.service';

export interface SaveAnswerParams {
  questionId: string;
  answer?: any;
  clientVersion?: number;
  isDoubtful?: boolean;
  clear?: boolean;
}

export interface AnswerValidationResult {
  valid: boolean;
  error?: string;
  sanitizedValue?: any;
}

export class ExamAnswerService {
  /**
   * Memvalidasi format dan payload jawaban siswa sesuai tipe soal.
   */
  static validateAnswerPayload(type: string, answer: any, questionConfig: any): AnswerValidationResult {
    if (answer === null || answer === undefined || answer === '') {
      return { valid: true, sanitizedValue: null };
    }

    switch (type) {
      case 'PILIHAN_GANDA': {
        if (typeof answer !== 'string') {
          return { valid: false, error: 'Pilihan ganda harus berupa identifier opsi string.' };
        }
        const options: any[] = questionConfig.options || questionConfig.options_json || [];
        const validIds = options.map((opt) => (typeof opt === 'object' ? opt.id : String(opt)));
        if (validIds.length > 0 && !validIds.includes(answer)) {
          return { valid: false, error: 'Opsi jawaban yang dipilih tidak valid untuk soal ini.' };
        }
        return { valid: true, sanitizedValue: answer };
      }

      case 'PG_KOMPLEKS': {
        if (!Array.isArray(answer)) {
          return { valid: false, error: 'Pilihan ganda kompleks harus berupa array pilihan.' };
        }
        const options: any[] = questionConfig.options || questionConfig.options_json || [];
        const validIds = options.map((opt) => (typeof opt === 'object' ? opt.id : String(opt)));
        for (const item of answer) {
          if (validIds.length > 0 && !validIds.includes(item)) {
            return { valid: false, error: `Opsi '${item}' tidak valid untuk soal ini.` };
          }
        }
        return { valid: true, sanitizedValue: answer };
      }

      case 'BENAR_SALAH': {
        if (typeof answer === 'boolean') {
          return { valid: true, sanitizedValue: answer ? 'opt_true' : 'opt_false' };
        }
        if (answer === 'opt_true' || answer === 'opt_false' || answer === 'TRUE' || answer === 'FALSE') {
          return { valid: true, sanitizedValue: answer };
        }
        return { valid: false, error: 'Jawaban Benar/Salah harus berupa opsi Benar atau Salah.' };
      }

      case 'MENJODOHKAN': {
        if (typeof answer !== 'object' || Array.isArray(answer) || answer === null) {
          return { valid: false, error: 'Jawaban penjodohan harus berupa objek pemetaan pasangan.' };
        }
        // Validasi struktur key-value
        const sanitized: Record<string, string> = {};
        for (const [k, v] of Object.entries(answer)) {
          sanitized[String(k).slice(0, 50)] = String(v).slice(0, 50);
        }
        return { valid: true, sanitizedValue: sanitized };
      }

      case 'ISIAN_SINGKAT': {
        if (typeof answer !== 'string') {
          return { valid: false, error: 'Isian singkat harus berupa teks.' };
        }
        if (answer.length > 500) {
          return { valid: false, error: 'Panjang isian singkat melebihi batas maksimum 500 karakter.' };
        }
        return { valid: true, sanitizedValue: sanitizeHtml(answer.trim()) };
      }

      case 'ESSAY': {
        if (typeof answer !== 'string') {
          return { valid: false, error: 'Jawaban essay harus berupa teks.' };
        }
        if (answer.length > 10000) {
          return { valid: false, error: 'Panjang essay melebihi batas maksimum 10.000 karakter.' };
        }
        return { valid: true, sanitizedValue: sanitizeHtml(answer) };
      }

      default:
        return { valid: true, sanitizedValue: answer };
    }
  }

  /**
   * Menyimpan atau memperbarui jawaban siswa dengan perlindungan konkurensi optimistik
   * dan submit locking.
   */
  static async saveAnswer(authContext: StudentAuthContext, params: SaveAnswerParams) {
    const { sessionId } = authContext;
    const { questionId, answer, clientVersion = 1, isDoubtful, clear = false } = params;

    if (!questionId) {
      return { success: false, error: 'ID Soal wajib disertakan.', status: 400 };
    }

    // 1. Submit Lock: Tolak jika status sesi adalah SUBMITTED, TIMEOUT, atau TERMINATED
    if (authContext.isExpired || authContext.status === 'SUBMITTED' || authContext.status === 'TIMEOUT') {
      return {
        success: false,
        error: 'Ujian telah selesai atau waktu pengerjaan telah habis. Jawaban dikunci.',
        status: 403,
      };
    }

    return await withTransaction(async (client) => {
      // 2. Validasi IDOR & Kepemilikan Soal melalui question_order_maps
      const qCheckRes = await client.query(
        `SELECT qm.*, sq.configuration_json, sq.question_version_id
         FROM question_order_maps qm
         JOIN exam_snapshot_questions sq ON qm.snapshot_question_id = sq.id
         WHERE qm.session_id = $1 AND qm.question_id = $2
         LIMIT 1;`,
        [sessionId, questionId]
      );

      if (qCheckRes.rows.length === 0) {
        return {
          success: false,
          error: 'ID Soal tidak valid atau tidak terdaftar dalam sesi ujian ini (Cross-exam violation).',
          status: 400,
        };
      }

      const qRecord = qCheckRes.rows[0];
      const qConfig = qRecord.configuration_json || {};
      const qType = qConfig.type || 'PILIHAN_GANDA';

      // 3. Periksa Rekaman Jawaban Sebelumnya untuk Optimistic Concurrency Control
      const prevAnsRes = await client.query(
        `SELECT * FROM student_answers WHERE session_id = $1 AND question_id = $2 LIMIT 1;`,
        [sessionId, questionId]
      );

      const prevAnswer = prevAnsRes.rows[0];
      if (prevAnswer && clientVersion && clientVersion < prevAnswer.version) {
        // Versi client usang (stale request dari network buffer lama)
        return {
          success: false,
          error: 'Versi jawaban client sudah usang (Stale update rejected).',
          code: 'CONCURRENCY_CONFLICT',
          serverVersion: prevAnswer.version,
          status: 409,
        };
      }

      // 4. Proses Clear Answer atau Simpan Jawaban
      let finalState: 'UNANSWERED' | 'ANSWERED' | 'CLEARED' = 'UNANSWERED';
      let finalValue: any = null;
      let finalIsDoubtful = isDoubtful !== undefined ? Boolean(isDoubtful) : Boolean(prevAnswer?.marked_for_review ?? prevAnswer?.is_doubtful);

      if (clear) {
        finalState = 'CLEARED';
        finalValue = null;
      } else {
        const valRes = this.validateAnswerPayload(qType, answer, qConfig);
        if (!valRes.valid) {
          return { success: false, error: valRes.error, status: 400 };
        }
        finalValue = valRes.sanitizedValue;
        finalState = finalValue !== null && finalValue !== undefined && finalValue !== '' ? 'ANSWERED' : 'UNANSWERED';
      }

      // 5. Upsert ke student_answers
      const upsertRes = await client.query(
        `INSERT INTO student_answers (
           id, session_id, question_id, question_version_id, answer_value_json,
           is_doubtful, marked_for_review, state, version, updated_at, saved_at
         ) VALUES (
           uuid_generate_v4(), $1, $2, $3, $4, $5, $5, $6, $7, NOW(), NOW()
         )
         ON CONFLICT (session_id, question_id) DO UPDATE
         SET answer_value_json = EXCLUDED.answer_value_json,
             is_doubtful = EXCLUDED.is_doubtful,
             marked_for_review = EXCLUDED.marked_for_review,
             state = EXCLUDED.state,
             version = student_answers.version + 1,
             updated_at = NOW(),
             saved_at = NOW()
         RETURNING question_id, state, is_doubtful, marked_for_review, version, updated_at;`,
        [
          sessionId,
          questionId,
          qRecord.question_version_id || questionId,
          finalValue !== null ? JSON.stringify(finalValue) : null,
          finalIsDoubtful,
          finalState,
          (prevAnswer?.version || 0) + 1,
        ]
      );

      const saved = upsertRes.rows[0];

      return {
        success: true,
        data: {
          questionId: saved.question_id,
          state: saved.state,
          isDoubtful: saved.marked_for_review ?? saved.is_doubtful,
          version: saved.version,
          savedAt: saved.updated_at,
        },
      };
    });
  }

  /**
   * Toggle status Mark for Review (Ragu-ragu) tanpa merusak nilai jawaban yang sudah tersimpan.
   */
  static async toggleMarkForReview(authContext: StudentAuthContext, questionId: string, isDoubtful: boolean) {
    const { sessionId } = authContext;

    if (authContext.isExpired || authContext.status === 'SUBMITTED' || authContext.status === 'TIMEOUT') {
      return { success: false, error: 'Ujian sudah berakhir. Status tidak dapat diubah.', status: 403 };
    }

    const res = await queryPostgres(
      `INSERT INTO student_answers (
         id, session_id, question_id, is_doubtful, marked_for_review, state, version, updated_at, saved_at
       ) VALUES (
         uuid_generate_v4(), $1, $2, $3, $3, 'UNANSWERED', 1, NOW(), NOW()
       )
       ON CONFLICT (session_id, question_id) DO UPDATE
       SET is_doubtful = EXCLUDED.is_doubtful,
           marked_for_review = EXCLUDED.marked_for_review,
           updated_at = NOW()
       RETURNING question_id, marked_for_review, version, updated_at;`,
      [sessionId, questionId, !!isDoubtful]
    );

    const row = res.rows[0];
    return {
      success: true,
      data: {
        questionId: row.question_id,
        isDoubtful: row.marked_for_review,
        version: row.version,
        updatedAt: row.updated_at,
      },
    };
  }

  /**
   * Mengambil ringkasan review jawaban untuk modal konfirmasi submit.
   */
  static async getAnswerReviewSummary(authContext: StudentAuthContext) {
    const { sessionId } = authContext;

    // Hitung total butir soal
    const totalQRes = await queryPostgres(
      `SELECT COUNT(*) as total FROM question_order_maps WHERE session_id = $1;`,
      [sessionId]
    );
    const totalQuestions = Number(totalQRes.rows[0]?.total || 0);

    // Hitung status jawaban
    const ansSummaryRes = await queryPostgres(
      `SELECT 
         COUNT(*) FILTER (WHERE state = 'ANSWERED' AND answer_value_json IS NOT NULL) as answered_count,
         COUNT(*) FILTER (WHERE marked_for_review = TRUE OR is_doubtful = TRUE) as marked_count
       FROM student_answers
       WHERE session_id = $1;`,
      [sessionId]
    );

    const answeredCount = Number(ansSummaryRes.rows[0]?.answered_count || 0);
    const markedCount = Number(ansSummaryRes.rows[0]?.marked_count || 0);
    const unansweredCount = Math.max(0, totalQuestions - answeredCount);

    return {
      totalQuestions,
      answeredCount,
      unansweredCount,
      markedCount,
      remainingSeconds: authContext.remainingSeconds,
      canSubmit: true,
    };
  }
}
