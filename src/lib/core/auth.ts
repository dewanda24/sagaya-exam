// SECURITY: AUTH_SECRET wajib di-set via environment variable.
// Application akan throw error saat startup jika tidak dikonfigurasi.
const AUTH_SECRET = process.env.AUTH_SECRET;

if (!AUTH_SECRET) {
  // Di Edge Runtime (middleware) kita tidak bisa throw saat module load,
  // tapi kita set flag agar fungsi yang membutuhkannya menolak request.
  console.error(
    '[CRITICAL SECURITY] AUTH_SECRET tidak dikonfigurasi di environment variables. ' +
    'Seluruh operasi session akan ditolak sampai variabel ini di-set.'
  );
}

function requireAuthSecret(): string {
  if (!AUTH_SECRET) {
    throw new Error(
      'Konfigurasi keamanan tidak lengkap: AUTH_SECRET wajib dikonfigurasi di environment variables production.'
    );
  }
  return AUTH_SECRET;
}

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'GURU' | 'PENGAWAS';
  schoolId?: string | null;
  schoolName?: string | null;
  sessionVersion?: number;
  sessionId?: string;
}

export interface StudentSessionPayload {
  sessionId: string;
  examId: string;
  participantId: string;
  studentId: string;
  schoolId?: string;
  studentName?: string;
  deviceId?: string;
  deviceFingerprint?: string;
  sessionVersion?: number;
  exp: number;
}

export interface StudentAuthContext {
  sessionId: string;
  examId: string;
  participantId: string;
  studentId: string;
  schoolId: string;
  studentName: string;
  nisn: string;
  className?: string;
  assignedPackage?: string;
  deviceId: string;
  sessionVersion: number;
  status: string;
  startedAt: string | null;
  expiresAt: string;
  durationMinutes: number;
  examTitle: string;
  subjectName: string;
  isExpired: boolean;
  remainingSeconds: number;
  tabViolationCount: number;
}


function base64UrlEncode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64url');
  }
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64url').toString('utf8');
  }
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

async function getCryptoKey() {
  const secret = requireAuthSecret();
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

import { hashPassword as hashPasswordModern, verifyPassword as verifyPasswordModern } from './password';
import { queryPostgres } from './postgres';

export { hashPasswordModern as hashPassword };
export { verifyPasswordModern as verifyPasswordAsync };

/**
 * @deprecated Gunakan verifyPasswordAsync() sebagai gantinya.
 */
export function verifyPassword(_plainPassword: string, _storedHash: string): boolean {
  return false;
}

/**
 * Creates and signs a session token using Web Crypto HMAC-SHA256
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  const payload = JSON.stringify({
    ...user,
    sessionVersion: user.sessionVersion ?? 0,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const encodedPayload = base64UrlEncode(payload);
  const key = await getCryptoKey();
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(encodedPayload));

  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => String.fromCharCode(b))
    .join('');

  const encodedSignature = base64UrlEncode(signature);

  return `${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies a session token string using Web Crypto HMAC-SHA256
 */
export async function verifySessionToken(tokenString: string): Promise<SessionUser | null> {
  try {
    if (!tokenString || !tokenString.includes('.')) return null;
    const [encodedPayload, encodedSignature] = tokenString.split('.');

    const key = await getCryptoKey();
    const enc = new TextEncoder();

    // Decode signature
    const signatureStr = base64UrlDecode(encodedSignature);
    const signatureBytes = new Uint8Array(signatureStr.split('').map((c) => c.charCodeAt(0)));

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      enc.encode(encodedPayload)
    );

    if (!isValid) return null;

    const json = base64UrlDecode(encodedPayload);
    const data = JSON.parse(json);

    if (data.exp && Date.now() > data.exp) {
      return null; // Expired
    }

    return {
      id: data.id,
      username: data.username,
      fullName: data.fullName,
      role: data.role,
      schoolId: data.schoolId || null,
      schoolName: data.schoolName || null,
      sessionId: data.sessionId,
      sessionVersion: data.sessionVersion ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Validates a session token string against the live PostgreSQL database.
 * Enforces:
 * 1. Cryptographic HMAC signature and absolute token expiration
 * 2. Database user session_version check (revocation check)
 * 3. Database user_sessions table revocation check (is_revoked === false)
 * 4. User active status (status === 'ACTIVE' and is_active === true)
 * 5. School suspension check (for non-SUPER_ADMIN)
 * 6. Updates user_sessions.last_activity_at (idle tracking)
 */
export async function validateServerSession(tokenString: string): Promise<SessionUser | null> {
  const tokenUser = await verifySessionToken(tokenString);
  if (!tokenUser) return null;

  try {
    const cryptoMod = await import('crypto');
    const tokenHash = cryptoMod.createHash('sha256').update(tokenString).digest('hex');

    const res = await queryPostgres(
      `SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.status,
              COALESCE(u.session_version, 0) as session_version,
              u.school_id, s.name as school_name, s.is_active as is_school_active,
              us.id as db_session_id, us.is_revoked, us.expires_at, us.last_activity_at
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       LEFT JOIN user_sessions us ON us.session_token_hash = $1 AND us.user_id = u.id
       WHERE u.id = $2
       LIMIT 1;`,
      [tokenHash, tokenUser.id]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];

    // 1. Account active check
    if (!row.is_active || (row.status && row.status !== 'ACTIVE')) {
      return null;
    }

    // 2. School active check (for non-SUPER_ADMIN)
    if (row.role !== 'SUPER_ADMIN' && row.school_id && row.is_school_active === false) {
      return null;
    }

    // 3. Session version check (Force logout / Revoke all)
    const currentVersion = Number(row.session_version || 0);
    const tokenVersion = Number(tokenUser.sessionVersion || 0);
    if (tokenVersion < currentVersion) {
      return null;
    }

    // 4. Session database check (if session row exists)
    if (row.db_session_id) {
      if (row.is_revoked) {
        return null; // Explicitly revoked
      }
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        return null; // Expired session
      }

      // Idle timeout: 2 hours of inactivity
      if (row.last_activity_at) {
        const lastActive = new Date(row.last_activity_at).getTime();
        const twoHours = 2 * 60 * 60 * 1000;
        if (Date.now() - lastActive > twoHours) {
          // Mark session expired due to idle timeout
          queryPostgres(
            `UPDATE user_sessions SET is_revoked = true, revoked_reason = 'IDLE_TIMEOUT' WHERE id = $1;`,
            [row.db_session_id]
          ).catch(() => {});
          return null;
        }
      }

      // Update last_activity_at asynchronously
      queryPostgres(
        `UPDATE user_sessions SET last_activity_at = NOW() WHERE id = $1;`,
        [row.db_session_id]
      ).catch(() => {});
    }

    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      schoolId: row.school_id || null,
      schoolName: row.school_name || (row.role === 'SUPER_ADMIN' ? 'Semua Sekolah (Super Admin)' : null),
      sessionVersion: currentVersion,
      sessionId: row.db_session_id || tokenUser.sessionId,
    };
  } catch (err) {
    console.error('Error in validateServerSession:', err);
    // On unexpected DB error, return null to fail securely
    return null;
  }
}

/**
 * Creates and signs a student session token (HMAC-SHA256) binding the student to a specific exam session.
 */
/**
 * Creates and signs a student session token (HMAC-SHA256) binding the student to a specific exam session.
 */
export async function createStudentSessionToken(
  payload: Omit<StudentSessionPayload, 'exp'> & { durationHours?: number }
): Promise<string> {
  const exp = Date.now() + (payload.durationHours || 4) * 60 * 60 * 1000;
  const fullPayload: StudentSessionPayload = {
    sessionId: payload.sessionId,
    examId: payload.examId,
    participantId: payload.participantId,
    studentId: payload.studentId,
    schoolId: payload.schoolId,
    studentName: payload.studentName,
    deviceId: payload.deviceId || payload.deviceFingerprint,
    deviceFingerprint: payload.deviceFingerprint || payload.deviceId,
    sessionVersion: payload.sessionVersion ?? 1,
    exp,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const key = await getCryptoKey();
  const enc = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(encodedPayload));

  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => String.fromCharCode(b))
    .join('');

  const encodedSignature = base64UrlEncode(signature);

  return `${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies a student session token string using Web Crypto HMAC-SHA256.
 */
export async function verifyStudentSessionToken(tokenString: string): Promise<StudentSessionPayload | null> {
  try {
    if (!tokenString || !tokenString.includes('.')) return null;
    const [encodedPayload, encodedSignature] = tokenString.split('.');

    const key = await getCryptoKey();
    const enc = new TextEncoder();

    const signatureStr = base64UrlDecode(encodedSignature);
    const signatureBytes = new Uint8Array(signatureStr.split('').map((c) => c.charCodeAt(0)));

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      enc.encode(encodedPayload)
    );

    if (!isValid) return null;

    const json = base64UrlDecode(encodedPayload);
    const data: StudentSessionPayload = JSON.parse(json);

    if (data.exp && Date.now() > data.exp) {
      return null; // Expired
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Extracts student session token from Request (Cookie, Bearer, or Custom Header).
 */
export function extractStudentTokenFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') || '';
  const matchCookie = cookieHeader.match(/sagaya_student_session=([^;]+)/);
  if (matchCookie) {
    return decodeURIComponent(matchCookie[1].trim());
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const customHeader = req.headers.get('x-student-session-token');
  if (customHeader) {
    return customHeader.trim();
  }

  return null;
}

/**
 * Authenticates student exam session request.
 * Multi-layer validation:
 * 1. Cryptographic HMAC signature & token expiration
 * 2. Database session existence & session_version match (revocation check)
 * 3. School & student active check
 * 4. Participant & exam ownership check (IDOR protection)
 * 5. Device binding check (DEVICE_MISMATCH detection)
 * 6. Server-authoritative timer evaluation
 */
export async function authenticateStudentSession(
  req: Request,
  options?: { targetSessionId?: string; allowReadOnly?: boolean }
): Promise<
  | { success: true; context: StudentAuthContext; token: string }
  | { success: false; error: string; status: number; code: string }
> {
  const tokenString = extractStudentTokenFromRequest(req);
  if (!tokenString) {
    return {
      success: false,
      error: 'Autentikasi sesi siswa tidak ditemukan. Silakan masukkan token ujian kembali.',
      status: 401,
      code: 'UNAUTHENTICATED',
    };
  }

  const tokenPayload = await verifyStudentSessionToken(tokenString);
  if (!tokenPayload) {
    return {
      success: false,
      error: 'Token sesi siswa tidak valid atau telah kedaluwarsa.',
      status: 401,
      code: 'INVALID_TOKEN',
    };
  }

  // IDOR check against explicit target if specified
  if (options?.targetSessionId && options.targetSessionId !== tokenPayload.sessionId) {
    return {
      success: false,
      error: 'Akses ditolak: Target sesi tidak sesuai dengan identitas sesi yang diautentikasi.',
      status: 403,
      code: 'FORBIDDEN_IDOR',
    };
  }

  try {
    const res = await queryPostgres(
      `SELECT es.id as session_id, es.status, COALESCE(es.session_version, 1) as session_version,
              COALESCE(es.device_id, es.device_fingerprint) as device_id,
              COALESCE(es.started_at, es.server_started_at) as started_at,
              COALESCE(es.expires_at, es.server_expires_at) as expires_at,
              es.submitted_at, COALESCE(es.tab_violation_count, 0) as tab_violation_count,
              ep.id as participant_id, ep.token, ep.token_status, ep.assigned_package,
              COALESCE(ep.eligible, true) as eligible,
              s.id as student_id, s.full_name as student_name, s.nisn, s.is_active as is_student_active,
              c.name as class_name,
              e.id as exam_id, e.title as exam_title, e.status as exam_status, e.duration_minutes,
              sc.id as school_id, sc.name as school_name, sc.is_active as is_school_active,
              sub.name as subject_name
       FROM exam_sessions es
       JOIN exam_participants ep ON es.participant_id = ep.id
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       JOIN exams e ON ep.exam_id = e.id
       JOIN schools sc ON e.school_id = sc.id
       LEFT JOIN subjects sub ON e.subject_id = sub.id
       WHERE es.id = $1
       LIMIT 1;`,
      [tokenPayload.sessionId]
    );

    if (res.rows.length === 0) {
      return {
        success: false,
        error: 'Sesi ujian tidak ditemukan pada sistem.',
        status: 404,
        code: 'SESSION_NOT_FOUND',
      };
    }

    const row = res.rows[0];

    // 1. School Active Check
    if (row.is_school_active === false) {
      return {
        success: false,
        error: 'Akses ujian dibekukan: Sekolah penyelenggara sedang dinonaktifkan.',
        status: 403,
        code: 'SCHOOL_INACTIVE',
      };
    }

    // 2. Student Active Check
    if (row.is_student_active === false) {
      return {
        success: false,
        error: 'Data siswa berstatus tidak aktif. Hubungi operator sekolah.',
        status: 403,
        code: 'STUDENT_INACTIVE',
      };
    }

    // 3. Participant Eligibility Check
    if (!row.eligible || row.token_status === 'REVOKED') {
      return {
        success: false,
        error: 'Kepesertaan ujian Anda telah dinonaktifkan atau token dicabut.',
        status: 403,
        code: 'PARTICIPANT_INELIGIBLE',
      };
    }

    // 4. Session Version Check (Force logout / session reset / revocation)
    const dbVersion = Number(row.session_version || 1);
    const tokenVersion = Number(tokenPayload.sessionVersion || 1);
    if (tokenVersion < dbVersion) {
      return {
        success: false,
        error: 'Sesi ujian ini telah diatur ulang atau dicabut oleh pengawas. Silakan masuk kembali.',
        status: 401,
        code: 'SESSION_REVOKED',
      };
    }

    // 5. IDOR & Ownership Protection: Ensure token claims match live DB record
    if (
      row.participant_id !== tokenPayload.participantId ||
      row.student_id !== tokenPayload.studentId ||
      row.exam_id !== tokenPayload.examId
    ) {
      return {
        success: false,
        error: 'Akses ditolak: Verifikasi integritas sesi gagal (IDOR protection).',
        status: 403,
        code: 'SESSION_OWNERSHIP_MISMATCH',
      };
    }

    if (tokenPayload.schoolId && row.school_id !== tokenPayload.schoolId) {
      return {
        success: false,
        error: 'Akses ditolak: Batas sekolah tenant tidak sesuai.',
        status: 403,
        code: 'TENANT_MISMATCH',
      };
    }

    // 6. Terminated / Invalidated Session Status Check
    if (row.status === 'TERMINATED' || row.status === 'INVALIDATED') {
      return {
        success: false,
        error: 'Sesi ujian telah dihentikan secara permanen.',
        status: 403,
        code: 'SESSION_TERMINATED',
      };
    }

    // 7. Device Binding Validation
    const clientDeviceId =
      req.headers.get('x-device-id') ||
      req.headers.get('x-device-fingerprint') ||
      tokenPayload.deviceId ||
      tokenPayload.deviceFingerprint;

    const boundDeviceId = row.device_id;
    if (boundDeviceId && clientDeviceId && boundDeviceId !== clientDeviceId) {
      return {
        success: false,
        error: 'Sesi ujian sedang aktif pada perangkat lain. Minta proktor melakukan reset sesi jika berganti perangkat.',
        status: 409,
        code: 'DEVICE_MISMATCH',
      };
    }

    // 8. Server-authoritative timer calculation
    const now = Date.now();
    const expiresAt = row.expires_at ? new Date(row.expires_at).toISOString() : new Date(now + 90 * 60 * 1000).toISOString();
    const expTime = new Date(expiresAt).getTime();
    const remainingSeconds = Math.max(0, Math.floor((expTime - now) / 1000));
    const isExpired = remainingSeconds <= 0 && row.status === 'IN_PROGRESS';

    const context: StudentAuthContext = {
      sessionId: row.session_id,
      examId: row.exam_id,
      participantId: row.participant_id,
      studentId: row.student_id,
      schoolId: row.school_id,
      studentName: row.student_name,
      nisn: row.nisn,
      className: row.class_name || undefined,
      assignedPackage: row.assigned_package,
      deviceId: boundDeviceId || clientDeviceId || 'default-device',
      sessionVersion: dbVersion,
      status: isExpired ? 'TIMEOUT' : row.status,
      startedAt: row.started_at,
      expiresAt,
      durationMinutes: row.duration_minutes,
      examTitle: row.exam_title,
      subjectName: row.subject_name || 'Ujian',
      isExpired,
      remainingSeconds,
      tabViolationCount: row.tab_violation_count,
    };

    return { success: true, context, token: tokenString };
  } catch (err: any) {
    console.error('Error in authenticateStudentSession:', err);
    return {
      success: false,
      error: 'Terjadi kegagalan verifikasi sesi pada server.',
      status: 500,
      code: 'INTERNAL_ERROR',
    };
  }
}

/**
 * Verifies student session access against a target sessionId.
 * Maintained for backward-compatibility with legacy routes, while leveraging
 * authenticateStudentSession for multi-layer security.
 */
export async function verifyStudentSessionAccess(
  req: Request,
  targetSessionId: string
): Promise<{
  authorized: boolean;
  studentSession?: StudentSessionPayload;
  context?: StudentAuthContext;
  isStaff?: boolean;
  error?: string;
  status?: number;
}> {
  // 1. Authenticate via Student Session Credential
  const authResult = await authenticateStudentSession(req, { targetSessionId });
  if (authResult.success) {
    return {
      authorized: true,
      context: authResult.context,
      studentSession: {
        sessionId: authResult.context.sessionId,
        examId: authResult.context.examId,
        participantId: authResult.context.participantId,
        studentId: authResult.context.studentId,
        schoolId: authResult.context.schoolId,
        studentName: authResult.context.studentName,
        deviceId: authResult.context.deviceId,
        sessionVersion: authResult.context.sessionVersion,
        exp: Date.now() + 4 * 3600 * 1000,
      },
    };
  }

  // 2. Fallback: Staff check (PENGAWAS / ADMIN / SUPER_ADMIN)
  const cookieHeader = req.headers.get('cookie') || '';
  const staffCookie = cookieHeader.match(/sagaya_session=([^;]+)/);
  if (staffCookie) {
    const staffToken = decodeURIComponent(staffCookie[1].trim());
    const staffUser = await verifySessionToken(staffToken);
    if (staffUser && ['SUPER_ADMIN', 'ADMIN', 'PENGAWAS'].includes(staffUser.role)) {
      return { authorized: true, isStaff: true };
    }
  }

  return {
    authorized: false,
    error: authResult.error || 'Akses ditolak: Anda tidak memiliki otorisasi.',
    status: authResult.status || 401,
  };
}

