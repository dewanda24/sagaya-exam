import { queryPostgres, withTransaction } from '../core/postgres';
import { QuestionBankItem, QuestionType, DifficultyLevel } from '../core/types';
import { AuditService } from './audit.service';

export interface QuestionFilters {
  subjectId?: string;
  teacherId?: string;
  lifecycleStatus?: string;
  type?: QuestionType;
  difficulty?: DifficultyLevel;
  search?: string;
  limit?: number;
  offset?: number;
}

export class SchoolQuestionService {
  /**
   * Mengambil daftar soal di bank soal sekolah.
   */
  static async listQuestions(
    schoolId: string,
    filters?: QuestionFilters
  ): Promise<{ questions: QuestionBankItem[]; total: number }> {
    let countSql = `SELECT COUNT(*) as total FROM question_banks WHERE school_id = $1`;
    let sql = `
      SELECT qb.*, 
             s.name as subject_name,
             u.full_name as teacher_name
      FROM question_banks qb
      LEFT JOIN subjects s ON qb.subject_id = s.id
      LEFT JOIN users u ON qb.teacher_id = u.id
      WHERE qb.school_id = $1
    `;
    const params: any[] = [schoolId];

    if (filters?.subjectId) {
      params.push(filters.subjectId);
      sql += ` AND qb.subject_id = $${params.length}`;
      countSql += ` AND subject_id = $${params.length}`;
    }

    if (filters?.teacherId) {
      params.push(filters.teacherId);
      sql += ` AND qb.teacher_id = $${params.length}`;
      countSql += ` AND teacher_id = $${params.length}`;
    }

    if (filters?.lifecycleStatus) {
      params.push(filters.lifecycleStatus);
      sql += ` AND qb.lifecycle_status = $${params.length}`;
      countSql += ` AND lifecycle_status = $${params.length}`;
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

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      const searchClause = ` AND (qb.question_text ILIKE $${params.length} OR qb.topic ILIKE $${params.length})`;
      sql += searchClause;
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

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const questions: QuestionBankItem[] = dataRes.rows.map((r: any) => ({
      id: r.id,
      schoolId: r.school_id,
      subjectId: r.subject_id,
      subjectName: r.subject_name || 'Mapel Tidak Diketahui',
      teacherId: r.teacher_id,
      teacherName: r.teacher_name || 'Admin Sekolah',
      topic: r.topic,
      difficulty: r.difficulty as DifficultyLevel,
      type: r.type as QuestionType,
      questionText: r.question_text,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      options: r.options_json,
      answerKey: r.answer_key_json,
      rubric: r.rubric_json?.rubric,
      weight: parseFloat(r.weight || '1.0'),
      tags: r.tags || [],
      isShared: r.is_shared,
      cognitiveLevel: r.cognitive_level,
      competenceCode: r.competence_code,
      stimulusId: r.stimulus_id,
      stimulusTitle: r.stimulus_title,
      stimulusText: r.stimulus_text,
      stimulusMediaUrl: r.stimulus_media_url,
    }));

    return { questions, total };
  }

  /**
   * Mengambil detail satu soal beserta riwayat revisi versi.
   */
  static async getQuestionById(schoolId: string, questionId: string) {
    const res = await queryPostgres(
      `SELECT qb.*, s.name as subject_name, u.full_name as teacher_name
       FROM question_banks qb
       LEFT JOIN subjects s ON qb.subject_id = s.id
       LEFT JOIN users u ON qb.teacher_id = u.id
       WHERE qb.id = $1 AND qb.school_id = $2
       LIMIT 1;`,
      [questionId, schoolId]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const revRes = await queryPostgres(
      `SELECT qr.*, u.full_name as creator_name
       FROM question_revisions qr
       LEFT JOIN users u ON qr.created_by = u.id
       WHERE qr.question_id = $1
       ORDER BY qr.revision_number DESC;`,
      [questionId]
    );

    return {
      id: r.id,
      schoolId: r.school_id,
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      topic: r.topic,
      difficulty: r.difficulty,
      type: r.type,
      questionText: r.question_text,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      options: r.options_json,
      answerKey: r.answer_key_json,
      rubric: r.rubric_json?.rubric,
      weight: parseFloat(r.weight || '1.0'),
      tags: r.tags || [],
      lifecycleStatus: r.lifecycle_status || 'DRAFT',
      currentRevisionNumber: r.current_revision_number || 1,
      isShared: r.is_shared,
      stimulusTitle: r.stimulus_title,
      stimulusText: r.stimulus_text,
      revisions: revRes.rows,
    };
  }

  /**
   * Membuat soal baru (versi 1).
   * Guru sebagai content author; jika dibuat admin, author tetap dicatat.
   */
  static async createQuestion(
    schoolId: string,
    data: {
      subjectId: string;
      teacherId?: string;
      topic: string;
      difficulty: DifficultyLevel;
      type: QuestionType;
      questionText: string;
      mediaUrl?: string;
      mediaType?: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'NONE';
      options?: any[];
      answerKey: any;
      rubric?: string;
      weight?: number;
      tags?: string[];
      lifecycleStatus?: string;
      stimulusText?: string;
      stimulusTitle?: string;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<any> {
    if (!data.subjectId || !data.topic || !data.questionText) {
      throw new Error('Mata pelajaran, topik, dan teks soal wajib diisi.');
    }

    const teacherId = data.teacherId || actor.id;
    const initialStatus = data.lifecycleStatus || (actor.role === 'ADMIN' ? 'APPROVED' : 'DRAFT');

    return await withTransaction(async (client) => {
      const qRes = await client.query(
        `INSERT INTO question_banks (
          id, school_id, subject_id, teacher_id, topic, difficulty, type, question_text,
          media_url, media_type, options_json, answer_key_json, rubric_json, weight, tags,
          lifecycle_status, current_revision_number, stimulus_title, stimulus_text, is_global
         ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1, $16, $17, false
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
          JSON.stringify(data.rubric ? { rubric: data.rubric } : {}),
          data.weight || 1.0,
          data.tags || [],
          initialStatus,
          data.stimulusTitle || null,
          data.stimulusText || null,
        ]
      );

      const q = qRes.rows[0];

      // Catat Revisi 1 di question_revisions
      await client.query(
        `INSERT INTO question_revisions (
          id, question_id, revision_number, topic, difficulty, type, question_text,
          media_url, media_type, options_json, answer_key_json, rubric_json, weight, tags,
          stimulus_text, created_by
         ) VALUES (
          uuid_generate_v4(), $1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
         );`,
        [
          q.id,
          q.topic,
          q.difficulty,
          q.type,
          q.question_text,
          q.media_url,
          q.media_type,
          q.options_json,
          q.answer_key_json,
          q.rubric_json,
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
   * Memperbarui soal dengan Versioning.
   * Jika soal sudah pernah terpakai di ujian aktif/selesai, versi baru dibuat sehingga
   * snapshot ujian yang telah berjalan tetap aman dan IMMUTABLE!
   */
  static async updateQuestion(
    schoolId: string,
    questionId: string,
    data: {
      topic?: string;
      difficulty?: DifficultyLevel;
      type?: QuestionType;
      questionText?: string;
      mediaUrl?: string;
      mediaType?: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'NONE';
      options?: any[];
      answerKey?: any;
      rubric?: string;
      weight?: number;
      tags?: string[];
      lifecycleStatus?: string;
      stimulusText?: string;
      stimulusTitle?: string;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<any> {
    const existing = await this.getQuestionById(schoolId, questionId);
    if (!existing) {
      throw new Error('Soal tidak ditemukan di sekolah ini.');
    }

    return await withTransaction(async (client) => {
      const nextRevNumber = (existing.currentRevisionNumber || 1) + 1;

      // Update question_banks
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
          rubric_json = COALESCE($9, rubric_json),
          weight = COALESCE($10, weight),
          tags = COALESCE($11, tags),
          lifecycle_status = COALESCE($12, lifecycle_status),
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
          data.rubric ? JSON.stringify({ rubric: data.rubric }) : undefined,
          data.weight,
          data.tags,
          data.lifecycleStatus,
          data.stimulusTitle,
          data.stimulusText,
          nextRevNumber,
          questionId,
          schoolId,
        ]
      );

      const q = updateRes.rows[0];

      // Rekam revisi baru secara immutable di question_revisions
      await client.query(
        `INSERT INTO question_revisions (
          id, question_id, revision_number, topic, difficulty, type, question_text,
          media_url, media_type, options_json, answer_key_json, rubric_json, weight, tags,
          stimulus_text, created_by
         ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
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
          q.options_json,
          q.answer_key_json,
          q.rubric_json,
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
   * Moderasi dan Approval Soal oleh Admin Sekolah.
   */
  static async moderateQuestion(
    schoolId: string,
    questionId: string,
    action: 'APPROVE' | 'REJECT' | 'ARCHIVE' | 'PUBLISH',
    actor: { id: string; username: string; role: string },
    rejectionReason?: string
  ): Promise<void> {
    const existing = await this.getQuestionById(schoolId, questionId);
    if (!existing) {
      throw new Error('Soal tidak ditemukan.');
    }

    let targetStatus = 'APPROVED';
    if (action === 'REJECT') targetStatus = 'DRAFT';
    if (action === 'ARCHIVE') targetStatus = 'ARCHIVED';
    if (action === 'PUBLISH') targetStatus = 'PUBLISHED';

    await queryPostgres(
      `UPDATE question_banks SET
        lifecycle_status = $1,
        rejection_reason = $2
       WHERE id = $3 AND school_id = $4;`,
      [targetStatus, rejectionReason || null, questionId, schoolId]
    );

    await AuditService.createLog({
      action: `QUESTION_${action}D`,
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'QUESTION',
      resourceId: questionId,
      details: { newStatus: targetStatus, rejectionReason },
    });
  }

  /**
   * Hapus soal dari bank soal (hanya jika belum pernah digunakan dalam ujian yang berjalan).
   */
  static async deleteQuestion(
    schoolId: string,
    questionId: string,
    actor: { id: string; username: string; role: string }
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.getQuestionById(schoolId, questionId);
    if (!existing) {
      throw new Error('Soal tidak ditemukan di sekolah ini.');
    }

    const checkUsage = await queryPostgres(
      `SELECT COUNT(*) as count FROM exam_questions eq
       JOIN exams e ON eq.exam_id = e.id
       WHERE eq.question_id = $1 AND e.status IN ('ACTIVE', 'COMPLETED');`,
      [questionId]
    );

    if (parseInt(checkUsage.rows[0]?.count || '0', 10) > 0) {
      throw new Error('Soal tidak dapat dihapus permanen karena merupakan bagian dari rekam jejak ujian yang sudah berlangsung. Silakan ubah status menjadi ARCHIVED.');
    }

    await queryPostgres(`DELETE FROM question_banks WHERE id = $1 AND school_id = $2;`, [questionId, schoolId]);

    await AuditService.createLog({
      action: 'QUESTION_DELETED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'QUESTION',
      resourceId: questionId,
      details: { topic: existing.topic },
      severity: 'WARNING',
    });

    return { success: true, message: 'Soal berhasil dihapus.' };
  }
}
