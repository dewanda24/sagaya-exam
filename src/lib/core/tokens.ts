// Edge-compatible JWT / HMAC token utilities using standard Web Crypto API.
// Zero Node.js native dependencies — safe for Next.js Middleware and Edge Runtime.

const AUTH_SECRET = process.env.AUTH_SECRET;

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
  studentName?: string;
  deviceFingerprint?: string;
  exp: number;
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
    studentName: payload.studentName,
    deviceFingerprint: payload.deviceFingerprint,
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
 * Verifies student session access against a target sessionId.
 */
export async function verifyStudentSessionAccess(
  req: Request,
  targetSessionId: string
): Promise<{
  authorized: boolean;
  studentSession?: StudentSessionPayload;
  isStaff?: boolean;
  error?: string;
  status?: number;
}> {
  let token: string | null = null;
  const cookieHeader = req.headers.get('cookie') || '';

  const matchCookie = cookieHeader.match(/sagaya_student_session=([^;]+)/);
  if (matchCookie) {
    token = decodeURIComponent(matchCookie[1].trim());
  }

  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    token = req.headers.get('x-student-session-token');
  }

  if (token) {
    const studentPayload = await verifyStudentSessionToken(token);
    if (studentPayload) {
      if (studentPayload.sessionId === targetSessionId) {
        return { authorized: true, studentSession: studentPayload };
      } else {
        return {
          authorized: false,
          error: 'Akses ditolak: Token sesi ujian tidak cocok dengan sesi yang diminta.',
          status: 403,
        };
      }
    }
  }

  // Fallback: Staff check (PENGAWAS / ADMIN / SUPER_ADMIN)
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
    error: 'Akses ditolak: Anda tidak memiliki otorisasi untuk mengakses sesi ujian ini. Silakan masukkan token ujian kembali.',
    status: 401,
  };
}
