import { queryPostgres } from '../core/postgres';
import { AuditService } from './audit.service';

export interface SchoolSettingsData {
  displayName?: string;
  logoUrl?: string;
  timezone?: string;
  studentNumberFormat?: string;
  defaultDurationMinutes?: number;
  defaultShowScorePolicy?: string;
  headerTitle1?: string;
  headerTitle2?: string;
  examRulesNotice?: string;
  enableTabViolationWarning?: boolean;
}

export class SchoolSettingsService {
  /**
   * Mengambil pengaturan operasional sekolah.
   */
  static async getSettings(schoolId: string): Promise<SchoolSettingsData> {
    const res = await queryPostgres(
      `SELECT settings, name, logo_url, header_title_1, header_title_2 FROM schools WHERE id = $1 LIMIT 1;`,
      [schoolId]
    );

    if (res.rows.length === 0) {
      throw new Error('Sekolah tidak ditemukan.');
    }

    const r = res.rows[0];
    const s = r.settings || {};

    return {
      displayName: s.displayName || r.name,
      logoUrl: r.logo_url || s.logoUrl || '',
      timezone: s.timezone || 'Asia/Jakarta (WIB)',
      studentNumberFormat: s.studentNumberFormat || 'NISN / NIS',
      defaultDurationMinutes: s.defaultDurationMinutes || 90,
      defaultShowScorePolicy: s.defaultShowScorePolicy || 'AFTER_ALL_DONE',
      headerTitle1: r.header_title_1 || 'PEMERINTAH PROVINSI / DAERAH',
      headerTitle2: r.header_title_2 || 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
      examRulesNotice: s.examRulesNotice || 'Dilarang membuka tab lain atau meninggalkan halaman ujian.',
      enableTabViolationWarning: s.enableTabViolationWarning !== false,
    };
  }

  /**
   * Memperbarui pengaturan operasional sekolah.
   * Admin dilarang mengubah system secret atau global security policy.
   */
  static async updateSettings(
    schoolId: string,
    data: SchoolSettingsData,
    actor: { id: string; username: string; role: string }
  ): Promise<SchoolSettingsData> {
    const current = await this.getSettings(schoolId);

    const mergedSettings = {
      ...current,
      ...data,
    };

    await queryPostgres(
      `UPDATE schools SET
        logo_url = COALESCE($1, logo_url),
        header_title_1 = COALESCE($2, header_title_1),
        header_title_2 = COALESCE($3, header_title_2),
        settings = $4
       WHERE id = $5;`,
      [
        data.logoUrl?.trim(),
        data.headerTitle1?.trim(),
        data.headerTitle2?.trim(),
        JSON.stringify(mergedSettings),
        schoolId,
      ]
    );

    await AuditService.createLog({
      action: 'SCHOOL_SETTINGS_UPDATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'SCHOOL_SETTINGS',
      resourceId: schoolId,
      details: { updatedKeys: Object.keys(data) },
    });

    return await this.getSettings(schoolId);
  }
}
