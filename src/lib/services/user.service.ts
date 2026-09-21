import { queryPostgres } from '../core/postgres';
import { hashPassword } from '../core/auth';
import { UserRole } from '../core/types';
import { logAuditEvent } from './audit.service';
import { generateSecureTemporaryPassword } from './school.service';

export interface UserFilter {
  schoolId?: string;
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Mendapatkan daftar pengguna platform (ADMIN, GURU, PENGAWAS).
 * PERATURAN: Siswa TIDAK diikutsertakan (domain sekolah, bukan platform user management).
 */
export async function listPlatformUsers(filter: UserFilter = {}) {
  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(100, Math.max(1, filter.limit || 20));
  const offset = (page - 1) * limit;

  let whereClauses: string[] = ["u.role IN ('SUPER_ADMIN', 'ADMIN', 'GURU', 'PENGAWAS')"];
  let params: any[] = [];

  if (filter.schoolId && filter.schoolId !== 'ALL') {
    params.push(filter.schoolId);
    whereClauses.push(`u.school_id = $${params.length}`);
  }

  if (filter.role && filter.role !== 'ALL') {
    params.push(filter.role.toUpperCase());
    whereClauses.push(`u.role = $${params.length}`);
  }

  if (filter.status && filter.status !== 'ALL') {
    const isActive = filter.status.toUpperCase() === 'ACTIVE';
    params.push(isActive);
    whereClauses.push(`u.is_active = $${params.length}`);
  }

  if (filter.search) {
    params.push(`%${filter.search.trim().toLowerCase()}%`);
    whereClauses.push(
      `(LOWER(u.username) LIKE $${params.length} OR LOWER(u.full_name) LIKE $${params.length} OR LOWER(COALESCE(u.nip, '')) LIKE $${params.length})`
    );
  }

  const whereSql = whereClauses.join(' AND ');

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM users u 
    LEFT JOIN schools s ON u.school_id = s.id 
    WHERE ${whereSql};
  `;
  const totalRes = await queryPostgres(countQuery, params);
  const total = parseInt(totalRes.rows[0]?.total || '0', 10);

  const query = `
    SELECT 
      u.id,
      u.username,
      u.full_name as "fullName",
      u.role,
      u.school_id as "schoolId",
      COALESCE(s.name, 'Platform Global') as "schoolName",
      s.code as "schoolCode",
      u.is_active as "isActive",
      COALESCE(u.session_version, 0) as "sessionVersion",
      COALESCE(u.must_change_password, false) as "mustChangePassword",
      u.last_login_at as "lastLoginAt",
      u.created_at as "createdAt",
      u.nip
    FROM users u
    LEFT JOIN schools s ON u.school_id = s.id
    WHERE ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;

  const res = await queryPostgres(query, [...params, limit, offset]);

  return {
    users: res.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Menonaktifkan akun pengguna dan mencabut seluruh sesi aktifnya (session_version++).
 */
export async function disableUser(
  userId: string,
  reason: string,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const userRes = await queryPostgres(
    `SELECT id, username, full_name, role, school_id FROM users WHERE id = $1 LIMIT 1;`,
    [userId]
  );
  if (userRes.rows.length === 0) throw new Error('Pengguna tidak ditemukan.');
  const user = userRes.rows[0];

  if (user.role === 'SUPER_ADMIN') {
    throw new Error('Tidak dapat menonaktifkan akun Super Administrator.');
  }

  await queryPostgres(
    `UPDATE users SET is_active = false, session_version = session_version + 1 WHERE id = $1;`,
    [userId]
  );

  // Revoke active sessions in user_sessions
  await queryPostgres(
    `UPDATE user_sessions SET is_revoked = true, revoked_reason = $1 WHERE user_id = $2;`,
    [`Akun dinonaktifkan oleh ${actor.fullName}: ${reason || 'Pencegahan keamanan'}`, userId]
  );

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: user.school_id,
    action: 'USER_DISABLED',
    resourceType: 'user',
    resourceId: userId,
    severity: 'WARNING',
    details: {
      targetUsername: user.username,
      targetRole: user.role,
      reason: reason || 'Nonaktifkan oleh administrator platform',
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return { success: true, message: `Akun ${user.username} berhasil dinonaktifkan.` };
}

/**
 * Mengaktifkan kembali akun pengguna.
 */
export async function enableUser(
  userId: string,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const userRes = await queryPostgres(
    `SELECT id, username, full_name, role, school_id FROM users WHERE id = $1 LIMIT 1;`,
    [userId]
  );
  if (userRes.rows.length === 0) throw new Error('Pengguna tidak ditemukan.');
  const user = userRes.rows[0];

  await queryPostgres(
    `UPDATE users SET is_active = true WHERE id = $1;`,
    [userId]
  );

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: user.school_id,
    action: 'USER_ENABLED',
    resourceType: 'user',
    resourceId: userId,
    severity: 'INFO',
    details: {
      targetUsername: user.username,
      targetRole: user.role,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return { success: true, message: `Akun ${user.username} berhasil diaktifkan kembali.` };
}

/**
 * Reset password pengguna dengan temporary password baru yang kuat.
 * Memaksa ganti password pada login pertama dan mencabut sesi lama.
 */
export async function resetUserPassword(
  userId: string,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const userRes = await queryPostgres(
    `SELECT id, username, full_name, role, school_id FROM users WHERE id = $1 LIMIT 1;`,
    [userId]
  );
  if (userRes.rows.length === 0) throw new Error('Pengguna tidak ditemukan.');
  const user = userRes.rows[0];

  const tempPassword = generateSecureTemporaryPassword();
  const passwordHash = hashPassword(tempPassword);

  await queryPostgres(
    `UPDATE users SET 
      password_hash = $1, 
      must_change_password = true, 
      session_version = session_version + 1 
    WHERE id = $2;`,
    [passwordHash, userId]
  );

  // Revoke all sessions
  await queryPostgres(
    `UPDATE user_sessions SET is_revoked = true, revoked_reason = 'Password direset oleh Superadmin' WHERE user_id = $1;`,
    [userId]
  );

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: user.school_id,
    action: 'PASSWORD_RESET',
    resourceType: 'user',
    resourceId: userId,
    severity: 'WARNING',
    details: {
      targetUsername: user.username,
      targetRole: user.role,
      resetBy: actor.fullName,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return {
    success: true,
    tempPassword,
    message: `Password untuk ${user.username} berhasil direset.`,
  };
}

/**
 * Mengubah role pengguna (ADMIN, GURU, PENGAWAS).
 * WAJIB mencabut seluruh sesi aktif (session_version++) dan diaudit.
 */
export async function changeUserRole(
  userId: string,
  newRole: UserRole,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  if (!['ADMIN', 'GURU', 'PENGAWAS'].includes(newRole)) {
    throw new Error(`Role '${newRole}' tidak valid untuk pengguna satuan pendidikan.`);
  }

  const userRes = await queryPostgres(
    `SELECT id, username, full_name, role, school_id FROM users WHERE id = $1 LIMIT 1;`,
    [userId]
  );
  if (userRes.rows.length === 0) throw new Error('Pengguna tidak ditemukan.');
  const user = userRes.rows[0];

  const oldRole = user.role;
  if (oldRole === newRole) {
    throw new Error(`Pengguna sudah memiliki role '${newRole}'.`);
  }

  await queryPostgres(
    `UPDATE users SET role = $1, session_version = session_version + 1 WHERE id = $2;`,
    [newRole, userId]
  );

  await queryPostgres(
    `UPDATE user_sessions SET is_revoked = true, revoked_reason = $1 WHERE user_id = $2;`,
    [`Peran diubah dari ${oldRole} ke ${newRole}`, userId]
  );

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: user.school_id,
    action: 'USER_ROLE_CHANGED',
    resourceType: 'user',
    resourceId: userId,
    severity: 'WARNING',
    details: {
      targetUsername: user.username,
      oldRole,
      newRole,
      changedBy: actor.fullName,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return { success: true, message: `Peran ${user.username} berhasil diubah ke ${newRole}. Sesi lama telah dicabut.` };
}

/**
 * Mencabut seluruh sesi aktif milik seorang pengguna (Force Logout).
 */
export async function forceLogoutUser(
  userId: string,
  reason: string,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const userRes = await queryPostgres(
    `SELECT id, username, role, school_id FROM users WHERE id = $1 LIMIT 1;`,
    [userId]
  );
  if (userRes.rows.length === 0) throw new Error('Pengguna tidak ditemukan.');
  const user = userRes.rows[0];

  await queryPostgres(
    `UPDATE users SET session_version = session_version + 1 WHERE id = $1;`,
    [userId]
  );

  await queryPostgres(
    `UPDATE user_sessions SET is_revoked = true, revoked_reason = $1 WHERE user_id = $2;`,
    [reason || 'Force logout oleh Superadmin', userId]
  );

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: user.school_id,
    action: 'SESSION_REVOKED',
    resourceType: 'user',
    resourceId: userId,
    severity: 'INFO',
    details: {
      targetUsername: user.username,
      reason: reason || 'Pencabutan seluruh sesi aktif oleh Superadmin',
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return { success: true, message: `Seluruh sesi untuk ${user.username} berhasil dicabut.` };
}

export interface CreateUserPayload {
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'GURU' | 'PENGAWAS';
  schoolId?: string | null;
  nip?: string | null;
  customPassword?: string;
}

export interface UpdateUserProfilePayload {
  fullName?: string;
  username?: string;
  nip?: string | null;
  schoolId?: string | null;
}

/**
 * Membuat pengguna platform baru (SUPER_ADMIN, ADMIN, GURU, PENGAWAS).
 */
export async function createPlatformUser(
  payload: CreateUserPayload,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const { username, fullName, role, schoolId, nip, customPassword } = payload;

  if (!username || username.trim().length < 3) {
    throw new Error('Username minimal 3 karakter.');
  }

  if (!fullName || fullName.trim().length < 2) {
    throw new Error('Nama lengkap minimal 2 karakter.');
  }

  if (!['SUPER_ADMIN', 'ADMIN', 'GURU', 'PENGAWAS'].includes(role)) {
    throw new Error(`Role '${role}' tidak valid untuk pengguna platform.`);
  }

  // Jika bukan SUPER_ADMIN, sekolah wajib ditentukan
  if (role !== 'SUPER_ADMIN' && !schoolId) {
    throw new Error('Satuan pendidikan (sekolah) wajib dipilih untuk peran ini.');
  }

  const cleanUsername = username.trim().toLowerCase();

  // Cek duplikasi username
  const existingUser = await queryPostgres(
    `SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1;`,
    [cleanUsername]
  );
  if (existingUser.rows.length > 0) {
    throw new Error(`Username '${cleanUsername}' sudah terdaftar. Silakan pilih username lain.`);
  }

  const rawPassword = customPassword && customPassword.length >= 6 ? customPassword : generateSecureTemporaryPassword();
  const passwordHash = await hashPassword(rawPassword);

  const insertRes = await queryPostgres(
    `INSERT INTO users (
      username, password_hash, full_name, role, school_id, nip,
      is_active, session_version, must_change_password, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, true, 0, true, NOW())
    RETURNING id, username, full_name, role, school_id, nip, created_at;`,
    [
      cleanUsername,
      passwordHash,
      fullName.trim(),
      role,
      role === 'SUPER_ADMIN' ? null : schoolId,
      nip?.trim() || null,
    ]
  );

  const newUser = insertRes.rows[0];

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: newUser.school_id,
    action: 'USER_CREATED',
    resourceType: 'user',
    resourceId: newUser.id,
    severity: 'INFO',
    details: {
      username: newUser.username,
      fullName: newUser.full_name,
      role: newUser.role,
      createdBy: actor.fullName,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return {
    success: true,
    user: newUser,
    tempPassword: rawPassword,
    message: `Pengguna ${newUser.username} berhasil ditambahkan.`,
  };
}

/**
 * Mengubah profil pengguna (Nama, Username, NIP, Sekolah).
 */
export async function updateUserProfile(
  userId: string,
  payload: UpdateUserProfilePayload,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const userRes = await queryPostgres(
    `SELECT id, username, full_name, role, school_id, nip FROM users WHERE id = $1 LIMIT 1;`,
    [userId]
  );
  if (userRes.rows.length === 0) throw new Error('Pengguna tidak ditemukan.');
  const current = userRes.rows[0];

  let targetUsername = current.username;
  if (payload.username && payload.username.trim().toLowerCase() !== current.username.toLowerCase()) {
    const cleanU = payload.username.trim().toLowerCase();
    const dupRes = await queryPostgres(
      `SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2 LIMIT 1;`,
      [cleanU, userId]
    );
    if (dupRes.rows.length > 0) {
      throw new Error(`Username '${cleanU}' sudah digunakan oleh akun lain.`);
    }
    targetUsername = cleanU;
  }

  const updateRes = await queryPostgres(
    `UPDATE users SET
      full_name = COALESCE($1, full_name),
      username = $2,
      nip = $3,
      school_id = CASE WHEN role = 'SUPER_ADMIN' THEN NULL ELSE COALESCE($4, school_id) END
     WHERE id = $5
     RETURNING id, username, full_name as "fullName", role, school_id as "schoolId", nip;`,
    [
      payload.fullName?.trim() || null,
      targetUsername,
      payload.nip !== undefined ? (payload.nip?.trim() || null) : current.nip,
      payload.schoolId || null,
      userId,
    ]
  );

  const updatedUser = updateRes.rows[0];

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: updatedUser.schoolId,
    action: 'USER_UPDATED',
    resourceType: 'user',
    resourceId: userId,
    severity: 'INFO',
    details: {
      previousUsername: current.username,
      newUsername: updatedUser.username,
      updatedBy: actor.fullName,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return {
    success: true,
    user: updatedUser,
    message: `Profil pengguna ${updatedUser.username} berhasil diperbarui.`,
  };
}

/**
 * Menghapus akun pengguna platform dengan validasi keamanan.
 */
export async function deletePlatformUser(
  userId: string,
  reason: string,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  if (userId === actor.id) {
    throw new Error('Anda tidak dapat menghapus akun Anda sendiri.');
  }

  const userRes = await queryPostgres(
    `SELECT id, username, role, school_id FROM users WHERE id = $1 LIMIT 1;`,
    [userId]
  );
  if (userRes.rows.length === 0) throw new Error('Pengguna tidak ditemukan.');
  const user = userRes.rows[0];

  // Cegah menghapus Super Admin terakhir
  if (user.role === 'SUPER_ADMIN') {
    const superCount = await queryPostgres(`SELECT COUNT(*) as count FROM users WHERE role = 'SUPER_ADMIN' AND is_active = true;`);
    const total = parseInt(superCount.rows[0]?.count || '0', 10);
    if (total <= 1) {
      throw new Error('Tidak dapat menghapus satu-satunya akun Super Administrator yang aktif.');
    }
  }

  // Revoke all sessions first
  await queryPostgres(`DELETE FROM user_sessions WHERE user_id = $1;`, [userId]);

  // Coba hapus (jika ada foreign key restriction, alihkan ke nonaktifkan permanen)
  try {
    await queryPostgres(`DELETE FROM users WHERE id = $1;`, [userId]);
  } catch (err: any) {
    // If foreign key constraint prevents deletion, perform soft archive
    await queryPostgres(
      `UPDATE users SET is_active = false, session_version = session_version + 1 WHERE id = $1;`,
      [userId]
    );
  }

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: user.school_id,
    action: 'USER_DELETED',
    resourceType: 'user',
    resourceId: userId,
    severity: 'WARNING',
    details: {
      targetUsername: user.username,
      targetRole: user.role,
      reason: reason || 'Dihapus oleh Superadmin',
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return { success: true, message: `Akun ${user.username} berhasil dihapus.` };
}

/**
 * Mendapatkan jejak audit aktivitas khusus pengguna tertentu.
 */
export async function getUserAuditTrail(userId: string, limit = 20) {
  const safeLimit = Math.min(50, Math.max(1, limit));

  const res = await queryPostgres(
    `SELECT 
      a.id, a.action, a.severity, a.created_at as "createdAt",
      a.ip_address as "ipAddress", a.user_agent as "userAgent",
      a.details_json as details, a.resource_type as "resourceType",
      COALESCE(u.full_name, 'Sistem') as "actorName",
      a.role as "actorRole"
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.user_id = $1::uuid OR a.resource_id = $1::text
    ORDER BY a.created_at DESC
    LIMIT $2;`,
    [userId, safeLimit]
  );

  return res.rows;
}

/**
 * Mendapatkan daftar ringkas sekolah untuk dropdown selector di Manajemen Pengguna.
 */
export async function listSchoolsSimple() {
  const res = await queryPostgres(
    `SELECT id, name, code, level 
     FROM schools 
     WHERE is_active = true 
     ORDER BY name ASC;`
  );
  return res.rows;
}
