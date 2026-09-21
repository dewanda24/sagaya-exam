import { queryPostgres, withTransaction } from '../core/postgres';
import { QuestionType, DifficultyLevel } from '../core/types';
import { AuditService } from './audit.service';
import { TeacherAuthorizationService } from './teacher-authorization.service';
import { QuestionTypeRegistry } from '../core/question-types';

export interface QuestionFilterInput {
  subjectId?: string;
  type?: QuestionType;
  difficulty?: DifficultyLevel;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  authorScope?: 'MINE' | 'SHARED' | 'ALL';
}

export interface QuestionInput {
  subjectId: string;
  topic: string;
  difficulty: DifficultyLevel;
  type: QuestionType;
  questionText: string;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'NONE';
  options?: any[];
  answerKey: any;
  explanation?: string;
  rubric?: any;
  weight?: number;
  tags?: string[];
  stimulusTitle?: string;
  stimulusText?: string;
  expectedVersion?: number; // For optimistic concurrency check
}

export class TeacherQuestionService {
  /**
   * Mengambil daftar soal dengan filter ketat di level database.
   */
  static async listQuestions(
    schoolId: string,
    teacherId: string,
    filters?: QuestionFilterInput,
    actorRole?: string
  ) {
    let countSql = `SELECT COUNT(*) as total FROM question_banks qb WHERE qb.school_id = $1`;
    let sql = `
      SELECT qb.*, 
             s.name as subject_name, s.code as subject_code,
             u.full_name as author_name
      FROM question_banks qb
      LEFT JOIN subjects s ON qb.subject_id = s.id
      LEFT JOIN users u ON qb.teacher_id = u.id
      WHERE qb.school_id = $1
    `;
    const params: any[] = [schoolId];

    // Scope author: secara default guru hanya melihat soal miliknya atau soal yang di-share di sekolahnya
    if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
      if (filters?.authorScope === 'SHARED') {
        sql += ` AND (qb.is_shared = true OR qb.lifecycle_status IN ('APPROVED', 'PUBLISHED')) AND qb.teacher_id != $${params.length + 1}`;
        countSql += ` AND (is_shared = true OR lifecycle_status IN ('APPROVED', 'PUBLISHED')) AND teacher_id != $${params.length + 1}`;
        params.push(teacherId);
      } else if (filters?.authorScope === 'ALL') {
        sql += ` AND (qb.teacher_id = $${params.length + 1} OR qb.is_shared = true OR qb.lifecycle_status IN ('APPROVED', 'PUBLISHED'))`;
        countSql += ` AND (teacher_id = $${params.length + 1} OR is_shared = true OR lifecycle_status IN ('APPROVED', 'PUBLISHED'))`;
        params.push(teacherId);
      } else {
        // Default: 'MINE' (hanya milik guru tersebut)
        sql += ` AND qb.teacher_id = $${params.length + 1}`;
        countSql += ` AND teacher_id = $${params.length + 1}`;
        params.push(teacherId);
      }
    }

    if (filters?.subjectId) {
      params.push(filters.subjectId);
      sql += ` AND qb.subject_id = $${params.length}`;
      countSql += ` AND subject_id = $${params.length}`;
    }

    if (filters?.type) {
      params.push(filters.type);
      sql += ` AND qb.type = $${params.length}`;
      countSql += ` AND type = $${params.length}`;
    }

    if (filters?.difficulty) {
      params.push(filters.difficulty);
      sql += ` AND qb.difficulty = $${params.length}`;
      countSql += ` AND difficulty = $${params.length}`;
    }

    if (filters?.status) {
      params.push(filters.status);
      sql += ` AND qb.lifecycle_status = $${params.length}`;
      countSql += ` AND lifecycle_status = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (qb.question_text ILIKE $${params.length} OR qb.topic ILIKE $${params.length})`;
      countSql += ` AND (question_text ILIKE $${params.length} OR topic ILIKE $${params.length})`;
    }

    sql += ` ORDER BY qb.created_at DESC`;

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
      questions: dataRes.rows.map((r) => ({
        id: r.id,
        schoolId: r.school_id,
        subjectId: r.subject_id,
        subjectName: r.subject_name,
        subjectCode: r.subject_code,
        teacherId: r.teacher_id,
        authorName: r.author_name,
        topic: r.topic,
        difficulty: r.difficulty,
        type: r.type,
        questionText: r.question_text,
        mediaUrl: r.media_url,
        mediaType: r.media_type,
        options: r.options_json,
        answerKey: r.answer_key_json,
        explanation: r.explanation,
        rubric: r.rubric_json?.rubric,
        weight: parseFloat(r.weight || '1.0'),
        tags: r.tags || [],
        lifecycleStatus: r.lifecycle_status || 'DRAFT',
        currentRevisionNumber: r.current_revision_number || 1,
        rejectionReason: r.rejection_reason,
        createdAt: r.created_at,
      })),
      total: parseInt(countRes.rows[0]?.total || '0', 10),
    };
  }

  /**
   * Mengambil detail satu soal beserta seluruh versi revisi masa lalu.
   */
  static async getQuestionDetail(
    schoolId: string,
    teacherId: string,
    questionId: string,
    actorRole?: string
  ) {
    const qRes = await queryPostgres(
      `SELECT qb.*, s.name as subject_name, s.code as subject_code, u.full_name as author_name
       FROM question_banks qb
       LEFT JOIN subjects s ON qb.subject_id = s.id
       LEFT JOIN users u ON qb.teacher_id = u.id
       WHERE qb.id = $1 AND qb.school_id = $2
       LIMIT 1;`,
      [questionId, schoolId]
    );

    if (qRes.rows.length === 0) {
      throw new Error('Soal tidak ditemukan.');
    }

    const q = qRes.rows[0];

    // Otorisasi hak baca soal
    if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
      const allowed = await TeacherAuthorizationService.canReadQuestion(
        { id: teacherId, schoolId, role: 'GURU' } as any,
        q,
        schoolId
      );
      if (!allowed) {
        throw new Error('Akses ditolak: Anda tidak memiliki izin untuk melihat soal ini.');
      }
    }

    // Ambil riwayat versi / revisi
    const revRes = await queryPostgres(
      `SELECT qr.*, u.full_name as creator_name
       FROM question_revisions qr
       LEFT JOIN users u ON qr.created_by = u.id
       WHERE qr.question_id = $1
       ORDER BY qr.revision_number DESC;`,
      [questionId]
    );

    return {
      id: q.id,
      schoolId: q.school_id,
      subjectId: q.subject_id,
      subjectName: q.subject_name,
      subjectCode: q.subject_code,
      teacherId: q.teacher_id,
      authorName: q.author_name,
      topic: q.topic,
      difficulty: q.difficulty,
      type: q.type,
      questionText: q.question_text,
      mediaUrl: q.media_url,
      mediaType: q.media_type,
      options: q.options_json,
      answerKey: q.answer_key_json,
      explanation: q.explanation,
      rubric: q.rubric_json?.rubric,
      weight: parseFloat(q.weight || '1.0'),
      tags: q.tags || [],
      lifecycleStatus: q.lifecycle_status || 'DRAFT',
      currentRevisionNumber: q.current_revision_number || 1,
      rejectionReason: q.rejection_reason,
      stimulusTitle: q.stimulus_title,
      stimulusText: q.stimulus_text,
      createdAt: q.created_at,
      revisions: revRes.rows.map((r) => ({
        id: r.id,
        revisionNumber: r.revision_number,
        topic: r.topic,
        difficulty: r.difficulty,
        type: r.type,
        questionText: r.question_text,
        mediaUrl: r.media_url,
        mediaType: r.media_type,
        options: r.options_json,
        answerKey: r.answer_key_json,
        explanation: r.explanation,
        rubric: r.rubric_json?.rubric,
        weight: parseFloat(r.weight || '1.0'),
        createdAt: r.created_at,
        creatorName: r.creator_name,
      })),
    };
  }

  /**
   * Membuat soal baru (Versi 1).
   */
  static async createQuestion(
    schoolId: string,
    teacherId: string,
    data: QuestionInput,
    actor: { id: string; username: string; role: string }
  ) {
    // 1. Verifikasi guru ditugaskan pada mapel ini
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      const assigned = await TeacherAuthorizationService.isAssignedToSubject(
        teacherId,
        schoolId,
        data.subjectId
      );
      if (!assigned) {
        throw new Error('Akses ditolak: Anda tidak ditugaskan untuk mengampu mata pelajaran ini.');
      }
    }

    // 2. Validasi konten menggunakan QuestionTypeRegistry
    const handler = QuestionTypeRegistry.getHandler(data.type);
    const validation = handler.validate({
      questionText: data.questionText,
      options: data.options,
      answerKey: data.answerKey,
      rubric: data.rubric,
      weight: data.weight,
      explanation: data.explanation,
    });

    if (!validation.valid) {
      throw new Error(`Validasi soal gagal: ${validation.errors.join(' ')}`);
    }

    return await withTransaction(async (client) => {
      const qRes = await client.query(
        `INSERT INTO question_banks (
          id, school_id, subject_id, teacher_id, author_id, topic, difficulty, type, question_text,
          media_url, media_type, options_json, answer_key_json, explanation, rubric_json, weight, tags,
          lifecycle_status, current_revision_number, stimulus_title, stimulus_text, is_global
         ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'DRAFT', 1, $16, $17, false
         ) RETURNING *;`,
        [
          schoolId,
          data.subjectId,
          teacherId,
          data.topic.trim(),
          data.difficulty || 'MEDIUM',
          data.type,
          data.questionText.trim(),
          data.mediaUrl || null,
          data.mediaType || 'NONE',
          JSON.stringify(data.options || []),
          JSON.stringify(data.answerKey),
          data.explanation || null,
          JSON.stringify(data.rubric ? { rubric: data.rubric } : {}),
          data.weight || 1.0,
          data.tags || [],
          data.stimulusTitle || null,
          data.stimulusText || null,
        ]
      );

      const q = qRes.rows[0];

      // Rekam Versi 1 di question_revisions
      await client.query(
        `INSERT INTO question_revisions (
          id, question_id, revision_number, topic, difficulty, type, question_text,
          media_url, media_type, options_json, answer_key_json, explanation, rubric_json, weight, tags,
          stimulus_text, created_by
         ) VALUES (
          uuid_generate_v4(), $1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
         );`,
        [
          q.id,
          q.topic,
          q.difficulty,
          q.type,
          q.question_text,
          q.media_url,
          q.media_type,
          q.options_json ? JSON.stringify(q.options_json) : '[]',
          q.answer_key_json !== undefined && q.answer_key_json !== null ? JSON.stringify(q.answer_key_json) : 'null',
          q.explanation,
          q.rubric_json ? JSON.stringify(q.rubric_json) : '{}',
          q.weight,
          q.tags,
          q.stimulus_text,
          actor.id,
        ]
      );

      await AuditService.createLog({
        action: 'QUESTION_CREATED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'QUESTION',
        resourceId: q.id,
        details: { topic: q.topic, type: q.type, revisionNumber: 1 },
      });

      return q;
    });
  }

  /**
   * Memperbarui soal dengan deteksi concurrency conflict dan pembuatan versi baru.
   */
  static async updateQuestion(
    schoolId: string,
    teacherId: string,
    questionId: string,
    data: Partial<QuestionInput>,
    actor: { id: string; username: string; role: string }
  ) {
    const existingRes = await queryPostgres(
      `SELECT * FROM question_banks WHERE id = $1 AND school_id = $2;`,
      [questionId, schoolId]
    );

    if (existingRes.rows.length === 0) {
      throw new Error('Soal tidak ditemukan.');
    }

    const existing = existingRes.rows[0];

    // 1. Otorisasi edit
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      const auth = await TeacherAuthorizationService.canEditQuestion(
        { id: teacherId, schoolId, role: 'GURU' } as any,
        existing,
        schoolId
      );
      if (!auth.allowed) {
        throw new Error(`Akses ditolak: ${auth.reason}`);
      }
    }

    // 2. Concurrency Conflict Check
    if (data.expectedVersion !== undefined && data.expectedVersion !== existing.current_revision_number) {
      throw new Error('Data telah berubah di perangkat lain. Silakan muat ulang halaman terlebih dahulu.');
    }

    // 3. Validasi tipe soal jika data berubah
    const targetType = data.type || existing.type;
    const handler = QuestionTypeRegistry.getHandler(targetType);
    const validation = handler.validate({
      questionText: data.questionText ?? existing.question_text,
      options: data.options ?? existing.options_json,
      answerKey: data.answerKey ?? existing.answer_key_json,
      rubric: data.rubric ?? existing.rubric_json?.rubric,
      weight: data.weight ?? parseFloat(existing.weight),
      explanation: data.explanation ?? existing.explanation,
    });

    if (!validation.valid) {
      throw new Error(`Validasi pembaruan soal gagal: ${validation.errors.join(' ')}`);
    }

    return await withTransaction(async (client) => {
      const nextRevNumber = (existing.current_revision_number || 1) + 1;

      const updateRes = await client.query(
        `UPDATE question_banks SET
          topic = COALESCE($1, topic),
          difficulty = COALESCE($2, difficulty),
          type = COALESCE($3, type),
          question_text = COALESCE($4, question_text),
          media_url = COALESCE($5, media_url),
          media_type = COALESCE($6, media_type),
          options_json = COALESCE($7, options_json),
          answer_key_json = COALESCE($8, answer_key_json),
          explanation = COALESCE($9, explanation),
          rubric_json = COALESCE($10, rubric_json),
          weight = COALESCE($11, weight),
          tags = COALESCE($12, tags),
          stimulus_title = COALESCE($13, stimulus_title),
          stimulus_text = COALESCE($14, stimulus_text),
          current_revision_number = $15
         WHERE id = $16 AND school_id = $17
         RETURNING *;`,
        [
          data.topic?.trim(),
          data.difficulty,
          data.type,
          data.questionText?.trim(),
          data.mediaUrl,
          data.mediaType,
          data.options ? JSON.stringify(data.options) : undefined,
          data.answerKey ? JSON.stringify(data.answerKey) : undefined,
          data.explanation,
          data.rubric ? JSON.stringify({ rubric: data.rubric }) : undefined,
          data.weight,
          data.tags,
          data.stimulusTitle,
          data.stimulusText,
          nextRevNumber,
          questionId,
          schoolId,
        ]
      );

      const q = updateRes.rows[0];

      // Rekam revisi baru secara persisten di question_revisions
      await client.query(
        `INSERT INTO question_revisions (
          id, question_id, revision_number, topic, difficulty, type, question_text,
          media_url, media_type, options_json, answer_key_json, explanation, rubric_json, weight, tags,
          stimulus_text, created_by
         ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
         );`,
        [
          q.id,
          nextRevNumber,
          q.topic,
          q.difficulty,
          q.type,
          q.question_text,
          q.media_url,
          q.media_type,
          q.options_json ? JSON.stringify(q.options_json) : '[]',
          q.answer_key_json !== undefined && q.answer_key_json !== null ? JSON.stringify(q.answer_key_json) : 'null',
          q.explanation,
          q.rubric_json ? JSON.stringify(q.rubric_json) : '{}',
          q.weight,
          q.tags,
          q.stimulus_text,
          actor.id,
        ]
      );

      await AuditService.createLog({
        action: 'QUESTION_UPDATED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'QUESTION',
        resourceId: questionId,
        details: { newRevisionNumber: nextRevNumber, topic: q.topic },
      });

      return q;
    });
  }

  /**
   * Menghapus soal (Hanya soal berstatus DRAFT yang boleh dihapus).
   */
  static async deleteDraftQuestion(
    schoolId: string,
    teacherId: string,
    questionId: string,
    actor: { id: string; username: string; role: string }
  ) {
    const qRes = await queryPostgres(
      `SELECT * FROM question_banks WHERE id = $1 AND school_id = $2;`,
      [questionId, schoolId]
    );

    if (qRes.rows.length === 0) {
      throw new Error('Soal tidak ditemukan.');
    }

    const q = qRes.rows[0];

    // Otorisasi
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      const auth = await TeacherAuthorizationService.canDeleteQuestion(
        { id: teacherId, schoolId, role: 'GURU' } as any,
        q,
        schoolId
      );
      if (!auth.allowed) {
        throw new Error(`Akses ditolak: ${auth.reason}`);
      }
    }

    // Pastikan belum pernah digunakan dalam exam aktif atau selesai
    const usageCheck = await queryPostgres(
      `SELECT COUNT(*) as count FROM exam_questions WHERE question_id = $1;`,
      [questionId]
    );

    if (parseInt(usageCheck.rows[0]?.count || '0', 10) > 0) {
      throw new Error('Soal tidak dapat dihapus karena sudah terhubung ke data ujian. Ubah status menjadi ARCHIVED jika tidak ingin digunakan lagi.');
    }

    await queryPostgres(`DELETE FROM question_banks WHERE id = $1 AND school_id = $2;`, [questionId, schoolId]);

    await AuditService.createLog({
      action: 'QUESTION_DELETED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'QUESTION',
      resourceId: questionId,
      details: { topic: q.topic },
      severity: 'WARNING',
    });

    return { success: true, message: 'Draft soal berhasil dihapus.' };
  }

  /**
   * Mengajukan soal untuk review (DRAFT -> SUBMITTED).
   */
  static async submitForReview(
    schoolId: string,
    teacherId: string,
    questionId: string,
    actor: { id: string; username: string; role: string }
  ) {
    const qRes = await queryPostgres(
      `SELECT * FROM question_banks WHERE id = $1 AND school_id = $2;`,
      [questionId, schoolId]
    );

    if (qRes.rows.length === 0) {
      throw new Error('Soal tidak ditemukan.');
    }

    const q = qRes.rows[0];

    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      const canSubmit = TeacherAuthorizationService.canSubmitQuestion(
        { id: teacherId, schoolId, role: 'GURU' } as any,
        q
      );
      if (!canSubmit) {
        throw new Error('Akses ditolak: Hanya pembuat soal berstatus DRAFT yang dapat mengajukan review.');
      }
    }

    await queryPostgres(
      `UPDATE question_banks SET lifecycle_status = 'SUBMITTED' WHERE id = $1 AND school_id = $2;`,
      [questionId, schoolId]
    );

    await AuditService.createLog({
      action: 'QUESTION_SUBMITTED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'QUESTION',
      resourceId: questionId,
      details: { fromStatus: q.lifecycle_status, toStatus: 'SUBMITTED' },
    });

    return { success: true, message: 'Soal berhasil dikirim untuk review.' };
  }

  /**
   * Menyetujui atau menolak soal (Hanya untuk pengguna dengan permission reviewer / admin).
   */
  static async reviewQuestion(
    schoolId: string,
    reviewerId: string,
    questionId: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION',
    reason: string | undefined,
    actor: { id: string; username: string; role: string }
  ) {
    // Verifikasi hak review
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
      const canReview = TeacherAuthorizationService.canReviewQuestion({ id: reviewerId, schoolId, role: 'GURU' } as any);
      if (!canReview) {
        throw new Error('Akses ditolak: Anda tidak memiliki wewenang sebagai Reviewer Soal.');
      }
    }

    let nextStatus = 'APPROVED';
    if (action === 'REJECT') nextStatus = 'DRAFT';
    if (action === 'REQUEST_REVISION') nextStatus = 'DRAFT';

    await queryPostgres(
      `UPDATE question_banks SET
        lifecycle_status = $1,
        rejection_reason = $2
       WHERE id = $3 AND school_id = $4;`,
      [nextStatus, reason || null, questionId, schoolId]
    );

    const auditAction = action === 'APPROVE' ? 'QUESTION_APPROVED' : 'QUESTION_REVIEWED';

    await AuditService.createLog({
      action: auditAction,
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'QUESTION',
      resourceId: questionId,
      details: { action, nextStatus, reason },
    });

    return { success: true, status: nextStatus, message: `Status soal berhasil diubah menjadi ${nextStatus}.` };
  }

  /**
   * Menduplikasi soal menjadi soal baru dengan ID baru dan revisi 1 baru.
   */
  static async duplicateQuestion(
    schoolId: string,
    teacherId: string,
    questionId: string,
    actor: { id: string; username: string; role: string }
  ) {
    const qRes = await queryPostgres(
      `SELECT * FROM question_banks WHERE id = $1 AND school_id = $2;`,
      [questionId, schoolId]
    );

    if (qRes.rows.length === 0) {
      throw new Error('Soal sumber tidak ditemukan.');
    }

    const src = qRes.rows[0];

    return await withTransaction(async (client) => {
      const newQRes = await client.query(
        `INSERT INTO question_banks (
          id, school_id, subject_id, teacher_id, author_id, topic, difficulty, type, question_text,
          media_url, media_type, options_json, answer_key_json, explanation, rubric_json, weight, tags,
          lifecycle_status, current_revision_number, stimulus_title, stimulus_text, is_global
         ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'DRAFT', 1, $16, $17, false
         ) RETURNING *;`,
        [
          schoolId,
          src.subject_id,
          teacherId, // Kepemilikan baru adalah guru yang menduplikasi
          `${src.topic} (Salinan)`.slice(0, 100),
          src.difficulty,
          src.type,
          src.question_text,
          src.media_url,
          src.media_type,
          src.options_json ? JSON.stringify(src.options_json) : '[]',
          src.answer_key_json !== undefined && src.answer_key_json !== null ? JSON.stringify(src.answer_key_json) : 'null',
          src.explanation,
          src.rubric_json ? JSON.stringify(src.rubric_json) : '{}',
          src.weight,
          src.tags,
          src.stimulus_title,
          src.stimulus_text,
        ]
      );

      const duplicated = newQRes.rows[0];

      // Rekam Versi 1 di question_revisions
      await client.query(
        `INSERT INTO question_revisions (
          id, question_id, revision_number, topic, difficulty, type, question_text,
          media_url, media_type, options_json, answer_key_json, explanation, rubric_json, weight, tags,
          stimulus_text, created_by
         ) VALUES (
          uuid_generate_v4(), $1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
         );`,
        [
          duplicated.id,
          duplicated.topic,
          duplicated.difficulty,
          duplicated.type,
          duplicated.question_text,
          duplicated.media_url,
          duplicated.media_type,
          duplicated.options_json ? JSON.stringify(duplicated.options_json) : '[]',
          duplicated.answer_key_json !== undefined && duplicated.answer_key_json !== null ? JSON.stringify(duplicated.answer_key_json) : 'null',
          duplicated.explanation,
          duplicated.rubric_json ? JSON.stringify(duplicated.rubric_json) : '{}',
          duplicated.weight,
          duplicated.tags,
          duplicated.stimulus_text,
          actor.id,
        ]
      );

      await AuditService.createLog({
        action: 'QUESTION_DUPLICATED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'QUESTION',
        resourceId: duplicated.id,
        details: { sourceQuestionId: src.id, newTopic: duplicated.topic },
      });

      return duplicated;
    });
  }

  /**
   * Sanitasi teks untuk mencegah serangan Formula Injection / CSV Injection.
   * Setiap sel teks yang diawali =, +, -, @ di-escape dengan tanda kutip tunggal.
   */
  static sanitizeForExport(val: any): string {
    if (val === undefined || val === null) return '';
    let str = val.toString();
    if (/^[=\+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    return str;
  }
}
