import { queryPostgres, withTransaction } from '../core/postgres';
import { AcademicYear, Semester } from '../core/types';
import { AuditService } from './audit.service';

export class AcademicYearService {
  /**
   * Mengambil seluruh tahun ajaran beserta semester di sekolah.
   */
  static async listAcademicYears(schoolId: string): Promise<AcademicYear[]> {
    const yearsRes = await queryPostgres(
      `SELECT * FROM academic_years WHERE school_id = $1 ORDER BY start_date DESC;`,
      [schoolId]
    );

    if (yearsRes.rows.length === 0) return [];

    const semestersRes = await queryPostgres(
      `SELECT * FROM semesters WHERE school_id = $1 ORDER BY name ASC;`,
      [schoolId]
    );

    const semesterMap = new Map<string, Semester[]>();
    semestersRes.rows.forEach((s: any) => {
      const arr = semesterMap.get(s.academic_year_id) || [];
      arr.push({
        id: s.id,
        academicYearId: s.academic_year_id,
        schoolId: s.school_id,
        name: s.name,
        status: s.status,
        createdAt: s.created_at,
      });
      semesterMap.set(s.academic_year_id, arr);
    });

    return yearsRes.rows.map((r: any) => ({
      id: r.id,
      schoolId: r.school_id,
      name: r.name,
      startDate: String(r.start_date).slice(0, 10),
      endDate: String(r.end_date).slice(0, 10),
      status: r.status,
      createdAt: r.created_at,
      semesters: semesterMap.get(r.id) || [],
    }));
  }

  /**
   * Mengambil detail satu tahun ajaran.
   */
  static async getAcademicYearById(schoolId: string, yearId: string): Promise<AcademicYear | null> {
    const list = await this.listAcademicYears(schoolId);
    return list.find((y) => y.id === yearId) || null;
  }

  /**
   * Membuat tahun ajaran baru dan otomatis menginisiasi Semester 1 & 2.
   * Jika status ACTIVE, ubah tahun ajaran lain menjadi CLOSED/DRAFT.
   */
  static async createAcademicYear(
    schoolId: string,
    data: {
      name: string;
      startDate: string;
      endDate: string;
      status?: 'DRAFT' | 'ACTIVE' | 'CLOSED';
    },
    actor: { id: string; username: string; role: string }
  ): Promise<AcademicYear> {
    const cleanName = data.name.trim();
    if (!cleanName) {
      throw new Error('Nama tahun ajaran wajib diisi (contoh: 2026/2027).');
    }
    if (!data.startDate || !data.endDate) {
      throw new Error('Tanggal mulai dan selesai wajib diisi.');
    }
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new Error('Tanggal mulai harus lebih awal daripada tanggal selesai.');
    }

    const check = await queryPostgres(
      `SELECT id FROM academic_years WHERE school_id = $1 AND name = $2 LIMIT 1;`,
      [schoolId, cleanName]
    );
    if (check.rows.length > 0) {
      throw new Error(`Tahun ajaran '${cleanName}' sudah ada di sekolah ini.`);
    }

    const status = data.status || 'DRAFT';

    return await withTransaction(async (client) => {
      // Jika status ACTIVE, set tahun ajaran aktif lain menjadi CLOSED
      if (status === 'ACTIVE') {
        await client.query(
          `UPDATE academic_years SET status = 'CLOSED' WHERE school_id = $1 AND status = 'ACTIVE';`,
          [schoolId]
        );
      }

      const res = await client.query(
        `INSERT INTO academic_years (id, school_id, name, start_date, end_date, status)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5)
         RETURNING *;`,
        [schoolId, cleanName, data.startDate, data.endDate, status]
      );

      const created = res.rows[0];

      // Buat default semester 1 dan semester 2
      await client.query(
        `INSERT INTO semesters (id, academic_year_id, school_id, name, status)
         VALUES 
           (uuid_generate_v4(), $1, $2, 'Semester Ganjil', $3),
           (uuid_generate_v4(), $1, $2, 'Semester Genap', 'DRAFT');`,
        [created.id, schoolId, status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT']
      );

      await AuditService.createLog({
        action: 'ACADEMIC_YEAR_CREATED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'ACADEMIC_YEAR',
        resourceId: created.id,
        details: { name: cleanName, status },
      });

      return (await this.getAcademicYearById(schoolId, created.id))!;
    });
  }

  /**
   * Update tahun ajaran.
   */
  static async updateAcademicYear(
    schoolId: string,
    yearId: string,
    data: {
      name?: string;
      startDate?: string;
      endDate?: string;
      status?: 'DRAFT' | 'ACTIVE' | 'CLOSED';
    },
    actor: { id: string; username: string; role: string }
  ): Promise<AcademicYear> {
    const existing = await this.getAcademicYearById(schoolId, yearId);
    if (!existing) {
      throw new Error('Tahun ajaran tidak ditemukan.');
    }

    return await withTransaction(async (client) => {
      if (data.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
        // Enforce single active academic year
        await client.query(
          `UPDATE academic_years SET status = 'CLOSED' WHERE school_id = $1 AND status = 'ACTIVE' AND id != $2;`,
          [schoolId, yearId]
        );
      }

      await client.query(
        `UPDATE academic_years SET
          name = COALESCE($1, name),
          start_date = COALESCE($2, start_date),
          end_date = COALESCE($3, end_date),
          status = COALESCE($4, status)
         WHERE id = $5 AND school_id = $6;`,
        [
          data.name?.trim(),
          data.startDate,
          data.endDate,
          data.status,
          yearId,
          schoolId,
        ]
      );

      await AuditService.createLog({
        action: 'ACADEMIC_YEAR_UPDATED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'ACADEMIC_YEAR',
        resourceId: yearId,
        details: { previousName: existing.name, updatedName: data.name, status: data.status },
      });

      return (await this.getAcademicYearById(schoolId, yearId))!;
    });
  }

  /**
   * Update status semester.
   */
  static async updateSemesterStatus(
    schoolId: string,
    semesterId: string,
    status: 'DRAFT' | 'ACTIVE' | 'CLOSED',
    actor: { id: string; username: string; role: string }
  ): Promise<void> {
    await withTransaction(async (client) => {
      const sem = await client.query('SELECT * FROM semesters WHERE id = $1 AND school_id = $2;', [
        semesterId,
        schoolId,
      ]);
      if (sem.rows.length === 0) {
        throw new Error('Semester tidak ditemukan.');
      }

      if (status === 'ACTIVE') {
        // Nonaktifkan semester lain di tahun ajaran yang sama
        await client.query(
          `UPDATE semesters SET status = 'CLOSED' WHERE academic_year_id = $1 AND id != $2;`,
          [sem.rows[0].academic_year_id, semesterId]
        );
      }

      await client.query('UPDATE semesters SET status = $1 WHERE id = $2 AND school_id = $3;', [
        status,
        semesterId,
        schoolId,
      ]);

      await AuditService.createLog({
        action: 'SEMESTER_STATUS_UPDATED',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'SEMESTER',
        resourceId: semesterId,
        details: { semesterName: sem.rows[0].name, newStatus: status },
      });
    });
  }
}
