import { queryPostgres } from '../core/postgres';
import { Subject } from '../core/types';
import { AuditService } from './audit.service';

export class SubjectService {
  /**
   * Mengambil daftar mata pelajaran di sekolah.
   */
  static async listSubjects(
    schoolId: string,
    filters?: { search?: string; category?: string; level?: string }
  ): Promise<Subject[]> {
    let sql = `
      SELECT s.*,
             (SELECT COUNT(*) FROM question_banks qb WHERE qb.subject_id = s.id AND qb.school_id = s.school_id) as question_count,
             (SELECT COUNT(DISTINCT ts.teacher_id) FROM teacher_subjects ts WHERE ts.subject_id = s.id AND ts.school_id = s.school_id) as teacher_count
      FROM subjects s
      WHERE s.school_id = $1
    `;
    const params: any[] = [schoolId];

    if (filters?.category) {
      params.push(filters.category);
      sql += ` AND s.category = $${params.length}`;
    }

    if (filters?.level) {
      params.push(filters.level);
      sql += ` AND s.level = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (s.name ILIKE $${params.length} OR s.code ILIKE $${params.length})`;
    }

    sql += ` ORDER BY s.name ASC;`;

    const res = await queryPostgres(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      schoolId: r.school_id,
      code: r.code,
      name: r.name,
      level: r.level,
      category: r.category || 'UMUM',
      isActive: r.is_active !== false,
      questionCount: parseInt(r.question_count || '0', 10),
      assignedTeacherCount: parseInt(r.teacher_count || '0', 10),
    }));
  }

  /**
   * Mengambil detail satu mata pelajaran beserta daftar guru pengampunya.
   */
  static async getSubjectById(schoolId: string, subjectId: string) {
    const res = await queryPostgres(
      `SELECT s.*,
              (SELECT COUNT(*) FROM question_banks qb WHERE qb.subject_id = s.id AND qb.school_id = s.school_id) as question_count
       FROM subjects s
       WHERE s.id = $1 AND s.school_id = $2
       LIMIT 1;`,
      [subjectId, schoolId]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const teachersRes = await queryPostgres(
      `SELECT u.id, u.username, u.full_name, u.nip, u.phone
       FROM teacher_subjects ts
       JOIN users u ON ts.teacher_id = u.id
       WHERE ts.subject_id = $1 AND ts.school_id = $2
       ORDER BY u.full_name ASC;`,
      [subjectId, schoolId]
    );

    return {
      id: r.id,
      schoolId: r.school_id,
      code: r.code,
      name: r.name,
      level: r.level,
      category: r.category || 'UMUM',
      isActive: r.is_active !== false,
      questionCount: parseInt(r.question_count || '0', 10),
      assignedTeachers: teachersRes.rows,
    };
  }

  /**
   * Membuat mata pelajaran baru.
   */
  static async createSubject(
    schoolId: string,
    data: {
      code: string;
      name: string;
      level?: string;
      category?: string;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<Subject> {
    const cleanCode = data.code.trim().toUpperCase();
    const cleanName = data.name.trim();

    if (!cleanCode || !cleanName) {
      throw new Error('Kode dan Nama mata pelajaran wajib diisi.');
    }

    const check = await queryPostgres(
      `SELECT id FROM subjects WHERE school_id = $1 AND UPPER(code) = $2 LIMIT 1;`,
      [schoolId, cleanCode]
    );
    if (check.rows.length > 0) {
      throw new Error(`Kode mata pelajaran '${cleanCode}' sudah digunakan di sekolah ini.`);
    }

    const res = await queryPostgres(
      `INSERT INTO subjects (id, school_id, code, name, level, category, is_active)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, true)
       RETURNING *;`,
      [schoolId, cleanCode, cleanName, data.level?.trim() || null, data.category?.trim() || 'UMUM']
    );

    const created = res.rows[0];

    await AuditService.createLog({
      action: 'SUBJECT_CREATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'SUBJECT',
      resourceId: created.id,
      details: { code: cleanCode, name: cleanName },
    });

    return {
      id: created.id,
      schoolId: created.school_id,
      code: created.code,
      name: created.name,
      level: created.level,
      category: created.category,
      isActive: created.is_active,
      questionCount: 0,
      assignedTeacherCount: 0,
    };
  }

  /**
   * Update mata pelajaran.
   */
  static async updateSubject(
    schoolId: string,
    subjectId: string,
    data: {
      code?: string;
      name?: string;
      level?: string;
      category?: string;
      isActive?: boolean;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<Subject> {
    const existing = await this.getSubjectById(schoolId, subjectId);
    if (!existing) {
      throw new Error('Mata pelajaran tidak ditemukan.');
    }

    await queryPostgres(
      `UPDATE subjects SET
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        level = COALESCE($3, level),
        category = COALESCE($4, category),
        is_active = COALESCE($5, is_active)
       WHERE id = $6 AND school_id = $7;`,
      [
        data.code?.trim().toUpperCase(),
        data.name?.trim(),
        data.level?.trim(),
        data.category?.trim(),
        data.isActive,
        subjectId,
        schoolId,
      ]
    );

    await AuditService.createLog({
      action: 'SUBJECT_UPDATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'SUBJECT',
      resourceId: subjectId,
      details: { previousCode: existing.code, newCode: data.code, newName: data.name },
    });

    const list = await this.listSubjects(schoolId);
    return list.find((s) => s.id === subjectId)!;
  }

  /**
   * Hapus mata pelajaran jika belum terikat ujian aktif.
   */
  static async deleteSubject(
    schoolId: string,
    subjectId: string,
    actor: { id: string; username: string; role: string }
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.getSubjectById(schoolId, subjectId);
    if (!existing) {
      throw new Error('Mata pelajaran tidak ditemukan.');
    }

    const examCheck = await queryPostgres(
      `SELECT COUNT(*) as count FROM exams WHERE subject_id = $1 AND school_id = $2;`,
      [subjectId, schoolId]
    );
    if (parseInt(examCheck.rows[0]?.count || '0', 10) > 0) {
      throw new Error('Mata pelajaran tidak dapat dihapus karena sudah memiliki data ujian terkait. Silakan nonaktifkan.');
    }

    await queryPostgres(`DELETE FROM subjects WHERE id = $1 AND school_id = $2;`, [subjectId, schoolId]);

    await AuditService.createLog({
      action: 'SUBJECT_DELETED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'SUBJECT',
      resourceId: subjectId,
      details: { code: existing.code, name: existing.name },
      severity: 'WARNING',
    });

    return { success: true, message: `Mata pelajaran '${existing.name}' berhasil dihapus.` };
  }
}
