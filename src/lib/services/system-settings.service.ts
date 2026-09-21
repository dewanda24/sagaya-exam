import { queryPostgres } from '../core/postgres';
import { logAuditEvent } from './audit.service';

export interface CategorySettings {
  general: {
    platformName: string;
    agencyName: string;
    contactEmail: string;
    operationalMode: 'NORMAL' | 'PEKAN_UJIAN_WILAYAH' | 'MAINTENANCE';
    announcement: string;
  };
  security: {
    sessionExpiryHours: number;
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
    requirePasswordChangeDays: number;
    enforceSingleSession: boolean;
  };
  exam: {
    heartbeatIntervalSeconds: number;
    autosaveIntervalSeconds: number;
    maxTabViolationCount: number;
    defaultPassingGrade: number;
    lateToleranceMinutes: number;
  };
  storage: {
    maxUploadSizeMb: number;
    allowedMimeTypes: string[];
  };
  notification: {
    enableBroadcast: boolean;
    bannerNotice: string;
  };
  maintenance: {
    maintenanceMode: boolean;
    maintenanceMessage: string;
  };
  featureFlags: {
    enableGlobalQuestionBank: boolean;
    enableRegionalExams: boolean;
    enableAutoGrading: boolean;
  };
}

const DEFAULT_SETTINGS: CategorySettings = {
  general: {
    platformName: 'Sagaya Exam',
    agencyName: 'Dinas Pendidikan dan Kebudayaan',
    contactEmail: 'admin@sagaya.edu',
    operationalMode: 'NORMAL',
    announcement: 'Sistem ujian Sagaya beroperasi normal.',
  },
  security: {
    sessionExpiryHours: 12,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    requirePasswordChangeDays: 90,
    enforceSingleSession: false,
  },
  exam: {
    heartbeatIntervalSeconds: 15,
    autosaveIntervalSeconds: 10,
    maxTabViolationCount: 3,
    defaultPassingGrade: 75,
    lateToleranceMinutes: 30,
  },
  storage: {
    maxUploadSizeMb: 10,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'video/mp4'],
  },
  notification: {
    enableBroadcast: true,
    bannerNotice: '',
  },
  maintenance: {
    maintenanceMode: false,
    maintenanceMessage: 'Platform sedang dalam pemeliharaan berkala.',
  },
  featureFlags: {
    enableGlobalQuestionBank: true,
    enableRegionalExams: true,
    enableAutoGrading: true,
  },
};

/**
 * Mendapatkan semua konfigurasi sistem per kategori.
 */
export async function getAllSystemSettings(): Promise<CategorySettings> {
  const res = await queryPostgres(`SELECT key, value_json FROM system_settings;`);
  const dbMap: Record<string, any> = {};
  res.rows.forEach((row) => {
    dbMap[row.key] = row.value_json;
  });

  return {
    general: { ...DEFAULT_SETTINGS.general, ...(dbMap['general'] || {}) },
    security: { ...DEFAULT_SETTINGS.security, ...(dbMap['security'] || {}) },
    exam: { ...DEFAULT_SETTINGS.exam, ...(dbMap['exam'] || {}) },
    storage: { ...DEFAULT_SETTINGS.storage, ...(dbMap['storage'] || {}) },
    notification: { ...DEFAULT_SETTINGS.notification, ...(dbMap['notification'] || {}) },
    maintenance: { ...DEFAULT_SETTINGS.maintenance, ...(dbMap['maintenance'] || {}) },
    featureFlags: { ...DEFAULT_SETTINGS.featureFlags, ...(dbMap['feature_flags'] || {}) },
  };
}

/**
 * Memperbarui konfigurasi sistem kategori tertentu (mencegah penyimpanan secret).
 */
export async function updateCategorySettings(
  category: keyof CategorySettings,
  values: Record<string, any>,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  // CRITICAL SECURITY RULE: Jangan izinkan keys yang terindikasi secrets
  const forbiddenKeywords = ['secret', 'password', 'token', 'database_url', 'direct_url', 'key_private'];
  for (const k of Object.keys(values)) {
    if (forbiddenKeywords.some((f) => k.toLowerCase().includes(f))) {
      throw new Error(`Pengaturan '${k}' ditolak: Rahasia (secrets) tidak boleh disimpan dalam database settings.`);
    }
  }

  const dbKey = category === 'featureFlags' ? 'feature_flags' : category;

  await queryPostgres(
    `INSERT INTO system_settings (key, value_json, description, updated_at)
     VALUES ($1, $2::jsonb, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET
       value_json = EXCLUDED.value_json,
       updated_at = NOW();`,
    [dbKey, JSON.stringify(values), `Pengaturan Kategori ${category}`]
  );

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    action: 'SYSTEM_SETTINGS_UPDATED',
    resourceType: 'system_settings',
    resourceId: category,
    severity: 'INFO',
    details: {
      category,
      updatedFields: Object.keys(values),
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return getAllSystemSettings();
}
