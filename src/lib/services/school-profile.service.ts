import { queryPostgres } from '../core/postgres';
import { School } from '../core/types';
import { AuditService } from './audit.service';

export class SchoolProfileService {
  /**
   * Mengambil data profil sekolah berdasarkan schoolId.
   */
  static async getProfile(schoolId: string): Promise<School | null> {
    const res = await queryPostgres(
      `SELECT s.*, 
        (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id AND st.is_active = true) as total_students,
        (SELECT COUNT(*) FROM class_rooms c WHERE c.school_id = s.id) as total_classes,
        (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.role = 'GURU' AND u.is_active = true) as total_teachers,
        (SELECT COUNT(*) FROM exams e WHERE e.school_id = s.id) as total_exams
       FROM schools s 
       WHERE s.id = $1 LIMIT 1;`,
      [schoolId]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    return {
      id: r.id,
      code: r.code,
      name: r.name,
      npsn: r.npsn || '',
      nss: r.nss || '',
      level: r.level,
      status: r.status || (r.is_active ? 'ACTIVE' : 'SUSPENDED'),
      address: r.address || '',
      village: r.village || '',
      district: r.district || '',
      city: r.city || '',
      province: r.province || '',
      postalCode: r.postal_code || '',
      phone: r.phone || '',
      email: r.email || '',
      website: r.website || '',
      principalName: r.principal_name || '',
      principalNip: r.principal_nip || '',
      logoUrl: r.logo_url || '',
      headerTitle1: r.header_title_1 || 'PEMERINTAH PROVINSI / DAERAH',
      headerTitle2: r.header_title_2 || 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
      isActive: r.is_active,
      quotaStudents: r.quota_students || 1000,
      quotaExams: r.quota_exams || 50,
      settings: r.settings || {},
      createdAt: r.created_at,
      stats: {
        totalStudents: parseInt(r.total_students || '0', 10),
        totalClasses: parseInt(r.total_classes || '0', 10),
        totalTeachers: parseInt(r.total_teachers || '0', 10),
        totalExams: parseInt(r.total_exams || '0', 10),
      },
    };
  }

  /**
   * Memperbarui profil sekolah milik admin yang terotentikasi.
   * Admin tidak diizinkan mengubah status global platform, kuota, atau school_id.
   */
  static async updateProfile(
    schoolId: string,
    data: {
      name?: string;
      npsn?: string;
      nss?: string;
      level?: string;
      address?: string;
      village?: string;
      district?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      phone?: string;
      email?: string;
      website?: string;
      principalName?: string;
      principalNip?: string;
      logoUrl?: string;
      headerTitle1?: string;
      headerTitle2?: string;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<School> {
    const existing = await this.getProfile(schoolId);
    if (!existing) {
      throw new Error('Sekolah tidak ditemukan.');
    }

    const res = await queryPostgres(
      `UPDATE schools SET
        name = COALESCE($1, name),
        npsn = COALESCE($2, npsn),
        nss = COALESCE($3, nss),
        level = COALESCE($4, level),
        address = COALESCE($5, address),
        village = COALESCE($6, village),
        district = COALESCE($7, district),
        city = COALESCE($8, city),
        province = COALESCE($9, province),
        postal_code = COALESCE($10, postal_code),
        phone = COALESCE($11, phone),
        email = COALESCE($12, email),
        website = COALESCE($13, website),
        principal_name = COALESCE($14, principal_name),
        principal_nip = COALESCE($15, principal_nip),
        logo_url = COALESCE($16, logo_url),
        header_title_1 = COALESCE($17, header_title_1),
        header_title_2 = COALESCE($18, header_title_2)
       WHERE id = $19
       RETURNING *;`,
      [
        data.name?.trim(),
        data.npsn?.trim(),
        data.nss?.trim(),
        data.level,
        data.address?.trim(),
        data.village?.trim(),
        data.district?.trim(),
        data.city?.trim(),
        data.province?.trim(),
        data.postalCode?.trim(),
        data.phone?.trim(),
        data.email?.trim(),
        data.website?.trim(),
        data.principalName?.trim(),
        data.principalNip?.trim(),
        data.logoUrl?.trim(),
        data.headerTitle1?.trim(),
        data.headerTitle2?.trim(),
        schoolId,
      ]
    );

    const updated = res.rows[0];

    // Audit log
    await AuditService.createLog({
      action: 'SCHOOL_PROFILE_UPDATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'SCHOOL',
      resourceId: schoolId,
      details: {
        previousName: existing.name,
        updatedFields: Object.keys(data).filter((k) => (data as any)[k] !== undefined),
      },
    });

    return (await this.getProfile(schoolId))!;
  }
}
