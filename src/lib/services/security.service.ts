import crypto from 'crypto';
import { queryPostgres } from '../core/postgres';
import { logAuditEvent } from './audit.service';

/**
 * Hash token rahasia untuk disimpan di database (menghindari kebocoran token mentah).
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Helper untuk mem-parsing User Agent menjadi nama perangkat dan browser yang manusiawi.
 */
export function parseUserAgentMetadata(uaString?: string | null): { deviceName: string; browser: string; os: string } {
  if (!uaString) {
    return { deviceName: 'Perangkat Tidak Dikenal', browser: 'Browser Web', os: 'OS Tidak Dikenal' };
  }

  let os = 'OS Tidak Dikenal';
  if (/windows/i.test(uaString)) os = 'Windows';
  else if (/macintosh|mac os/i.test(uaString)) os = 'macOS';
  else if (/android/i.test(uaString)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(uaString)) os = 'iOS';
  else if (/linux/i.test(uaString)) os = 'Linux';

  let browser = 'Browser Web';
  if (/edg/i.test(uaString)) browser = 'Microsoft Edge';
  else if (/chrome|crios/i.test(uaString)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(uaString)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(uaString)) browser = 'Apple Safari';
  else if (/opera|opr/i.test(uaString)) browser = 'Opera';

  const deviceName = `${browser} on ${os}`;
  return { deviceName, browser, os };
}

/**
 * Mencatat sesi pengguna saat login berhasil.
 */
export async function recordUserSession(
  userId: string,
  sessionToken: string,
  ipAddress?: string | null,
  userAgent?: string | null,
  sessionVersion = 0,
  durationDays = 7
) {
  try {
    const tokenHash = hashSessionToken(sessionToken);
    const { deviceName } = parseUserAgentMetadata(userAgent);

    const res = await queryPostgres(
      `INSERT INTO user_sessions (
        user_id, session_token_hash, ip_address, user_agent, device_name,
        session_version, is_revoked, last_activity_at, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW() + ($7 || ' days')::INTERVAL, NOW())
      RETURNING id;`,
      [userId, tokenHash, ipAddress || null, userAgent || null, deviceName, sessionVersion, durationDays]
    );

    // Update last_login_at di tabel users
    await queryPostgres(
      `UPDATE users SET last_login_at = NOW(), failed_login_attempts = 0 WHERE id = $1;`,
      [userId]
    );

    return res.rows[0]?.id as string;
  } catch (err) {
    console.error('Failed to record user session in database:', err);
    return null;
  }
}

/**
 * Mendapatkan metrik keamanan komprehensif platform.
 */
export async function getSecurityMetrics() {
  // 1. Active Staff Sessions (last 24h, not revoked)
  const activeSessionsRes = await queryPostgres(`
    SELECT COUNT(*) as count 
    FROM user_sessions 
    WHERE is_revoked = false AND last_activity_at >= NOW() - INTERVAL '24 hours';
  `);

  // 2. Failed Logins (last 24h)
  const failedLoginsRes = await queryPostgres(`
    SELECT COUNT(*) as count 
    FROM audit_logs 
    WHERE action = 'LOGIN_FAILED' AND created_at >= NOW() - INTERVAL '24 hours';
  `);

  // 3. Locked / Disabled Accounts
  const lockedUsersRes = await queryPostgres(`
    SELECT COUNT(*) as count 
    FROM users 
    WHERE is_active = false;
  `);

  // 4. Rate limit hits / Brute force alerts
  const rateLimitAlertsRes = await queryPostgres(`
    SELECT COUNT(*) as count 
    FROM audit_logs 
    WHERE action IN ('RATE_LIMIT_EXCEEDED', 'BRUTE_FORCE_DETECTED') AND created_at >= NOW() - INTERVAL '24 hours';
  `);

  // 5. Active Student Exam Sessions
  const examSessionsRes = await queryPostgres(`
    SELECT COUNT(*) as count 
    FROM exam_sessions 
    WHERE status = 'IN_PROGRESS';
  `);

  // 6. Recent Security Events
  const recentEventsRes = await queryPostgres(`
    SELECT 
      a.id, a.action, a.severity, a.created_at as "createdAt", a.ip_address as "ipAddress",
      a.details_json as details,
      COALESCE(u.full_name, 'Sistem / Tamu') as "actorName",
      a.role as "actorRole",
      COALESCE(s.name, 'Platform Global') as "schoolName"
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN schools s ON a.school_id = s.id
    WHERE a.severity IN ('WARNING', 'CRITICAL') 
       OR a.action IN ('LOGIN_FAILED', 'USER_DISABLED', 'SESSION_REVOKED', 'SCHOOL_SUSPENDED', 'PASSWORD_RESET')
    ORDER BY a.created_at DESC
    LIMIT 10;
  `);

  return {
    metrics: {
      activeSessions: parseInt(activeSessionsRes.rows[0]?.count || '0', 10),
      failedLoginsLast24h: parseInt(failedLoginsRes.rows[0]?.count || '0', 10),
      lockedAccounts: parseInt(lockedUsersRes.rows[0]?.count || '0', 10),
      rateLimitAlerts: parseInt(rateLimitAlertsRes.rows[0]?.count || '0', 10),
      activeStudentSessions: parseInt(examSessionsRes.rows[0]?.count || '0', 10),
    },
    recentEvents: recentEventsRes.rows,
  };
}

/**
 * Mendapatkan daftar sesi aktif staf (Admin, Guru, Pengawas, Superadmin).
 * PERATURAN SECTION 19: Jangan tampilkan session secret / token mentah!
 */
export async function getActiveSessions(page = 1, limit = 20) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  const countRes = await queryPostgres(`
    SELECT COUNT(*) as total FROM user_sessions WHERE is_revoked = false;
  `);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const query = `
    SELECT 
      us.id as "sessionId",
      us.user_id as "userId",
      u.username,
      u.full_name as "fullName",
      u.role,
      u.school_id as "schoolId",
      COALESCE(s.name, 'Platform Global') as "schoolName",
      us.ip_address as "ipAddress",
      us.user_agent as "userAgent",
      us.created_at as "loginTime",
      us.last_activity_at as "lastActivity",
      us.is_revoked as "isRevoked",
      CASE 
        WHEN us.is_revoked = true THEN 'REVOKED'
        WHEN us.last_activity_at < NOW() - INTERVAL '2 hours' THEN 'IDLE'
        ELSE 'ACTIVE'
      END as "sessionStatus"
    FROM user_sessions us
    JOIN users u ON us.user_id = u.id
    LEFT JOIN schools s ON u.school_id = s.id
    WHERE us.is_revoked = false
    ORDER BY us.last_activity_at DESC
    LIMIT $1 OFFSET $2;
  `;

  const res = await queryPostgres(query, [safeLimit, offset]);

  return {
    sessions: res.rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

/**
 * Mencabut sesi aktif tertentu (Revoke Individual Session).
 */
export async function revokeSession(
  sessionId: string,
  reason: string,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  if (!reason || reason.trim().length < 5) {
    throw new Error('Alasan pencabutan sesi wajib diisi minimal 5 karakter.');
  }

  const sessionRes = await queryPostgres(
    `SELECT us.id, us.user_id, u.username, u.role, u.school_id
     FROM user_sessions us
     JOIN users u ON us.user_id = u.id
     WHERE us.id = $1 LIMIT 1;`,
    [sessionId]
  );

  if (sessionRes.rows.length === 0) {
    throw new Error('Sesi tidak ditemukan.');
  }

  const s = sessionRes.rows[0];

  // Invalidate session in user_sessions
  await queryPostgres(
    `UPDATE user_sessions SET is_revoked = true, revoked_reason = $1 WHERE id = $2;`,
    [reason.trim(), sessionId]
  );

  // Increment user's session_version to reject previous JWT
  await queryPostgres(
    `UPDATE users SET session_version = session_version + 1 WHERE id = $1;`,
    [s.user_id]
  );

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: s.school_id,
    action: 'SESSION_REVOKED',
    resourceType: 'session',
    resourceId: sessionId,
    severity: 'WARNING',
    details: {
      targetUsername: s.username,
      targetRole: s.role,
      reason: reason.trim(),
      revokedBy: actor.fullName,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return { success: true, message: `Sesi untuk pengguna ${s.username} berhasil dicabut.` };
}

/**
 * Mendapatkan daftar sesi aktif khusus untuk pengguna yang sedang login.
 * Data difilter dan diformat agar aman (tanpa token mentah / token hash).
 */
export async function getUserActiveSessions(userId: string, currentTokenHash?: string) {
  const query = `
    SELECT 
      id,
      session_token_hash,
      ip_address,
      user_agent,
      device_name,
      last_activity_at,
      expires_at,
      created_at,
      is_revoked
    FROM user_sessions
    WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()
    ORDER BY last_activity_at DESC;
  `;

  const res = await queryPostgres(query, [userId]);

  return res.rows.map((row) => {
    const uaMeta = parseUserAgentMetadata(row.user_agent);
    const isCurrent = Boolean(currentTokenHash && row.session_token_hash === currentTokenHash);

    return {
      id: row.id,
      deviceName: row.device_name || uaMeta.deviceName,
      browser: uaMeta.browser,
      os: uaMeta.os,
      ipAddress: row.ip_address || 'Tidak diketahui',
      createdAt: row.created_at,
      lastActivityAt: row.last_activity_at,
      expiresAt: row.expires_at,
      isCurrent,
    };
  });
}

/**
 * Mencabut sesi tertentu milik pengguna sendiri.
 */
export async function revokeUserSessionById(
  sessionId: string,
  userId: string,
  reason: string,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const sessionRes = await queryPostgres(
    `SELECT us.id, us.user_id, u.username, u.role, u.school_id, us.session_token_hash
     FROM user_sessions us
     JOIN users u ON us.user_id = u.id
     WHERE us.id = $1 AND us.user_id = $2 AND us.is_revoked = false
     LIMIT 1;`,
    [sessionId, userId]
  );

  if (sessionRes.rows.length === 0) {
    throw new Error('Sesi tidak ditemukan atau sudah dicabut sebelumnya.');
  }

  const s = sessionRes.rows[0];

  await queryPostgres(
    `UPDATE user_sessions SET is_revoked = true, revoked_at = NOW(), revoked_reason = $1 WHERE id = $2;`,
    [reason.trim() || 'Dicabut oleh pengguna', sessionId]
  );

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: s.school_id,
    action: 'SESSION_REVOKED',
    resourceType: 'session',
    resourceId: sessionId,
    severity: 'INFO',
    details: {
      targetUsername: s.username,
      reason: reason.trim() || 'Dicabut oleh pengguna',
      revokedBy: actor.fullName,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return { success: true, message: 'Sesi perangkat berhasil dicabut.' };
}

/**
 * Mencabut SELURUH sesi aktif untuk pengguna tertentu (Revoke All Sessions / Force Logout).
 * Melakukan increment session_version pada tabel users agar seluruh token lama seketika invalid.
 */
export async function revokeAllUserSessions(
  targetUserId: string,
  reason: string,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const userRes = await queryPostgres(
    `SELECT id, username, role, school_id FROM users WHERE id = $1 LIMIT 1;`,
    [targetUserId]
  );

  if (userRes.rows.length === 0) {
    throw new Error('Pengguna tidak ditemukan.');
  }

  const u = userRes.rows[0];

  // 1. Increment session_version pada users
  await queryPostgres(
    `UPDATE users SET session_version = COALESCE(session_version, 0) + 1 WHERE id = $1;`,
    [targetUserId]
  );

  // 2. Mark all active sessions as revoked
  await queryPostgres(
    `UPDATE user_sessions 
     SET is_revoked = true, revoked_at = NOW(), revoked_reason = $1 
     WHERE user_id = $2 AND is_revoked = false;`,
    [reason.trim() || 'Semua sesi dicabut', targetUserId]
  );

  const actionName = actor.id === targetUserId ? 'ALL_SESSIONS_REVOKED' : 'FORCE_LOGOUT';

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    schoolId: u.school_id,
    action: actionName,
    resourceType: 'user',
    resourceId: targetUserId,
    severity: 'WARNING',
    details: {
      targetUsername: u.username,
      targetRole: u.role,
      reason: reason.trim() || 'Semua sesi dicabut',
      revokedBy: actor.fullName,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return {
    success: true,
    message: actor.id === targetUserId
      ? 'Seluruh sesi perangkat Anda telah berhasil dicabut.'
      : `Pengguna ${u.username} berhasil di-force logout dari seluruh perangkat.`,
  };
}

