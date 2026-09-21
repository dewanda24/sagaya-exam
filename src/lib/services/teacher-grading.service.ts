import { queryPostgres, withTransaction } from '../core/postgres';
import { AuditService } from './audit.service';
import { TeacherAuthorizationService } from './teacher-authorization.service';
import { EssayHandler } from '../core/question-types';
import { ScoringService } from './scoring.service';
import { ExamResultService } from './exam-result.service';

export interface GradeEssayInput {
  manualScore: number;
  rubricScores?: Record<string, number>;
  feedback?: string;              // Terlihat oleh siswa
  teacherInternalNote?: string;   // Catatan internal guru (rahasia/tersembunyi)
  clientVersion?: number;         // Optimistic Concurrency Control
}

export class TeacherGradingService {
  /**
   * Mengambil daftar lembar jawaban essay yang belum dikoreksi atau sedang dalam proses.
   */
  static async listPendingEssays(
    schoolId: string,
    teacherId: string,
    filters?: { examId?: string; classId?: string; limit?: number; offset?: number },
    actorRole?: string
  ) {
    let countSql = `
      SELECT COUNT(*) as total
      FROM student_answers sa
      JOIN exam_sessions es ON sa.session_id = es.id
      JOIN exam_participants ep ON es.participant_id = ep.id
      JOIN exams e ON ep.exam_id = e.id
      JOIN question_banks qb ON sa.question_id = qb.id::text
      JOIN students st ON ep.student_id = st.id
      WHERE e.school_id = $1 AND qb.type = 'ESSAY'
    `;

    let sql = `
      SELECT sa.id as answer_id, sa.answer_value_json, sa.auto_score, sa.manual_score,
             sa.feedback, sa.teacher_internal_note, sa.rubric_scores_json, sa.updated_at,
             sa.version,
             qb.id as question_id, qb.topic, qb.question_text, qb.weight as max_score,
             qb.rubric_json, qb.explanation,
             e.id as exam_id, e.title as exam_title,
             st.id as student_id, st.nis, st.nisn, st.full_name as student_name,
             c.name as class_name
      FROM student_answers sa
      JOIN exam_sessions es ON sa.session_id = es.id
      JOIN exam_participants ep ON es.participant_id = ep.id
      JOIN exams e ON ep.exam_id = e.id
      JOIN question_banks qb ON sa.question_id = qb.id::text
      JOIN students st ON ep.student_id = st.id
      LEFT JOIN class_rooms c ON st.class_room_id = c.id
      WHERE e.school_id = $1 AND qb.type = 'ESSAY'
    `;
    const params: any[] = [schoolId];

    // Otorisasi lingkup guru
    if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
      sql += ` AND (e.created_by = $${params.length + 1} OR e.subject_id IN (
        SELECT subject_id FROM teacher_subjects WHERE school_id = $1 AND teacher_id = $${params.length + 1}
      ))`;
      countSql += ` AND (e.created_by = $${params.length + 1} OR e.subject_id IN (
        SELECT subject_id FROM teacher_subjects WHERE school_id = $1 AND teacher_id = $${params.length + 1}
      ))`;
      params.push(teacherId);
    }

    if (filters?.examId) {
      params.push(filters.examId);
      sql += ` AND e.id = $${params.length}`;
      countSql += ` AND e.id = $${params.length}`;
    }

    if (filters?.classId) {
      params.push(filters.classId);
      sql += ` AND st.class_room_id = $${params.length}`;
      countSql += ` AND st.class_room_id = $${params.length}`;
    }

    sql += ` ORDER BY (sa.manual_score IS NULL) DESC, sa.updated_at DESC`;

    if (filters?.limit) {
      params.push(filters.limit);
      sql += ` LIMIT $${params.length}`;
    }

    if (filters?.offset) {
      params.push(filters.offset);
      sql += ` OFFSET $${params.length}`;
    }

    const [countRes, dataRes] = await Promise.all([
      queryPostgres(countSql, params.slice(0, filters?.limit ? -2 : params.length)),
      queryPostgres(sql, params),
    ]);

    return {
      items: dataRes.rows.map((r) => ({
        answerId: r.answer_id,
        examId: r.exam_id,
        examTitle: r.exam_title,
        studentId: r.student_id,
        studentName: r.student_name,
        nis: r.nis,
        className: r.class_name,
        questionId: r.question_id,
        topic: r.topic,
        questionText: r.question_text,
        studentAnswer: typeof r.answer_value_json === 'string' ? r.answer_value_json : JSON.stringify(r.answer_value_json),
        maxScore: parseFloat(r.max_score || '10.0'),
        manualScore: r.manual_score !== null ? parseFloat(r.manual_score) : null,
        rubric: r.rubric_json?.rubric || r.rubric_json,
        rubricScores: r.rubric_scores_json || {},
        feedback: r.feedback,
        teacherInternalNote: r.teacher_internal_note,
        isGraded: r.manual_score !== null,
        version: r.version || 1,
        updatedAt: r.updated_at,
      })),
      total: parseInt(countRes.rows[0]?.total || '0', 10),
    };
  }

  /**
   * Melakukan penilaian essay siswa dengan validasi batas skor, rubrik granular,
   * optimistic locking (anti double-grading overwrite), dan audit log immutable.
   */
  static async gradeEssay(
    schoolId: string,
    graderId: string,
    answerId: string,
    data: GradeEssayInput,
    actor: { id: string; username: string; role: string }
  ) {
    // 1. Ambil data jawaban dan bobot maksimal
    const ansRes = await queryPostgres(
      `SELECT sa.*, qb.weight as max_score, qb.rubric_json, ep.id as participant_id, ep.exam_id,
              e.school_id, er.id as result_id
       FROM student_answers sa
       JOIN question_banks qb ON sa.question_id = qb.id::text
       JOIN exam_sessions es ON sa.session_id = es.id
       JOIN exam_participants ep ON es.participant_id = ep.id
       JOIN exams e ON ep.exam_id = e.id
       LEFT JOIN exam_results er ON es.id = er.session_id
       WHERE sa.id = $1 AND e.school_id = $2
       LIMIT 1;`,
      [answerId, schoolId]
    );

    if (ansRes.rows.length === 0) {
      throw new Error('Lembar jawaban tidak ditemukan.');
    }

    const ans = ansRes.rows[0];
    const maxScore = parseFloat(ans.max_score || '10.0');

    // 2. Optimistic Concurrency Control (Conflict Detection)
    const currentVersion = Number(ans.version || 1);
    if (data.clientVersion !== undefined && data.clientVersion !== currentVersion) {
      const conflictError: any = new Error(
        `REVIEW_CONFLICT: Jawaban essay ini telah diperbarui oleh korektor lain (versi klien ${data.clientVersion} != versi server ${currentVersion}). Muat ulang data terbaru sebelum menyimpan.`
      );
      conflictError.code = 'REVIEW_CONFLICT';
      conflictError.status = 409;
      throw conflictError;
    }

    // 3. Otorisasi hak grading
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      const canGrade = await TeacherAuthorizationService.canGradeEssay(
        { id: graderId, schoolId, role: 'GURU' } as any,
        answerId,
        schoolId
      );
      if (!canGrade) {
        throw new Error('Akses ditolak: Anda tidak memiliki wewenang untuk menilai jawaban essay ini.');
      }
    }

    // 4. Validasi batas nilai (0 <= manualScore <= maxScore) & rubrik
    const essayHandler = new EssayHandler();
    const scoreVal = essayHandler.validateManualScore(data.manualScore, maxScore, data.rubricScores);
    if (!scoreVal.valid) {
      throw new Error(`Validasi penilaian gagal: ${scoreVal.error}`);
    }

    const oldScore = ans.manual_score !== null ? parseFloat(ans.manual_score) : null;
    const newScore = ScoringService.roundScore(data.manualScore);

    return await withTransaction(async (client) => {
      const nextVersion = currentVersion + 1;

      // Update student_answers
      const updRes = await client.query(
        `UPDATE student_answers SET
          manual_score = $1,
          rubric_scores_json = $2,
          feedback = $3,
          teacher_internal_note = $4,
          graded_by = $5,
          graded_at = NOW(),
          version = $6,
          updated_at = NOW()
         WHERE id = $7
         RETURNING *;`,
        [
          newScore,
          JSON.stringify(data.rubricScores || {}),
          data.feedback?.trim() || null,
          data.teacherInternalNote?.trim() || null,
          graderId,
          nextVersion,
          answerId,
        ]
      );

      // Sinkronisasi ke exam_question_results jika tabel result tersedia
      let questionResultId: string | null = null;
      if (ans.result_id) {
        const qRes = await client.query(
          `INSERT INTO exam_question_results (
             id, result_id, question_id, question_version_id, answer,
             score, max_score, score_status, grader_id, graded_at,
             rubric_scores_json, feedback, teacher_internal_note, version,
             created_at, updated_at
           ) VALUES (
             uuid_generate_v4(), $1, $2, $2, $3,
             $4, $5, 'MANUALLY_GRADED', $6, NOW(),
             $7, $8, $9, $10,
             NOW(), NOW()
           )
           ON CONFLICT (result_id, question_id) DO UPDATE SET
             score = EXCLUDED.score,
             score_status = 'MANUALLY_GRADED',
             grader_id = EXCLUDED.grader_id,
             graded_at = NOW(),
             rubric_scores_json = EXCLUDED.rubric_scores_json,
             feedback = EXCLUDED.feedback,
             teacher_internal_note = EXCLUDED.teacher_internal_note,
             version = exam_question_results.version + 1,
             updated_at = NOW()
           RETURNING id;`,
          [
            ans.result_id,
            ans.question_id,
            JSON.stringify(ans.answer_value_json ?? null),
            newScore,
            maxScore,
            graderId,
            JSON.stringify(data.rubricScores || {}),
            data.feedback?.trim() || null,
            data.teacherInternalNote?.trim() || null,
            nextVersion,
          ]
        );
        questionResultId = qRes.rows[0]?.id || null;

        // Catat ke essay_gradings untuk riwayat double grading
        if (questionResultId) {
          await client.query(
            `INSERT INTO essay_gradings (
               id, question_result_id, grader_id, rubric_scores_json,
               total_score, max_score, feedback, internal_note, version, created_at
             ) VALUES (
               uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()
             );`,
            [
              questionResultId,
              graderId,
              JSON.stringify(data.rubricScores || {}),
              newScore,
              maxScore,
              data.feedback?.trim() || null,
              data.teacherInternalNote?.trim() || null,
              nextVersion,
            ]
          );
        }
      }

      // Hitung ulang akumulasi nilai peserta
      const scoreSumRes = await client.query(
        `SELECT 
          SUM(COALESCE(manual_score, auto_score, 0)) as total_acquired,
          COUNT(*) FILTER (WHERE manual_score IS NULL AND qb.type = 'ESSAY') as remaining_essays
         FROM student_answers sa
         JOIN question_banks qb ON sa.question_id = qb.id::text
         WHERE sa.session_id = $1;`,
        [ans.session_id]
      );

      const totalAcquired = ScoringService.roundScore(parseFloat(scoreSumRes.rows[0]?.total_acquired || '0'));
      const remainingEssays = parseInt(scoreSumRes.rows[0]?.remaining_essays || '0', 10);
      const gradedStatus = remainingEssays === 0 ? 'GRADED' : 'PARTIAL';

      // Update exam_participants
      await client.query(
        `UPDATE exam_participants SET
          final_score = $1,
          graded_status = $2
         WHERE id = $3;`,
        [totalAcquired, gradedStatus, ans.participant_id]
      );

      // Update exam_results jika ada
      if (ans.result_id) {
        const resultStatus = remainingEssays === 0 ? 'GRADED' : 'PARTIALLY_GRADED';
        await client.query(
          `UPDATE exam_results SET
             final_score = $1,
             normalized_score = $1,
             percentage = $1,
             status = CASE WHEN status IN ('REVIEWED', 'PUBLISHED', 'VOID') THEN status ELSE $2 END,
             graded_at = NOW(),
             updated_at = NOW()
           WHERE id = $3;`,
          [totalAcquired, resultStatus, ans.result_id]
        );
      }

      // Audit Log
      await AuditService.createLog({
        action: oldScore === null ? 'ESSAY_GRADED' : 'ESSAY_SCORE_UPDATED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'STUDENT_ANSWER',
        resourceId: answerId,
        details: {
          examId: ans.exam_id,
          questionId: ans.question_id,
          oldScore,
          newScore,
          maxScore,
          version: nextVersion,
          gradedStatus,
        },
      });

      return {
        answer: updRes.rows[0],
        finalScore: totalAcquired,
        gradedStatus,
        version: nextVersion,
      };
    });
  }

  /**
   * Mengambil hasil ujian peserta dalam lingkup kelas guru.
   */
  static async getExamResults(
    schoolId: string,
    teacherId: string,
    examId: string,
    filters?: { classId?: string; search?: string; limit?: number; offset?: number },
    actorRole?: string
  ) {
    if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
      const allowed = await TeacherAuthorizationService.canReadResult(
        { id: teacherId, schoolId, role: 'GURU' } as any,
        examId,
        schoolId
      );
      if (!allowed) {
        throw new Error('Akses ditolak: Anda tidak memiliki akses ke hasil ujian ini.');
      }
    }

    return await ExamResultService.getExamResults(schoolId, examId, {
      classId: filters?.classId,
      search: filters?.search,
    });
  }
}
