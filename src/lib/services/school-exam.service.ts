import { queryPostgres, withTransaction } from '../core/postgres';
import { Exam, ExamStatus, WindowMode, ShowScorePolicy } from '../core/types';
import { AuditService } from './audit.service';

export interface ExamCreateInput {
  title: string;
  subjectId: string;
  academicYearId?: string;
  semesterId?: string;
  targetClassIds?: string[];
  windowMode?: WindowMode;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  showScorePolicy?: ShowScorePolicy;
  passingGrade?: number;
  questionIds?: string[];
}

export class SchoolExamService {
  /**
   * Mengambil daftar paket ujian di sekolah.
   */
  static async listExams(
    schoolId: string,
    filters?: {
      status?: ExamStatus;
      subjectId?: string;
      academicYearId?: string;
      search?: string;
    }
  ): Promise<Exam[]> {
    let sql = `
      SELECT e.*, 
             s.name as subject_name,
             sc.name as school_name,
             (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id) as total_participants,
             (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) as total_questions
      FROM exams e
      JOIN subjects s ON e.subject_id = s.id
      JOIN schools sc ON e.school_id = sc.id
      WHERE e.school_id = $1
    `;
    const params: any[] = [schoolId];

    if (filters?.status) {
      params.push(filters.status);
      sql += ` AND e.status = $${params.length}`;
    }

    if (filters?.subjectId) {
      params.push(filters.subjectId);
      sql += ` AND e.subject_id = $${params.length}`;
    }

    if (filters?.academicYearId) {
      params.push(filters.academicYearId);
      sql += ` AND e.academic_year_id = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND e.title ILIKE $${params.length}`;
    }

    sql += ` ORDER BY e.start_time DESC;`;

    const res = await queryPostgres(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      schoolId: r.school_id,
      schoolName: r.school_name,
      title: r.title,
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      createdById: r.created_by,
      status: r.status as ExamStatus,
      windowMode: r.window_mode as WindowMode,
      startTime: r.start_time,
      endTime: r.end_time,
      durationMinutes: r.duration_minutes,
      randomizeQuestions: r.randomize_questions,
      randomizeOptions: r.randomize_options,
      showScorePolicy: r.show_score_policy as ShowScorePolicy,
      ipRestricted: r.ip_restricted,
      allowedIpRange: r.allowed_ip_range,
      questionSnapshotJson: r.question_snapshot_json || [],
      passingGrade: r.passing_grade ? parseFloat(r.passing_grade) : undefined,
      releaseToken: r.release_token,
      tokenReleasedAt: r.token_released_at,
      tokenExpiresAt: r.token_expires_at,
      totalQuestions: parseInt(r.total_questions || '0', 10),
      totalParticipants: parseInt(r.total_participants || '0', 10),
    }));
  }

  /**
   * Mengambil detail satu paket ujian beserta daftar soal terpilih.
   */
  static async getExamById(schoolId: string, examId: string) {
    const res = await queryPostgres(
      `SELECT e.*, 
              s.name as subject_name,
              sc.name as school_name,
              (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id) as total_participants
       FROM exams e
       JOIN subjects s ON e.subject_id = s.id
       JOIN schools sc ON e.school_id = sc.id
       WHERE e.id = $1 AND e.school_id = $2
       LIMIT 1;`,
      [examId, schoolId]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    // Ambil soal yang ditugaskan ke exam
    const qRes = await queryPostgres(
      `SELECT eq.id as exam_question_id, eq.order_index, eq.weight, eq.revision_number,
              qb.*
       FROM exam_questions eq
       JOIN question_banks qb ON eq.question_id = qb.id
       WHERE eq.exam_id = $1
       ORDER BY eq.order_index ASC, eq.created_at ASC;`,
      [examId]
    );

    return {
      id: r.id,
      schoolId: r.school_id,
      schoolName: r.school_name,
      title: r.title,
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      academicYearId: r.academic_year_id,
      semesterId: r.semester_id,
      targetClassIds: r.target_class_ids || [],
      status: r.status,
      windowMode: r.window_mode,
      startTime: r.start_time,
      endTime: r.end_time,
      durationMinutes: r.duration_minutes,
      randomizeQuestions: r.randomize_questions,
      randomizeOptions: r.randomize_options,
      showScorePolicy: r.show_score_policy,
      ipRestricted: r.ip_restricted,
      allowedIpRange: r.allowed_ip_range,
      questionSnapshotJson: r.question_snapshot_json || [],
      passingGrade: r.passing_grade ? parseFloat(r.passing_grade) : undefined,
      releaseToken: r.release_token,
      totalParticipants: parseInt(r.total_participants || '0', 10),
      assignedQuestions: qRes.rows.map((q: any) => ({
        examQuestionId: q.exam_question_id,
        questionId: q.id,
        orderIndex: q.order_index,
        weight: parseFloat(q.weight || '1.0'),
        topic: q.topic,
        type: q.type,
        difficulty: q.difficulty,
        questionText: q.question_text,
        mediaUrl: q.media_url,
        options: q.options_json,
        answerKey: q.answer_key_json,
      })),
    };
  }

  /**
   * Membuat paket ujian baru.
   */
  static async createExam(
    schoolId: string,
    data: ExamCreateInput,
    actor: { id: string; username: string; role: string }
  ): Promise<any> {
    if (!data.title?.trim() || !data.subjectId || !data.startTime || !data.endTime) {
      throw new Error('Judul, mata pelajaran, waktu mulai, dan waktu selesai wajib diisi.');
    }
    if (new Date(data.startTime) >= new Date(data.endTime)) {
      throw new Error('Waktu mulai harus lebih awal daripada waktu selesai ujian.');
    }
    if (!data.durationMinutes || data.durationMinutes <= 0) {
      throw new Error('Durasi ujian harus lebih dari 0 menit.');
    }

    return await withTransaction(async (client) => {
      const res = await client.query(
        `INSERT INTO exams (
          id, school_id, title, subject_id, created_by, status, window_mode,
          start_time, end_time, duration_minutes, randomize_questions, randomize_options,
          show_score_policy, passing_grade, academic_year_id, semester_id, target_class_ids
         ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
         ) RETURNING *;`,
        [
          schoolId,
          data.title.trim(),
          data.subjectId,
          actor.id,
          data.windowMode || 'FLEXIBLE',
          data.startTime,
          data.endTime,
          data.durationMinutes,
          data.randomizeQuestions ?? true,
          data.randomizeOptions ?? true,
          data.showScorePolicy || 'AFTER_ALL_DONE',
          data.passingGrade || 75.0,
          data.academicYearId || null,
          data.semesterId || null,
          data.targetClassIds || [],
        ]
      );

      const exam = res.rows[0];

      // Assign questions if provided
      if (data.questionIds && data.questionIds.length > 0) {
        for (let i = 0; i < data.questionIds.length; i++) {
          await client.query(
            `INSERT INTO exam_questions (exam_id, question_id, order_index, weight, revision_number)
             VALUES ($1, $2, $3, 1.0, 1)
             ON CONFLICT (exam_id, question_id) DO NOTHING;`,
            [exam.id, data.questionIds[i], i + 1]
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
   * Update draft ujian.
   * Dilarang mengubah konfigurasi penting ketika ujian sudah berstatus ACTIVE.
   */
  static async updateExam(
    schoolId: string,
    examId: string,
    data: Partial<ExamCreateInput> & { status?: ExamStatus },
    actor: { id: string; username: string; role: string }
  ): Promise<any> {
    const existing = await this.getExamById(schoolId, examId);
    if (!existing) {
      throw new Error('Ujian tidak ditemukan di sekolah ini.');
    }

    if (existing.status === 'ACTIVE' && data.status !== 'COMPLETED' && data.status !== 'ARCHIVED') {
      throw new Error('Ujian sedang ACTIVE berlangsung. Anda tidak dapat mengubah jadwal atau paket soal ujian.');
    }

    return await withTransaction(async (client) => {
      await client.query(
        `UPDATE exams SET
          title = COALESCE($1, title),
          start_time = COALESCE($2, start_time),
          end_time = COALESCE($3, end_time),
          duration_minutes = COALESCE($4, duration_minutes),
          randomize_questions = COALESCE($5, randomize_questions),
          randomize_options = COALESCE($6, randomize_options),
          show_score_policy = COALESCE($7, show_score_policy),
          passing_grade = COALESCE($8, passing_grade),
          status = COALESCE($9, status),
          target_class_ids = COALESCE($10, target_class_ids)
         WHERE id = $11 AND school_id = $12;`,
        [
          data.title?.trim(),
          data.startTime,
          data.endTime,
          data.durationMinutes,
          data.randomizeQuestions,
          data.randomizeOptions,
          data.showScorePolicy,
          data.passingGrade,
          data.status,
          data.targetClassIds,
          examId,
          schoolId,
        ]
      );

      // Re-assign questions if provided
      if (data.questionIds !== undefined) {
        await client.query(`DELETE FROM exam_questions WHERE exam_id = $1;`, [examId]);
        for (let i = 0; i < data.questionIds.length; i++) {
          await client.query(
            `INSERT INTO exam_questions (exam_id, question_id, order_index, weight, revision_number)
             VALUES ($1, $2, $3, 1.0, 1)
             ON CONFLICT DO NOTHING;`,
            [examId, data.questionIds[i], i + 1]
          );
        }
      }

      await AuditService.createLog({
        action: 'EXAM_UPDATED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'EXAM',
        resourceId: examId,
        details: { previousStatus: existing.status, updatedStatus: data.status },
      });

      return await this.getExamById(schoolId, examId);
    });
  }

  /**
   * Publish / Lock Exam & Buat Snapshot Soal Beku (Exam Snapshot).
   * Menjamin bahwa soal ujian yang sedang berjalan tidak akan berubah walaupun bank soal diedit!
   */
  static async publishAndLockExam(
    schoolId: string,
    examId: string,
    actor: { id: string; username: string; role: string }
  ): Promise<{ success: boolean; totalSnapshotQuestions: number }> {
    const exam = await this.getExamById(schoolId, examId);
    if (!exam) {
      throw new Error('Ujian tidak ditemukan.');
    }

    if (exam.assignedQuestions.length === 0) {
      throw new Error('Ujian tidak dapat dipublish karena belum memiliki butir soal.');
    }

    return await withTransaction(async (client) => {
      // Ambil detail soal lengkap terkini untuk dibekukan
      const qRes = await client.query(
        `SELECT eq.order_index, eq.weight, eq.revision_number,
                qb.id, qb.topic, qb.difficulty, qb.type, qb.question_text,
                qb.media_url, qb.media_type, qb.options_json, qb.answer_key_json,
                qb.rubric_json, qb.stimulus_title, qb.stimulus_text
         FROM exam_questions eq
         JOIN question_banks qb ON eq.question_id = qb.id
         WHERE eq.exam_id = $1
         ORDER BY eq.order_index ASC;`,
        [examId]
      );

      const snapshot = qRes.rows.map((r: any) => ({
        id: r.id,
        orderIndex: r.order_index,
        weight: parseFloat(r.weight || '1.0'),
        revisionNumber: r.revision_number,
        topic: r.topic,
        difficulty: r.difficulty,
        type: r.type,
        questionText: r.question_text,
        mediaUrl: r.media_url,
        mediaType: r.media_type,
        options: r.options_json,
        answerKey: r.answer_key_json,
        rubric: r.rubric_json,
        stimulusTitle: r.stimulus_title,
        stimulusText: r.stimulus_text,
      }));

      await client.query(
        `UPDATE exams SET
          status = 'ACTIVE',
          question_snapshot_json = $1
         WHERE id = $2 AND school_id = $3;`,
        [JSON.stringify(snapshot), examId, schoolId]
      );

      await AuditService.createLog({
        action: 'EXAM_LOCKED_SNAPSHOT',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'EXAM',
        resourceId: examId,
        details: { totalSnapshotQuestions: snapshot.length, examTitle: exam.title },
      });

      return { success: true, totalSnapshotQuestions: snapshot.length };
    });
  }

  /**
   * Hapus paket ujian (hanya jika belum ada peserta yang mulai mengerjakan).
   */
  static async deleteExam(
    schoolId: string,
    examId: string,
    actor: { id: string; username: string; role: string }
  ): Promise<{ success: boolean; message: string }> {
    const exam = await this.getExamById(schoolId, examId);
    if (!exam) {
      throw new Error('Ujian tidak ditemukan.');
    }

    const sessionCheck = await queryPostgres(
      `SELECT COUNT(*) as count FROM exam_sessions es
       JOIN exam_participants ep ON es.participant_id = ep.id
       WHERE ep.exam_id = $1;`,
      [examId]
    );

    if (parseInt(sessionCheck.rows[0]?.count || '0', 10) > 0) {
      throw new Error('Ujian tidak dapat dihapus karena sudah memiliki rekam sesi pengerjaan siswa. Ubah status menjadi ARCHIVED.');
    }

    await queryPostgres(`DELETE FROM exams WHERE id = $1 AND school_id = $2;`, [examId, schoolId]);

    await AuditService.createLog({
      action: 'EXAM_DELETED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'EXAM',
      resourceId: examId,
      details: { title: exam.title },
      severity: 'WARNING',
    });

    return { success: true, message: `Paket ujian '${exam.title}' berhasil dihapus.` };
  }
}
