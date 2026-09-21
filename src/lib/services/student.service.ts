import { queryPostgres, withTransaction } from '../core/postgres';
import { Student } from '../core/types';
import { AuditService } from './audit.service';

export interface StudentFilters {
  search?: string;
  classRoomId?: string;
  gender?: 'L' | 'P';
  status?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export interface ImportStudentItem {
  nis: string;
  nisn: string;
  fullName: string;
  gender?: 'L' | 'P';
  className?: string;
  classRoomId?: string;
  cardAccessCode?: string;
  birthPlace?: string;
  birthDate?: string;
  entryYear?: string;
  rombel?: string;
}

export class StudentService {
  /**
   * Mengambil daftar siswa dengan filter tenant yang ketat.
   */
  static async listStudents(
    schoolId: string,
    filters?: StudentFilters
  ): Promise<{ students: Student[]; total: number }> {
    let countSql = `SELECT COUNT(*) as total FROM students WHERE school_id = $1`;
    let sql = `
      SELECT s.*, c.name as class_room_name, sc.name as school_name
      FROM students s
      LEFT JOIN class_rooms c ON s.class_room_id = c.id
      LEFT JOIN schools sc ON s.school_id = sc.id
      WHERE s.school_id = $1
    `;
    const params: any[] = [schoolId];

    if (filters?.classRoomId) {
      params.push(filters.classRoomId);
      sql += ` AND s.class_room_id = $${params.length}`;
      countSql += ` AND class_room_id = $${params.length}`;
    }

    if (filters?.gender) {
      params.push(filters.gender);
      sql += ` AND s.gender = $${params.length}`;
      countSql += ` AND gender = $${params.length}`;
    }

    if (filters?.status) {
      params.push(filters.status);
      sql += ` AND s.status = $${params.length}`;
      countSql += ` AND status = $${params.length}`;
    }

    if (filters?.isActive !== undefined) {
      params.push(filters.isActive);
      sql += ` AND s.is_active = $${params.length}`;
      countSql += ` AND is_active = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      const searchClause = ` AND (s.full_name ILIKE $${params.length} OR s.nisn ILIKE $${params.length} OR s.nis ILIKE $${params.length})`;
      sql += searchClause;
      countSql += ` AND (full_name ILIKE $${params.length} OR nisn ILIKE $${params.length} OR nis ILIKE $${params.length})`;
    }

    sql += ` ORDER BY c.name ASC NULLS LAST, s.full_name ASC`;

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
    const students: Student[] = dataRes.rows.map((r: any) => ({
      id: r.id,
      schoolId: r.school_id,
      nis: r.nis,
      nisn: r.nisn,
      fullName: r.full_name,
      gender: r.gender,
      classRoomId: r.class_room_id,
      classRoomName: r.class_room_name || 'Belum Ada Kelas',
      cardAccessCode: r.card_access_code,
      photoUrl: r.photo_url,
      birthPlace: r.birth_place,
      birthDate: r.birth_date ? String(r.birth_date).slice(0, 10) : undefined,
      entryYear: r.entry_year,
      rombel: r.rombel,
      status: r.status,
      isActive: r.is_active,
      createdAt: r.created_at,
    }));

    return { students, total };
  }

  /**
   * Mengambil detail satu siswa.
   */
  static async getStudentById(schoolId: string, studentId: string): Promise<Student | null> {
    const res = await queryPostgres(
      `SELECT s.*, c.name as class_room_name 
       FROM students s
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       WHERE s.id = $1 AND s.school_id = $2
       LIMIT 1;`,
      [studentId, schoolId]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    return {
      id: r.id,
      schoolId: r.school_id,
      nis: r.nis,
      nisn: r.nisn,
      fullName: r.full_name,
      gender: r.gender,
      classRoomId: r.class_room_id,
      classRoomName: r.class_room_name || 'Belum Ada Kelas',
      cardAccessCode: r.card_access_code,
      photoUrl: r.photo_url,
      birthPlace: r.birth_place,
      birthDate: r.birth_date ? String(r.birth_date).slice(0, 10) : undefined,
      entryYear: r.entry_year,
      rombel: r.rombel,
      status: r.status,
      isActive: r.is_active,
      createdAt: r.created_at,
    };
  }

  /**
   * Menambahkan siswa baru dengan validasi kuota sekolah.
   */
  static async createStudent(
    schoolId: string,
    data: {
      nis: string;
      nisn: string;
      fullName: string;
      gender?: 'L' | 'P';
      classRoomId?: string;
      cardAccessCode?: string;
      birthPlace?: string;
      birthDate?: string;
      entryYear?: string;
      rombel?: string;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<Student> {
    const cleanNisn = data.nisn.trim();
    const cleanFullName = data.fullName.trim();

    if (!cleanNisn || !cleanFullName) {
      throw new Error('NISN dan Nama Lengkap siswa wajib diisi.');
    }

    // Cek kuota siswa aktif di sekolah
    const quotaRes = await queryPostgres(
      `SELECT quota_students, 
        (SELECT COUNT(*) FROM students WHERE school_id = $1 AND is_active = true) as current_count
       FROM schools WHERE id = $1 LIMIT 1;`,
      [schoolId]
    );

    if (quotaRes.rows.length > 0) {
      const quota = quotaRes.rows[0].quota_students || 1000;
      const current = parseInt(quotaRes.rows[0].current_count || '0', 10);
      if (current >= quota) {
        throw new Error(`Batas kuota siswa aktif terlampaui (${current}/${quota}). Hubungi Dinas/Superadmin untuk penambahan kuota.`);
      }
    }

    // Auto-generate PIN jika tidak diisi
    const pin = data.cardAccessCode?.trim().toUpperCase() || `SG-${Math.floor(1000 + Math.random() * 9000)}`;

    const res = await queryPostgres(
      `INSERT INTO students (
        id, school_id, nis, nisn, full_name, gender, class_room_id, 
        card_access_code, birth_place, birth_date, entry_year, rombel, is_active, status
       ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, 'ACTIVE'
       ) 
       ON CONFLICT (nisn) 
       DO UPDATE SET
        school_id = EXCLUDED.school_id,
        nis = EXCLUDED.nis,
        full_name = EXCLUDED.full_name,
        gender = EXCLUDED.gender,
        class_room_id = COALESCE(EXCLUDED.class_room_id, students.class_room_id),
        card_access_code = COALESCE(EXCLUDED.card_access_code, students.card_access_code)
       RETURNING id;`,
      [
        schoolId,
        data.nis?.trim() || cleanNisn,
        cleanNisn,
        cleanFullName,
        data.gender || 'L',
        data.classRoomId || null,
        pin,
        data.birthPlace?.trim() || null,
        data.birthDate || null,
        data.entryYear?.trim() || null,
        data.rombel?.trim() || null,
      ]
    );

    const studentId = res.rows[0].id;

    await AuditService.createLog({
      action: 'STUDENT_CREATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'STUDENT',
      resourceId: studentId,
      details: { nisn: cleanNisn, fullName: cleanFullName },
    });

    return (await this.getStudentById(schoolId, studentId))!;
  }

  /**
   * Memperbarui data siswa.
   */
  static async updateStudent(
    schoolId: string,
    studentId: string,
    data: {
      nis?: string;
      nisn?: string;
      fullName?: string;
      gender?: 'L' | 'P';
      classRoomId?: string | null;
      cardAccessCode?: string;
      birthPlace?: string;
      birthDate?: string;
      entryYear?: string;
      rombel?: string;
      status?: 'ACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'DROPOUT';
      isActive?: boolean;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<Student> {
    const existing = await this.getStudentById(schoolId, studentId);
    if (!existing) {
      throw new Error('Siswa tidak ditemukan di sekolah ini.');
    }

    await queryPostgres(
      `UPDATE students SET
        nis = COALESCE($1, nis),
        nisn = COALESCE($2, nisn),
        full_name = COALESCE($3, full_name),
        gender = COALESCE($4, gender),
        class_room_id = $5,
        card_access_code = COALESCE($6, card_access_code),
        birth_place = COALESCE($7, birth_place),
        birth_date = COALESCE($8, birth_date),
        entry_year = COALESCE($9, entry_year),
        rombel = COALESCE($10, rombel),
        status = COALESCE($11, status),
        is_active = COALESCE($12, is_active)
       WHERE id = $13 AND school_id = $14;`,
      [
        data.nis?.trim(),
        data.nisn?.trim(),
        data.fullName?.trim(),
        data.gender,
        data.classRoomId !== undefined ? data.classRoomId : existing.classRoomId,
        data.cardAccessCode?.trim().toUpperCase(),
        data.birthPlace?.trim(),
        data.birthDate,
        data.entryYear?.trim(),
        data.rombel?.trim(),
        data.status,
        data.isActive !== undefined ? data.isActive : existing.isActive,
        studentId,
        schoolId,
      ]
    );

    await AuditService.createLog({
      action: 'STUDENT_UPDATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'STUDENT',
      resourceId: studentId,
      details: { nisn: existing.nisn, fullName: existing.fullName },
    });

    return (await this.getStudentById(schoolId, studentId))!;
  }

  /**
   * Reset PIN akses kartu ujian siswa.
   */
  static async resetPin(
    schoolId: string,
    studentId: string,
    actor: { id: string; username: string; role: string }
  ): Promise<{ newPin: string }> {
    const existing = await this.getStudentById(schoolId, studentId);
    if (!existing) {
      throw new Error('Siswa tidak ditemukan di sekolah ini.');
    }

    const newPin = `SG-${Math.floor(1000 + Math.random() * 9000)}`;
    await queryPostgres(`UPDATE students SET card_access_code = $1 WHERE id = $2 AND school_id = $3;`, [
      newPin,
      studentId,
      schoolId,
    ]);

    await AuditService.createLog({
      action: 'STUDENT_PIN_RESET',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'STUDENT',
      resourceId: studentId,
      details: { studentName: existing.fullName, nisn: existing.nisn, newPin },
    });

    return { newPin };
  }

  /**
   * Pindahkan siswa secara massal ke kelas tujuan.
   */
  static async bulkAssignClass(
    schoolId: string,
    studentIds: string[],
    targetClassId: string,
    actor: { id: string; username: string; role: string }
  ): Promise<{ affectedCount: number }> {
    if (!studentIds || studentIds.length === 0) {
      throw new Error('Pilih minimal satu siswa untuk dipindahkan kelas.');
    }

    const classCheck = await queryPostgres('SELECT id, name FROM class_rooms WHERE id = $1 AND school_id = $2;', [
      targetClassId,
      schoolId,
    ]);
    if (classCheck.rows.length === 0) {
      throw new Error('Kelas tujuan tidak valid.');
    }

    const targetClassName = classCheck.rows[0].name;

    const res = await queryPostgres(
      `UPDATE students SET class_room_id = $1 
       WHERE id = ANY($2::uuid[]) AND school_id = $3;`,
      [targetClassId, studentIds, schoolId]
    );

    const affectedCount = res.rowCount || 0;

    await AuditService.createLog({
      action: 'STUDENTS_BULK_CLASS_ASSIGNED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'CLASS',
      resourceId: targetClassId,
      details: { targetClassName, affectedCount, studentIdsCount: studentIds.length },
    });

    return { affectedCount };
  }

  /**
   * Hapus satu siswa.
   */
  static async deleteStudent(
    schoolId: string,
    studentId: string,
    actor: { id: string; username: string; role: string }
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.getStudentById(schoolId, studentId);
    if (!existing) {
      throw new Error('Siswa tidak ditemukan di sekolah ini.');
    }

    await queryPostgres(`DELETE FROM students WHERE id = $1 AND school_id = $2;`, [studentId, schoolId]);

    await AuditService.createLog({
      action: 'STUDENT_DELETED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'STUDENT',
      resourceId: studentId,
      details: { nisn: existing.nisn, fullName: existing.fullName },
      severity: 'WARNING',
    });

    return { success: true, message: `Siswa '${existing.fullName}' berhasil dihapus.` };
  }

  /**
   * Multi-Step Import Siswa: Preview & Validation Step.
   * Melakukan validasi kolom, deteksi duplikasi dalam file maupun database, dan memetakan kelas.
   */
  static async previewImport(
    schoolId: string,
    rows: ImportStudentItem[]
  ): Promise<{
    validRows: ImportStudentItem[];
    invalidRows: { row: ImportStudentItem; errors: string[] }[];
    totalRows: number;
    duplicateInDbCount: number;
  }> {
    if (!rows || rows.length === 0) {
      throw new Error('File import tidak memiliki data yang valid.');
    }

    // Ambil daftar kelas sekolah untuk mapping otomatis
    const classesRes = await queryPostgres('SELECT id, name FROM class_rooms WHERE school_id = $1;', [schoolId]);
    const classMap = new Map<string, string>();
    classesRes.rows.forEach((c: any) => classMap.set(c.name.trim().toLowerCase(), c.id));

    // Ambil NISN yang sudah ada di database untuk sekolah ini
    const nisnList = rows.map((r) => r.nisn?.trim()).filter(Boolean);
    const existingNisnRes = await queryPostgres(
      `SELECT nisn FROM students WHERE school_id = $1 AND nisn = ANY($2::text[]);`,
      [schoolId, nisnList]
    );
    const existingNisns = new Set(existingNisnRes.rows.map((r: any) => r.nisn));

    const seenNisnsInFile = new Set<string>();
    const validRows: ImportStudentItem[] = [];
    const invalidRows: { row: ImportStudentItem; errors: string[] }[] = [];
    let duplicateInDbCount = 0;

    for (const r of rows) {
      const errors: string[] = [];
      const cleanNisn = r.nisn?.toString().trim();
      const cleanName = r.fullName?.toString().trim();

      if (!cleanNisn) errors.push('NISN wajib diisi');
      if (!cleanName) errors.push('Nama Lengkap wajib diisi');

      if (cleanNisn) {
        if (seenNisnsInFile.has(cleanNisn)) {
          errors.push(`Duplikasi NISN dalam file: ${cleanNisn}`);
        } else {
          seenNisnsInFile.add(cleanNisn);
        }

        if (existingNisns.has(cleanNisn)) {
          duplicateInDbCount++;
          // Bukan error fatal, melainkan flag untuk update
        }
      }

      // Map kelas jika diisi
      let matchedClassId = r.classRoomId;
      if (!matchedClassId && r.className) {
        const found = classMap.get(r.className.trim().toLowerCase());
        if (found) {
          matchedClassId = found;
        }
      }

      const item: ImportStudentItem = {
        nis: r.nis?.toString().trim() || cleanNisn,
        nisn: cleanNisn,
        fullName: cleanName,
        gender: (r.gender?.toString().trim().toUpperCase() === 'P' ? 'P' : 'L') as 'L' | 'P',
        className: r.className?.toString().trim(),
        classRoomId: matchedClassId,
        cardAccessCode: r.cardAccessCode?.toString().trim() || `SG-${Math.floor(1000 + Math.random() * 9000)}`,
        birthPlace: r.birthPlace?.toString().trim(),
        birthDate: r.birthDate?.toString().trim(),
        entryYear: r.entryYear?.toString().trim(),
        rombel: r.rombel?.toString().trim(),
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
   * Multi-Step Import Siswa: Atomic Commit Step.
   * Eksekusi dalam PostgreSQL transaction; jika ada error fatal, lakukan rollback.
   */
  static async commitImport(
    schoolId: string,
    students: ImportStudentItem[],
    actor: { id: string; username: string; role: string }
  ): Promise<{ insertedCount: number; updatedCount: number }> {
    if (!students || students.length === 0) {
      throw new Error('Tidak ada data siswa yang valid untuk diimpor.');
    }

    return await withTransaction(async (client) => {
      let insertedCount = 0;
      let updatedCount = 0;

      for (const s of students) {
        const res = await client.query(
          `INSERT INTO students (
            id, school_id, nis, nisn, full_name, gender, class_room_id, 
            card_access_code, birth_place, birth_date, entry_year, rombel, is_active, status
           ) VALUES (
            uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, 'ACTIVE'
           )
           ON CONFLICT (nisn) DO UPDATE SET
            school_id = EXCLUDED.school_id,
            nis = EXCLUDED.nis,
            full_name = EXCLUDED.full_name,
            gender = EXCLUDED.gender,
            class_room_id = COALESCE(EXCLUDED.class_room_id, students.class_room_id),
            birth_place = COALESCE(EXCLUDED.birth_place, students.birth_place),
            birth_date = COALESCE(EXCLUDED.birth_date, students.birth_date),
            entry_year = COALESCE(EXCLUDED.entry_year, students.entry_year),
            rombel = COALESCE(EXCLUDED.rombel, students.rombel)
           RETURNING (xmax = 0) AS is_inserted;`,
          [
            schoolId,
            s.nis || s.nisn,
            s.nisn,
            s.fullName,
            s.gender || 'L',
            s.classRoomId || null,
            s.cardAccessCode || `SG-${Math.floor(1000 + Math.random() * 9000)}`,
            s.birthPlace || null,
            s.birthDate || null,
            s.entryYear || null,
            s.rombel || null,
          ]
        );

        if (res.rows[0]?.is_inserted) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      }

      await AuditService.createLog({
        action: 'STUDENTS_IMPORTED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'STUDENT',
        resourceId: schoolId,
        details: { totalProcessed: students.length, insertedCount, updatedCount },
      });

      return { insertedCount, updatedCount };
    });
  }
}
