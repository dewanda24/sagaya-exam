import { queryPostgres } from '../core/postgres';
import { ClassRoom } from '../core/types';
import { AuditService } from './audit.service';

export class ClassService {
  /**
   * Mengambil daftar kelas / rombel di sekolah.
   */
  static async listClasses(
    schoolId: string,
    filters?: {
      academicYearId?: string;
      level?: string;
      search?: string;
    }
  ): Promise<ClassRoom[]> {
    let sql = `
      SELECT c.*, 
             ay.name as academic_year_name,
             u.full_name as homeroom_teacher_name,
             (SELECT COUNT(*) FROM students s WHERE s.class_room_id = c.id AND s.is_active = true) as student_count
      FROM class_rooms c
      LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
      LEFT JOIN users u ON c.homeroom_teacher_id = u.id
      WHERE c.school_id = $1
    `;
    const params: any[] = [schoolId];

    if (filters?.academicYearId) {
      params.push(filters.academicYearId);
      sql += ` AND c.academic_year_id = $${params.length}`;
    }

    if (filters?.level) {
      params.push(filters.level);
      sql += ` AND c.level = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND c.name ILIKE $${params.length}`;
    }

    sql += ` ORDER BY c.level ASC, c.name ASC;`;

    const res = await queryPostgres(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      schoolId: r.school_id,
      name: r.name,
      level: r.level,
      academicYear: r.academic_year_name || r.academic_year || '2026/2027',
      academicYearId: r.academic_year_id,
      homeroomTeacherId: r.homeroom_teacher_id,
      homeroomTeacherName: r.homeroom_teacher_name || 'Belum Ditentukan',
      isActive: r.is_active !== false,
      studentCount: parseInt(r.student_count || '0', 10),
    }));
  }

  /**
   * Mengambil detail satu kelas beserta daftar siswanya.
   */
  static async getClassById(schoolId: string, classId: string) {
    const res = await queryPostgres(
      `SELECT c.*, 
              ay.name as academic_year_name,
              u.full_name as homeroom_teacher_name
       FROM class_rooms c
       LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
       LEFT JOIN users u ON c.homeroom_teacher_id = u.id
       WHERE c.id = $1 AND c.school_id = $2
       LIMIT 1;`,
      [classId, schoolId]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    const studentsRes = await queryPostgres(
      `SELECT id, nis, nisn, full_name, gender, card_access_code, status, is_active
       FROM students 
       WHERE class_room_id = $1 AND school_id = $2
       ORDER BY full_name ASC;`,
      [classId, schoolId]
    );

    return {
      id: r.id,
      schoolId: r.school_id,
      name: r.name,
      level: r.level,
      academicYear: r.academic_year_name || r.academic_year || '2026/2027',
      academicYearId: r.academic_year_id,
      homeroomTeacherId: r.homeroom_teacher_id,
      homeroomTeacherName: r.homeroom_teacher_name || 'Belum Ditentukan',
      isActive: r.is_active !== false,
      students: studentsRes.rows.map((s: any) => ({
        id: s.id,
        nis: s.nis,
        nisn: s.nisn,
        fullName: s.full_name,
        gender: s.gender,
        cardAccessCode: s.card_access_code,
        status: s.status,
        isActive: s.is_active,
      })),
    };
  }

  /**
   * Membuat kelas baru.
   */
  static async createClass(
    schoolId: string,
    data: {
      name: string;
      level: string;
      academicYearId?: string;
      academicYear?: string;
      homeroomTeacherId?: string;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<ClassRoom> {
    const cleanName = data.name.trim();
    if (!cleanName) {
      throw new Error('Nama kelas wajib diisi.');
    }

    // Default ke tahun ajaran aktif jika tidak disediakan
    let ayId = data.academicYearId;
    let ayName = data.academicYear || '2026/2027';

    if (!ayId) {
      const activeAy = await queryPostgres(
        `SELECT id, name FROM academic_years WHERE school_id = $1 AND status = 'ACTIVE' LIMIT 1;`,
        [schoolId]
      );
      if (activeAy.rows.length > 0) {
        ayId = activeAy.rows[0].id;
        ayName = activeAy.rows[0].name;
      }
    }

    const res = await queryPostgres(
      `INSERT INTO class_rooms (
        id, school_id, name, level, academic_year, academic_year_id, homeroom_teacher_id, is_active
       ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5, $6, true
       ) RETURNING *;`,
      [schoolId, cleanName, data.level?.trim() || 'VII', ayName, ayId || null, data.homeroomTeacherId || null]
    );

    const created = res.rows[0];

    await AuditService.createLog({
      action: 'CLASS_CREATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'CLASS',
      resourceId: created.id,
      details: { name: cleanName, level: data.level },
    });

    return {
      id: created.id,
      schoolId: created.school_id,
      name: created.name,
      level: created.level,
      academicYear: created.academic_year,
      academicYearId: created.academic_year_id,
      homeroomTeacherId: created.homeroom_teacher_id,
      isActive: created.is_active,
      studentCount: 0,
    };
  }

  /**
   * Update data kelas.
   */
  static async updateClass(
    schoolId: string,
    classId: string,
    data: {
      name?: string;
      level?: string;
      academicYearId?: string;
      homeroomTeacherId?: string | null;
      isActive?: boolean;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<ClassRoom> {
    const existing = await this.getClassById(schoolId, classId);
    if (!existing) {
      throw new Error('Kelas tidak ditemukan di sekolah ini.');
    }

    await queryPostgres(
      `UPDATE class_rooms SET
        name = COALESCE($1, name),
        level = COALESCE($2, level),
        academic_year_id = COALESCE($3, academic_year_id),
        homeroom_teacher_id = $4,
        is_active = COALESCE($5, is_active)
       WHERE id = $6 AND school_id = $7;`,
      [
        data.name?.trim(),
        data.level?.trim(),
        data.academicYearId,
        data.homeroomTeacherId !== undefined ? data.homeroomTeacherId : existing.homeroomTeacherId,
        data.isActive,
        classId,
        schoolId,
      ]
    );

    await AuditService.createLog({
      action: 'CLASS_UPDATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'CLASS',
      resourceId: classId,
      details: { previousName: existing.name, updatedName: data.name },
    });

    return (await this.listClasses(schoolId)).find((c) => c.id === classId)!;
  }

  /**
   * Hapus kelas (memastikan siswa tidak terhapus, melainkan class_room_id di-nullkan).
   */
  static async deleteClass(
    schoolId: string,
    classId: string,
    actor: { id: string; username: string; role: string }
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.getClassById(schoolId, classId);
    if (!existing) {
      throw new Error('Kelas tidak ditemukan di sekolah ini.');
    }

    // Lepaskan siswa dari kelas sebelum dihapus
    await queryPostgres(`UPDATE students SET class_room_id = NULL WHERE class_room_id = $1 AND school_id = $2;`, [
      classId,
      schoolId,
    ]);

    await queryPostgres(`DELETE FROM class_rooms WHERE id = $1 AND school_id = $2;`, [classId, schoolId]);

    await AuditService.createLog({
      action: 'CLASS_DELETED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'CLASS',
      resourceId: classId,
      details: { className: existing.name },
      severity: 'WARNING',
    });

    return { success: true, message: `Kelas '${existing.name}' berhasil dihapus.` };
  }
}
