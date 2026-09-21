import { queryPostgres, withTransaction } from '../core/postgres';
import { AuditService } from './audit.service';
import { TeacherAuthorizationService } from './teacher-authorization.service';
import { QuestionTypeRegistry } from '../core/question-types';

export interface CreateExamInput {
  title: string;
  subjectId: string;
  targetClassIds: string[];
  academicYearId?: string;
  semesterId?: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  showScorePolicy?: 'IMMEDIATELY' | 'AFTER_ALL_DONE' | 'SCHEDULED' | 'NEVER';
  questionIds?: string[];
  passingGrade?: number;
}

export class TeacherExamService {
  /**
   * Mengambil daftar ujian yang dibuat oleh guru atau yang berada dalam lingkup mapel/kelas guru.
   */
  static async listExams(
    schoolId: string,
    teacherId: string,
    filters?: { status?: string; search?: string; limit?: number; offset?: number },
    actorRole?: string
  ) {
    let countSql = `SELECT COUNT(*) as total FROM exams e WHERE e.school_id = $1`;
    let sql = `
      SELECT e.*, s.name as subject_name, s.code as subject_code, u.full_name as creator_name,
             (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) as question_count,
             (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id) as participant_count
      FROM exams e
      JOIN subjects s ON e.subject_id = s.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.school_id = $1
    `;
    const params: any[] = [schoolId];

    // Otorisasi lingkup ujian guru
    if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
      sql += ` AND (e.created_by = $${params.length + 1} OR e.subject_id IN (
        SELECT subject_id FROM teacher_subjects WHERE school_id = $1 AND teacher_id = $${params.length + 1}
      ))`;
      countSql += ` AND (created_by = $${params.length + 1} OR subject_id IN (
        SELECT subject_id FROM teacher_subjects WHERE school_id = $1 AND teacher_id = $${params.length + 1}
      ))`;
      params.push(teacherId);
    }

    if (filters?.status) {
      params.push(filters.status);
      sql += ` AND e.status = $${params.length}`;
      countSql += ` AND status = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (e.title ILIKE $${params.length} OR s.name ILIKE $${params.length})`;
      countSql += ` AND (title ILIKE $${params.length})`;
    }

    sql += ` ORDER BY e.created_at DESC`;

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
      exams: dataRes.rows.map((r) => ({
        id: r.id,
        title: r.title,
        subjectId: r.subject_id,
        subjectName: r.subject_name,
        subjectCode: r.subject_code,
        status: r.status,
        durationMinutes: r.duration_minutes,
        startTime: r.start_time,
        endTime: r.end_time,
        targetClassIds: r.target_class_ids || [],
        questionCount: parseInt(r.question_count || '0', 10),
        participantCount: parseInt(r.participant_count || '0', 10),
        creatorName: r.creator_name,
        createdAt: r.created_at,
      })),
      total: parseInt(countRes.rows[0]?.total || '0', 10),
    };
  }

  /**
   * Mengambil detail ujian dan konfigurasi soal snapshot.
   */
  static async getExamDetail(
    schoolId: string,
    teacherId: string,
    examId: string,
    actorRole?: string
  ) {
    const eRes = await queryPostgres(
      `SELECT e.*, s.name as subject_name, s.code as subject_code, u.full_name as creator_name
       FROM exams e
       JOIN subjects s ON e.subject_id = s.id
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.id = $1 AND e.school_id = $2
       LIMIT 1;`,
      [examId, schoolId]
    );

    if (eRes.rows.length === 0) {
      throw new Error('Ujian tidak ditemukan.');
    }

    const exam = eRes.rows[0];

    // Otorisasi baca
    if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
      const allowed = await TeacherAuthorizationService.canReadResult(
        { id: teacherId, schoolId, role: 'GURU' } as any,
        examId,
        schoolId
      );
      if (!allowed) {
        throw new Error('Akses ditolak: Anda tidak memiliki akses ke ujian ini.');
      }
    }

    // Ambil daftar soal yang terhubung ke ujian ini
    const qRes = await queryPostgres(
      `SELECT eq.order_index, eq.weight, qb.id, qb.topic, qb.difficulty, qb.type,
              qb.question_text, qb.options_json, qb.answer_key_json, qb.rubric_json, qb.current_revision_number
       FROM exam_questions eq
       JOIN question_banks qb ON eq.question_id = qb.id
       WHERE eq.exam_id = $1
       ORDER BY eq.order_index ASC;`,
      [examId]
    );

    return {
      id: exam.id,
      title: exam.title,
      subjectId: exam.subject_id,
      subjectName: exam.subject_name,
      subjectCode: exam.subject_code,
      status: exam.status,
      durationMinutes: exam.duration_minutes,
      startTime: exam.start_time,
      endTime: exam.end_time,
      randomizeQuestions: exam.randomize_questions,
      randomizeOptions: exam.randomize_options,
      showScorePolicy: exam.show_score_policy,
      targetClassIds: exam.target_class_ids || [],
      passingGrade: exam.passing_grade,
      creatorName: exam.creator_name,
      createdAt: exam.created_at,
      questionSnapshotJson: exam.question_snapshot_json,
      questions: qRes.rows.map((q) => ({
        id: q.id,
        orderIndex: q.order_index,
        weight: parseFloat(q.weight || '1.0'),
        topic: q.topic,
        difficulty: q.difficulty,
        type: q.type,
        questionText: q.question_text,
        options: q.options_json,
        answerKey: q.answer_key_json,
        rubric: q.rubric_json?.rubric,
        revisionNumber: q.current_revision_number,
      })),
    };
  }

  /**
   * Membuat ujian baru oleh guru.
   * Guru hanya boleh membuat ujian untuk mata pelajaran dan kelas yang diampunya.
   */
  static async createExam(
    schoolId: string,
    teacherId: string,
    data: CreateExamInput,
    actor: { id: string; username: string; role: string }
  ) {
    // 1. Verifikasi hak buat ujian
    const auth = await TeacherAuthorizationService.canCreateExam(
      { id: teacherId, schoolId, role: 'GURU' } as any,
      data.subjectId,
      data.targetClassIds || [],
      schoolId
    );

    if (!auth.allowed) {
      throw new Error(`Akses ditolak: ${auth.reason}`);
    }

    if (!data.title || !data.title.trim()) {
      throw new Error('Judul ujian tidak boleh kosong.');
    }

    if (!data.durationMinutes || data.durationMinutes <= 0) {
      throw new Error('Durasi ujian harus lebih dari 0 menit.');
    }

    return await withTransaction(async (client) => {
      const eRes = await client.query(
        `INSERT INTO exams (
          id, school_id, title, subject_id, created_by, status, duration_minutes,
          start_time, end_time, randomize_questions, randomize_options, show_score_policy,
          target_class_ids, academic_year_id, semester_id, passing_grade, question_snapshot_json
         ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, '[]'::jsonb
         ) RETURNING *;`,
        [
          schoolId,
          data.title.trim(),
          data.subjectId,
          teacherId,
          data.durationMinutes,
          data.startTime,
          data.endTime,
          data.randomizeQuestions ?? true,
          data.randomizeOptions ?? true,
          data.showScorePolicy || 'AFTER_ALL_DONE',
          data.targetClassIds || [],
          data.academicYearId || null,
          data.semesterId || null,
          data.passingGrade || 75,
        ]
      );

      const exam = eRes.rows[0];

      // Hubungkan soal yang dipilih ke exam_questions
      if (data.questionIds && data.questionIds.length > 0) {
        for (let i = 0; i < data.questionIds.length; i++) {
          const qId = data.questionIds[i];
          await client.query(
            `INSERT INTO exam_questions (id, exam_id, question_id, revision_number, order_index, weight)
             VALUES (uuid_generate_v4(), $1, $2, 1, $3, 1.0)
             ON CONFLICT (exam_id, question_id) DO NOTHING;`,
            [exam.id, qId, i + 1]
          );
        }
      }

      await AuditService.createLog({
        action: 'EXAM_CREATED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'EXAM',
        resourceId: exam.id,
        details: { title: exam.title, durationMinutes: exam.duration_minutes },
      });

      return exam;
    });
  }

  /**
   * Publikasikan ujian dan bekukan snapshot soal secara immutable.
   */
  static async publishExam(
    schoolId: string,
    teacherId: string,
    examId: string,
    actor: { id: string; username: string; role: string }
  ) {
    const eRes = await queryPostgres(
      `SELECT * FROM exams WHERE id = $1 AND school_id = $2;`,
      [examId, schoolId]
    );

    if (eRes.rows.length === 0) {
      throw new Error('Ujian tidak ditemukan.');
    }

    const exam = eRes.rows[0];

    // Otorisasi publish
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      const canPublish = TeacherAuthorizationService.canPublishExam(
        { id: teacherId, schoolId, role: 'GURU' } as any
      );
      if (!canPublish) {
        throw new Error('Akses ditolak: Anda tidak memiliki izin mempublikasikan ujian.');
      }
    }

    return await withTransaction(async (client) => {
      // Ambil seluruh soal beserta revision_number aktif untuk snapshot beku
      const questionsRes = await client.query(
        `SELECT eq.order_index, eq.weight, qb.*
         FROM exam_questions eq
         JOIN question_banks qb ON eq.question_id = qb.id
         WHERE eq.exam_id = $1
         ORDER BY eq.order_index ASC;`,
        [examId]
      );

      if (questionsRes.rows.length === 0) {
        throw new Error('Ujian belum memiliki soal. Tambahkan minimal satu butir soal sebelum mempublikasikan.');
      }

      const snapshot = questionsRes.rows.map((q) => ({
        id: q.id,
        orderIndex: q.order_index,
        weight: parseFloat(q.weight || '1.0'),
        type: q.type,
        topic: q.topic,
        difficulty: q.difficulty,
        questionText: q.question_text,
        mediaUrl: q.media_url,
        mediaType: q.media_type,
        options: q.options_json,
        answerKey: q.answer_key_json,
        rubric: q.rubric_json?.rubric,
        explanation: q.explanation,
        revisionNumber: q.current_revision_number,
      }));

      // Update status menjadi PUBLISHED dan simpan question_snapshot_json
      await client.query(
        `UPDATE exams SET 
          status = 'PUBLISHED',
          question_snapshot_json = $1
         WHERE id = $2 AND school_id = $3;`,
        [JSON.stringify(snapshot), examId, schoolId]
      );

      // Kunci soal-soal ini menjadi LOCKED agar tidak bisa diedit diam-diam
      const qIds = questionsRes.rows.map((q) => q.id);
      await client.query(
        `UPDATE question_banks SET lifecycle_status = 'LOCKED'
         WHERE id = ANY($1::uuid[]) AND school_id = $2;`,
        [qIds, schoolId]
      );

      await AuditService.createLog({
        action: 'EXAM_PUBLISHED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'EXAM',
        resourceId: examId,
        details: { totalQuestions: snapshot.length },
      });

      return { success: true, message: 'Ujian berhasil dipublikasikan dan snapshot soal telah dibekukan secara permanen.' };
    });
  }

  /**
   * Mengambil data monitoring peserta ujian live yang aman (Zero token / password / answer key leakage).
   */
  static async getExamMonitoring(
    schoolId: string,
    teacherId: string,
    examId: string,
    actorRole?: string
  ) {
    // 1. Verifikasi hak akses
    if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
      const allowed = await TeacherAuthorizationService.canReadResult(
        { id: teacherId, schoolId, role: 'GURU' } as any,
        examId,
        schoolId
      );
      if (!allowed) {
        throw new Error('Akses ditolak: Anda tidak memiliki wewenang memonitor ujian ini.');
      }
    }

    const participantsRes = await queryPostgres(
      `SELECT ep.id as participant_id, ep.token_status, ep.assigned_package,
              st.nis, st.nisn, st.full_name, st.gender,
              c.name as class_name,
              es.status as session_status, es.server_started_at, es.submitted_at,
              es.last_heartbeat_at, es.current_question_index, es.tab_violation_count
       FROM exam_participants ep
       JOIN students st ON ep.student_id = st.id
       LEFT JOIN class_rooms c ON st.class_room_id = c.id
       LEFT JOIN exam_sessions es ON ep.id = es.participant_id
       WHERE ep.exam_id = $1
       ORDER BY c.name ASC, st.full_name ASC;`,
      [examId]
    );

    return {
      participants: participantsRes.rows.map((p) => ({
        participantId: p.participant_id,
        nis: p.nis,
        nisn: p.nisn,
        fullName: p.full_name,
        gender: p.gender,
        className: p.class_name,
        assignedPackage: p.assigned_package,
        tokenStatus: p.token_status,
        sessionStatus: p.session_status || 'NOT_STARTED',
        startedAt: p.server_started_at,
        submittedAt: p.submitted_at,
        lastHeartbeatAt: p.last_heartbeat_at,
        currentQuestionIndex: p.current_question_index,
        tabViolations: p.tab_violation_count || 0,
      })),
    };
  }
}
