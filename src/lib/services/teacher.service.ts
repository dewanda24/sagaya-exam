import { queryPostgres, withTransaction } from '../core/postgres';
import { User, TeacherSubject, TeacherClass } from '../core/types';
import { hashPassword } from '../core/auth';
import { AuditService } from './audit.service';

export interface ImportTeacherItem {
  username: string;
  fullName: string;
  nip?: string;
  nuptk?: string;
  phone?: string;
  password?: string;
  subjects?: string[]; // Code or name
}

export class TeacherService {
  /**
   * Mengambil daftar guru di sekolah dengan relasi mata pelajaran dan kelas yang diampu.
   */
  static async listTeachers(
    schoolId: string,
    filters?: {
      search?: string;
      isActive?: boolean;
    }
  ): Promise<
    (User & {
      assignedSubjectsList: TeacherSubject[];
      assignedClassesList: TeacherClass[];
    })[]
  > {
    let sql = `
      SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.created_at, 
             u.nip, u.nuptk, u.phone, u.school_id, u.last_login_at, u.session_version,
             s.name as school_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE u.school_id = $1 AND u.role = 'GURU'
    `;
    const params: any[] = [schoolId];

    if (filters?.isActive !== undefined) {
      params.push(filters.isActive);
      sql += ` AND u.is_active = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.nip ILIKE $${params.length} OR u.nuptk ILIKE $${params.length})`;
    }

    sql += ` ORDER BY u.full_name ASC;`;

    const res = await queryPostgres(sql, params);
    if (res.rows.length === 0) return [];

    const teacherIds = res.rows.map((r: any) => r.id);

    // Ambil seluruh relasi teacher_subjects untuk sekolah ini
    const tsRes = await queryPostgres(
      `SELECT ts.id, ts.school_id, ts.teacher_id, ts.subject_id, sub.name as subject_name, sub.code as subject_code
       FROM teacher_subjects ts
       JOIN subjects sub ON ts.subject_id = sub.id
       WHERE ts.school_id = $1 AND ts.teacher_id = ANY($2::uuid[]);`,
      [schoolId, teacherIds]
    );

    const teacherSubjectsMap = new Map<string, TeacherSubject[]>();
    tsRes.rows.forEach((r: any) => {
      const arr = teacherSubjectsMap.get(r.teacher_id) || [];
      arr.push({
        id: r.id,
        schoolId: r.school_id,
        teacherId: r.teacher_id,
        subjectId: r.subject_id,
        subjectName: r.subject_name,
        subjectCode: r.subject_code,
      });
      teacherSubjectsMap.set(r.teacher_id, arr);
    });

    // Ambil seluruh relasi teacher_classes untuk sekolah ini
    const tcRes = await queryPostgres(
      `SELECT tc.id, tc.school_id, tc.teacher_id, tc.class_room_id, tc.subject_id,
              c.name as class_name, sub.name as subject_name
       FROM teacher_classes tc
       JOIN class_rooms c ON tc.class_room_id = c.id
       LEFT JOIN subjects sub ON tc.subject_id = sub.id
       WHERE tc.school_id = $1 AND tc.teacher_id = ANY($2::uuid[]);`,
      [schoolId, teacherIds]
    );

    const teacherClassesMap = new Map<string, TeacherClass[]>();
    tcRes.rows.forEach((r: any) => {
      const arr = teacherClassesMap.get(r.teacher_id) || [];
      arr.push({
        id: r.id,
        schoolId: r.school_id,
        teacherId: r.teacher_id,
        classRoomId: r.class_room_id,
        className: r.class_name,
        subjectId: r.subject_id,
        subjectName: r.subject_name,
      });
      teacherClassesMap.set(r.teacher_id, arr);
    });

    return res.rows.map((r: any) => ({
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      role: r.role,
      schoolId: r.school_id,
      schoolName: r.school_name,
      nip: r.nip,
      nuptk: r.nuptk,
      phone: r.phone,
      isActive: r.is_active,
      sessionVersion: r.session_version,
      lastLoginAt: r.last_login_at,
      createdAt: r.created_at,
      assignedSubjectsList: teacherSubjectsMap.get(r.id) || [],
      assignedClassesList: teacherClassesMap.get(r.id) || [],
    }));
  }

  /**
   * Mengambil detail satu guru.
   */
  static async getTeacherById(schoolId: string, teacherId: string) {
    const list = await this.listTeachers(schoolId);
    return list.find((t) => t.id === teacherId) || null;
  }

  /**
   * Membuat guru baru.
   */
  static async createTeacher(
    schoolId: string,
    data: {
      username: string;
      fullName: string;
      password: string;
      nip?: string;
      nuptk?: string;
      phone?: string;
      subjectIds?: string[];
    },
    actor: { id: string; username: string; role: string }
  ): Promise<User> {
    const cleanUsername = data.username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Username guru minimal 3 karakter.');
    }
    if (!data.fullName || data.fullName.trim().length < 2) {
      throw new Error('Nama lengkap guru wajib diisi.');
    }
    if (!data.password || data.password.length < 6) {
      throw new Error('Password minimal 6 karakter.');
    }

    const check = await queryPostgres('SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1;', [cleanUsername]);
    if (check.rows.length > 0) {
      throw new Error(`Username '${cleanUsername}' sudah terdaftar.`);
    }

    const passwordHash = await hashPassword(data.password);

    return await withTransaction(async (client) => {
      const userRes = await client.query(
        `INSERT INTO users (
          id, school_id, username, password_hash, full_name, role, is_active, nip, nuptk, phone, session_version
         ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, 'GURU', true, $5, $6, $7, 0
         ) RETURNING *;`,
        [
          schoolId,
          cleanUsername,
          passwordHash,
          data.fullName.trim(),
          data.nip?.trim() || null,
          data.nuptk?.trim() || null,
          data.phone?.trim() || null,
        ]
      );

      const teacher = userRes.rows[0];

      // Assign subjects if provided
      if (data.subjectIds && data.subjectIds.length > 0) {
        for (const subId of data.subjectIds) {
          await client.query(
            `INSERT INTO teacher_subjects (school_id, teacher_id, subject_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (school_id, teacher_id, subject_id) DO NOTHING;`,
            [schoolId, teacher.id, subId]
          );
        }
      }

      await AuditService.createLog({
        action: 'TEACHER_CREATED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'TEACHER',
        resourceId: teacher.id,
        details: { username: cleanUsername, fullName: data.fullName, nip: data.nip },
      });

      return {
        id: teacher.id,
        username: teacher.username,
        fullName: teacher.full_name,
        role: teacher.role,
        schoolId: teacher.school_id,
        nip: teacher.nip,
        nuptk: teacher.nuptk,
        phone: teacher.phone,
        isActive: teacher.is_active,
        createdAt: teacher.created_at,
      };
    });
  }

  /**
   * Update data guru.
   */
  static async updateTeacher(
    schoolId: string,
    teacherId: string,
    data: {
      fullName?: string;
      nip?: string;
      nuptk?: string;
      phone?: string;
      subjectIds?: string[];
    },
    actor: { id: string; username: string; role: string }
  ): Promise<User> {
    return await withTransaction(async (client) => {
      const userRes = await client.query(
        `UPDATE users SET
          full_name = COALESCE($1, full_name),
          nip = COALESCE($2, nip),
          nuptk = COALESCE($3, nuptk),
          phone = COALESCE($4, phone)
         WHERE id = $5 AND school_id = $6 AND role = 'GURU'
         RETURNING *;`,
        [
          data.fullName?.trim(),
          data.nip?.trim(),
          data.nuptk?.trim(),
          data.phone?.trim(),
          teacherId,
          schoolId,
        ]
      );

      if (userRes.rows.length === 0) {
        throw new Error('Guru tidak ditemukan di sekolah ini.');
      }

      // Update subject assignments if explicitly passed
      if (data.subjectIds !== undefined) {
        await client.query(`DELETE FROM teacher_subjects WHERE school_id = $1 AND teacher_id = $2;`, [
          schoolId,
          teacherId,
        ]);

        for (const subId of data.subjectIds) {
          await client.query(
            `INSERT INTO teacher_subjects (school_id, teacher_id, subject_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (school_id, teacher_id, subject_id) DO NOTHING;`,
            [schoolId, teacherId, subId]
          );
        }
      }

      await AuditService.createLog({
        action: 'TEACHER_UPDATED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'TEACHER',
        resourceId: teacherId,
        details: { fullName: data.fullName, nip: data.nip },
      });

      const updated = userRes.rows[0];
      return {
        id: updated.id,
        username: updated.username,
        fullName: updated.full_name,
        role: updated.role,
        schoolId: updated.school_id,
        nip: updated.nip,
        nuptk: updated.nuptk,
        phone: updated.phone,
        isActive: updated.is_active,
        createdAt: updated.created_at,
      };
    });
  }

  /**
   * Menugaskan relasi Guru - Kelas - Mata Pelajaran.
   */
  static async assignTeacherClasses(
    schoolId: string,
    teacherId: string,
    assignments: { classRoomId: string; subjectId?: string }[],
    actor: { id: string; username: string; role: string }
  ): Promise<void> {
    await withTransaction(async (client) => {
      await client.query(`DELETE FROM teacher_classes WHERE school_id = $1 AND teacher_id = $2;`, [
        schoolId,
        teacherId,
      ]);

      for (const a of assignments) {
        await client.query(
          `INSERT INTO teacher_classes (school_id, teacher_id, class_room_id, subject_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (school_id, teacher_id, class_room_id, subject_id) DO NOTHING;`,
          [schoolId, teacherId, a.classRoomId, a.subjectId || null]
        );
      }

      await AuditService.createLog({
        action: 'TEACHER_CLASSES_ASSIGNED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'TEACHER',
        resourceId: teacherId,
        details: { assignmentsCount: assignments.length },
      });
    });
  }

  /**
   * Preview import guru (CSV/XLSX).
   */
  static async previewImport(
    schoolId: string,
    rows: ImportTeacherItem[]
  ): Promise<{
    validRows: ImportTeacherItem[];
    invalidRows: { row: ImportTeacherItem; errors: string[] }[];
    totalRows: number;
    duplicateInDbCount: number;
  }> {
    if (!rows || rows.length === 0) {
      throw new Error('File import guru tidak memiliki baris data.');
    }

    const usernames = rows.map((r) => r.username?.trim().toLowerCase()).filter(Boolean);
    const existingUsersRes = await queryPostgres(
      `SELECT LOWER(username) as username FROM users WHERE LOWER(username) = ANY($1::text[]);`,
      [usernames]
    );
    const existingUsernames = new Set(existingUsersRes.rows.map((r: any) => r.username));

    const seenUsernamesInFile = new Set<string>();
    const validRows: ImportTeacherItem[] = [];
    const invalidRows: { row: ImportTeacherItem; errors: string[] }[] = [];
    let duplicateInDbCount = 0;

    for (const r of rows) {
      const errors: string[] = [];
      const cleanUsername = r.username?.trim().toLowerCase();
      const cleanName = r.fullName?.trim();

      if (!cleanUsername) errors.push('Username wajib diisi');
      if (!cleanName) errors.push('Nama Lengkap guru wajib diisi');

      if (cleanUsername) {
        if (seenUsernamesInFile.has(cleanUsername)) {
          errors.push(`Duplikasi username dalam file: ${cleanUsername}`);
        } else {
          seenUsernamesInFile.add(cleanUsername);
        }

        if (existingUsernames.has(cleanUsername)) {
          duplicateInDbCount++;
          errors.push(`Username '${cleanUsername}' sudah terdaftar di sistem`);
        }
      }

      const item: ImportTeacherItem = {
        username: cleanUsername,
        fullName: cleanName,
        nip: r.nip?.trim(),
        nuptk: r.nuptk?.trim(),
        phone: r.phone?.trim(),
        password: r.password?.trim() || 'Guru123!',
      };

      if (errors.length > 0) {
        invalidRows.push({ row: item, errors });
      } else {
        validRows.push(item);
      }
    }

    return {
      validRows,
      invalidRows,
      totalRows: rows.length,
      duplicateInDbCount,
    };
  }

  /**
   * Commit import guru atomic transaction.
   */
  static async commitImport(
    schoolId: string,
    teachers: ImportTeacherItem[],
    actor: { id: string; username: string; role: string }
  ): Promise<{ insertedCount: number }> {
    return await withTransaction(async (client) => {
      let insertedCount = 0;

      for (const t of teachers) {
        const hash = await hashPassword(t.password || 'Guru123!');
        await client.query(
          `INSERT INTO users (
            id, school_id, username, password_hash, full_name, role, is_active, nip, nuptk, phone, session_version
           ) VALUES (
            uuid_generate_v4(), $1, $2, $3, $4, 'GURU', true, $5, $6, $7, 0
           );`,
          [
            schoolId,
            t.username.toLowerCase(),
            hash,
            t.fullName,
            t.nip || null,
            t.nuptk || null,
            t.phone || null,
          ]
        );
        insertedCount++;
      }

      await AuditService.createLog({
        action: 'TEACHERS_IMPORTED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'TEACHER',
        resourceId: schoolId,
        details: { insertedCount },
      });

      return { insertedCount };
    });
  }
}
