import crypto from 'crypto';
import { queryPostgres } from '../core/postgres';
import { hashPassword } from '../core/auth';
import { logAuditEvent } from './audit.service';

export interface CreateSchoolPayload {
  name: string;
  code: string;
  npsn?: string;
  level: 'SD' | 'SMP' | 'SMA' | 'SMK' | 'MADRASAH' | 'UMUM';
  rayon?: string;
  address?: string;
  phone?: string;
  email?: string;
  principalName?: string;
  principalNip?: string;
  quotaStudents?: number;
  quotaExams?: number;
}

export interface UpdateSchoolPayload {
  name?: string;
  level?: 'SD' | 'SMP' | 'SMA' | 'SMK' | 'MADRASAH' | 'UMUM';
  rayon?: string;
  address?: string;
  phone?: string;
  email?: string;
  principalName?: string;
  principalNip?: string;
  quotaStudents?: number;
  quotaExams?: number;
  headerTitle1?: string;
  headerTitle2?: string;
  logoUrl?: string;
}

export interface SchoolFilter {
  search?: string;
  level?: string;
  status?: string;
  rayon?: string;
  page?: number;
  limit?: number;
}

/**
 * Generate temporary password acak dan kuat (Cryptographic Random).
 * Menghasilkan 12 karakter aman dengan kombinasi huruf besar, kecil, angka, dan simbol.
 */
export function generateSecureTemporaryPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  const bytes = crypto.randomBytes(12);
  let password = '';
  for (let i = 0; i < bytes.length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

/**
 * Mendapatkan daftar sekolah dengan filter, pencarian, dan agregasi statistik.
 */
export async function listSchools(filter: SchoolFilter = {}) {
  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(100, Math.max(1, filter.limit || 20));
  const offset = (page - 1) * limit;

  let whereClauses: string[] = ['1=1'];
  let params: any[] = [];

  if (filter.search) {
    params.push(`%${filter.search.trim().toLowerCase()}%`);
    whereClauses.push(
      `(LOWER(s.name) LIKE $${params.length} OR LOWER(s.code) LIKE $${params.length} OR LOWER(COALESCE(s.npsn, '')) LIKE $${params.length} OR LOWER(COALESCE(s.principal_name, '')) LIKE $${params.length})`
    );
  }

  if (filter.level && filter.level !== 'ALL') {
    params.push(filter.level.toUpperCase());
    whereClauses.push(`s.level = $${params.length}`);
  }

  if (filter.status && filter.status !== 'ALL') {
    params.push(filter.status.toUpperCase());
    whereClauses.push(`UPPER(COALESCE(s.status, CASE WHEN s.is_active THEN 'ACTIVE' ELSE 'SUSPENDED' END)) = $${params.length}`);
  }

  if (filter.rayon && filter.rayon !== 'ALL') {
    params.push(filter.rayon);
    whereClauses.push(`s.rayon = $${params.length}`);
  }

  const whereSql = whereClauses.join(' AND ');

  const countQuery = `SELECT COUNT(*) as total FROM schools s WHERE ${whereSql};`;
  const totalRes = await queryPostgres(countQuery, params);
  const total = parseInt(totalRes.rows[0]?.total || '0', 10);

  const query = `
    SELECT 
      s.*,
      COALESCE(s.status, CASE WHEN s.is_active THEN 'ACTIVE' ELSE 'SUSPENDED' END) as current_status,
      COALESCE(stu.student_count, 0) as total_students,
      COALESCE(cls.class_count, 0) as total_classes,
      COALESCE(ex.exam_count, 0) as total_exams,
      COALESCE(tch.teacher_count, 0) as total_teachers,
      COALESCE(adm.admin_count, 0) as total_admins
    FROM schools s
    LEFT JOIN (
      SELECT school_id, COUNT(*) as student_count FROM students GROUP BY school_id
    ) stu ON s.id = stu.school_id
    LEFT JOIN (
      SELECT school_id, COUNT(*) as class_count FROM class_rooms GROUP BY school_id
    ) cls ON s.id = cls.school_id
    LEFT JOIN (
      SELECT school_id, COUNT(*) as exam_count FROM exams GROUP BY school_id
    ) ex ON s.id = ex.school_id
    LEFT JOIN (
      SELECT school_id, COUNT(*) as teacher_count FROM users WHERE role IN ('GURU', 'PENGAWAS') GROUP BY school_id
    ) tch ON s.id = tch.school_id
    LEFT JOIN (
      SELECT school_id, COUNT(*) as admin_count FROM users WHERE role = 'ADMIN' GROUP BY school_id
    ) adm ON s.id = adm.school_id
    WHERE ${whereSql}
    ORDER BY s.name ASC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;

  const res = await queryPostgres(query, [...params, limit, offset]);

  const schools = res.rows.map((r: any) => ({
    id: r.id,
    code: r.code,
    npsn: r.npsn || r.code,
    rayon: r.rayon || 'Rayon 1 - Pusat',
    name: r.name,
    level: r.level,
    address: r.address,
    phone: r.phone,
    email: r.email,
    principalName: r.principal_name,
    principalNip: r.principal_nip,
    logoUrl: r.logo_url,
    headerTitle1: r.header_title_1,
    headerTitle2: r.header_title_2,
    status: r.current_status,
    isActive: r.current_status === 'ACTIVE',
    quotaStudents: r.quota_students,
    quotaExams: r.quota_exams,
    subscriptionTier: r.subscription_tier || 'TAHUNAN',
    subscriptionExpiresAt: r.subscription_expires_at,
    subscriptionStatus: r.subscription_status || 'ACTIVE',
    settings: r.settings || {},
    createdAt: r.created_at,
    stats: {
      totalStudents: parseInt(r.total_students || '0', 10),
      totalClasses: parseInt(r.total_classes || '0', 10),
      totalExams: parseInt(r.total_exams || '0', 10),
      totalTeachers: parseInt(r.total_teachers || '0', 10),
      totalAdmins: parseInt(r.total_admins || '0', 10),
    },
  }));

  return {
    schools,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Mendapatkan detail lengkap satuan pendidikan beserta ringkasan agregasi read-only.
 */
export async function getSchoolDetail(schoolId: string) {
  const schoolRes = await queryPostgres(
    `SELECT *, COALESCE(status, CASE WHEN is_active THEN 'ACTIVE' ELSE 'SUSPENDED' END) as current_status
     FROM schools WHERE id = $1 LIMIT 1;`,
    [schoolId]
  );

  if (schoolRes.rows.length === 0) {
    throw new Error('Satuan pendidikan tidak ditemukan.');
  }

  const s = schoolRes.rows[0];

  // Admins of this school
  const adminsRes = await queryPostgres(
    `SELECT id, username, full_name as "fullName", role, is_active as "isActive", created_at as "createdAt", last_login_at as "lastLoginAt"
     FROM users WHERE school_id = $1 AND role = 'ADMIN' ORDER BY created_at ASC;`,
    [schoolId]
  );

  // Teachers count & list summary
  const teachersCountRes = await queryPostgres(
    `SELECT COUNT(*) as count FROM users WHERE school_id = $1 AND role IN ('GURU', 'PENGAWAS');`,
    [schoolId]
  );

  // Students count
  const studentsCountRes = await queryPostgres(
    `SELECT COUNT(*) as count FROM students WHERE school_id = $1;`,
    [schoolId]
  );

  // Classes count
  const classesCountRes = await queryPostgres(
    `SELECT COUNT(*) as count FROM class_rooms WHERE school_id = $1;`,
    [schoolId]
  );

  // Subjects count
  const subjectsCountRes = await queryPostgres(
    `SELECT COUNT(*) as count FROM subjects WHERE school_id = $1;`,
    [schoolId]
  );

  // Exams count
  const examsCountRes = await queryPostgres(
    `SELECT COUNT(*) as count FROM exams WHERE school_id = $1;`,
    [schoolId]
  );

  // Recent School Activity Audit Logs
  const auditRes = await queryPostgres(
    `SELECT a.id, a.action, a.severity, a.details_json as details, a.created_at as "createdAt",
            COALESCE(u.full_name, 'Sistem') as "actorName", a.role as "actorRole"
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     WHERE a.school_id = $1
     ORDER BY a.created_at DESC LIMIT 10;`,
    [schoolId]
  );

  return {
    identity: {
      id: s.id,
      code: s.code,
      npsn: s.npsn || s.code,
      name: s.name,
      level: s.level,
      rayon: s.rayon || 'Rayon 1 - Pusat',
      status: s.current_status,
      isActive: s.current_status === 'ACTIVE',
      address: s.address,
      phone: s.phone,
      email: s.email,
      principalName: s.principal_name,
      principalNip: s.principal_nip,
      logoUrl: s.logo_url,
      headerTitle1: s.header_title_1,
      headerTitle2: s.header_title_2,
      quotaStudents: s.quota_students,
      quotaExams: s.quota_exams,
      subscriptionTier: s.subscription_tier || 'TAHUNAN',
      subscriptionExpiresAt: s.subscription_expires_at,
      subscriptionStatus: s.subscription_status || 'ACTIVE',
      createdAt: s.created_at,
    },
    admins: adminsRes.rows,
    summary: {
      totalAdmins: adminsRes.rows.length,
      totalTeachers: parseInt(teachersCountRes.rows[0]?.count || '0', 10),
      totalStudents: parseInt(studentsCountRes.rows[0]?.count || '0', 10),
      totalClasses: parseInt(classesCountRes.rows[0]?.count || '0', 10),
      totalSubjects: parseInt(subjectsCountRes.rows[0]?.count || '0', 10),
      totalExams: parseInt(examsCountRes.rows[0]?.count || '0', 10),
    },
    recentActivities: auditRes.rows,
  };
}

/**
 * Membuat satuan pendidikan baru dan akun Administrator Sekolah awal dengan temporary password acak.
 */
export async function createSchoolWithAdmin(
  payload: CreateSchoolPayload,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  // Normalize & Validate
  const code = payload.code.trim().toUpperCase();
  const name = payload.name.trim();

  if (!code || !name) {
    throw new Error('Kode sekolah dan Nama sekolah wajib diisi.');
  }

  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new Error('Format email sekolah tidak valid.');
  }

  // Check unique code
  const existingCode = await queryPostgres(
    `SELECT id FROM schools WHERE LOWER(code) = LOWER($1) LIMIT 1;`,
    [code]
  );
  if (existingCode.rows.length > 0) {
    throw new Error(`Kode sekolah '${code}' sudah digunakan oleh satuan pendidikan lain.`);
  }

  // Generate temporary credentials
  const tempPassword = generateSecureTemporaryPassword();
  const passwordHash = hashPassword(tempPassword);
  const initialUsername = `admin_${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  // Check username uniqueness
  const existingUser = await queryPostgres(
    `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
    [initialUsername]
  );
  const finalUsername = existingUser.rows.length > 0 ? `${initialUsername}_${Math.floor(100 + Math.random() * 900)}` : initialUsername;

  // Insert School
  const schoolInsertRes = await queryPostgres(
    `INSERT INTO schools (
      code, name, level, npsn, rayon, address, phone, email, 
      principal_name, principal_nip, is_active, status, quota_students, quota_exams, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, 'ACTIVE', $11, $12, NOW())
    RETURNING *;`,
    [
      code,
      name,
      payload.level || 'SMA',
      payload.npsn || code,
      payload.rayon || 'Rayon 1 - Pusat',
      payload.address || null,
      payload.phone || null,
      payload.email || null,
      payload.principalName || null,
      payload.principalNip || null,
      payload.quotaStudents || 1000,
      payload.quotaExams || 50,
    ]
  );

  const school = schoolInsertRes.rows[0];

  // Insert Initial School Admin with must_change_password = true
  const userInsertRes = await queryPostgres(
    `INSERT INTO users (
      school_id, username, password_hash, full_name, role, is_active, session_version, must_change_password, created_at
    ) VALUES ($1, $2, $3, $4, 'ADMIN', true, 0, true, NOW())
    RETURNING id, username, full_name, role;`,
    [
      school.id,
      finalUsername,
      passwordHash,
      `Admin ${name}`,
    ]
  );

  const adminUser = userInsertRes.rows[0];

  // Emit Audit Log
  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: school.id,
    action: 'SCHOOL_CREATED',
    resourceType: 'school',
    resourceId: school.id,
    severity: 'INFO',
    details: {
      schoolName: school.name,
      schoolCode: school.code,
      adminUsername: adminUser.username,
      quotaStudents: school.quota_students,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return {
    school,
    initialAdmin: {
      id: adminUser.id,
      username: adminUser.username,
      tempPassword, // Hanya dikembalikan sekali saat pembuatan untuk dicatat/diserahkan ke admin sekolah
      mustChangePassword: true,
    },
  };
}

/**
 * Mengubah data profil dan kuota sekolah.
 */
export async function updateSchool(
  schoolId: string,
  payload: UpdateSchoolPayload,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const current = await queryPostgres(`SELECT * FROM schools WHERE id = $1 LIMIT 1;`, [schoolId]);
  if (current.rows.length === 0) throw new Error('Satuan pendidikan tidak ditemukan.');

  const res = await queryPostgres(
    `UPDATE schools SET
      name = COALESCE($1, name),
      level = COALESCE($2, level),
      rayon = COALESCE($3, rayon),
      address = COALESCE($4, address),
      phone = COALESCE($5, phone),
      email = COALESCE($6, email),
      principal_name = COALESCE($7, principal_name),
      principal_nip = COALESCE($8, principal_nip),
      quota_students = COALESCE($9, quota_students),
      quota_exams = COALESCE($10, quota_exams),
      header_title_1 = COALESCE($11, header_title_1),
      header_title_2 = COALESCE($12, header_title_2),
      logo_url = COALESCE($13, logo_url)
    WHERE id = $14
    RETURNING *;`,
    [
      payload.name || null,
      payload.level || null,
      payload.rayon || null,
      payload.address || null,
      payload.phone || null,
      payload.email || null,
      payload.principalName || null,
      payload.principalNip || null,
      payload.quotaStudents || null,
      payload.quotaExams || null,
      payload.headerTitle1 || null,
      payload.headerTitle2 || null,
      payload.logoUrl || null,
      schoolId,
    ]
  );

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId,
    action: 'SCHOOL_UPDATED',
    resourceType: 'school',
    resourceId: schoolId,
    severity: 'INFO',
    details: { updatedFields: Object.keys(payload) },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return res.rows[0];
}

/**
 * Mengubah status lifecycle sekolah (ACTIVE, SUSPENDED, ARCHIVED) dengan alasan dan audit.
 */
export async function changeSchoolStatus(
  schoolId: string,
  newStatus: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
  reason: string,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  if (!reason || reason.trim().length < 5) {
    throw new Error('Alasan perubahan status wajib disertakan minimal 5 karakter.');
  }

  const curRes = await queryPostgres(
    `SELECT id, name, code, status, is_active FROM schools WHERE id = $1 LIMIT 1;`,
    [schoolId]
  );
  if (curRes.rows.length === 0) throw new Error('Satuan pendidikan tidak ditemukan.');

  const school = curRes.rows[0];
  const oldStatus = (school.status || (school.is_active ? 'ACTIVE' : 'SUSPENDED')).toUpperCase();

  // Validate state transitions
  if (oldStatus === 'ARCHIVED' && newStatus !== 'ARCHIVED') {
    throw new Error('Satuan pendidikan yang telah diarsipkan (ARCHIVED) tidak dapat diaktifkan kembali.');
  }

  if (oldStatus === newStatus) {
    throw new Error(`Status satuan pendidikan sudah '${newStatus}'.`);
  }

  const isActive = newStatus === 'ACTIVE';

  const updateRes = await queryPostgres(
    `UPDATE schools SET status = $1, is_active = $2 WHERE id = $3 RETURNING *;`,
    [newStatus, isActive, schoolId]
  );

  // If SUSPENDED or ARCHIVED, revoke all sessions for this school's users
  if (newStatus === 'SUSPENDED' || newStatus === 'ARCHIVED') {
    await queryPostgres(
      `UPDATE users SET session_version = session_version + 1 WHERE school_id = $1;`,
      [schoolId]
    );
    await queryPostgres(
      `UPDATE user_sessions SET is_revoked = true, revoked_reason = $1 
       WHERE user_id IN (SELECT id FROM users WHERE school_id = $2);`,
      [`Satuan pendidikan status diubah ke ${newStatus}: ${reason.trim()}`, schoolId]
    );
  }

  // Audit event
  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId,
    action: newStatus === 'SUSPENDED' ? 'SCHOOL_SUSPENDED' : newStatus === 'ARCHIVED' ? 'SCHOOL_ARCHIVED' : 'SCHOOL_ACTIVATED',
    resourceType: 'school',
    resourceId: schoolId,
    severity: newStatus === 'SUSPENDED' || newStatus === 'ARCHIVED' ? 'WARNING' : 'INFO',
    details: {
      oldStatus,
      newStatus,
      reason: reason.trim(),
      schoolName: school.name,
      schoolCode: school.code,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return updateRes.rows[0];
}
