import { NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/core/postgres';
import { verifyPasswordAsync, createSessionToken } from '@/lib/core/auth';
import { checkRateLimit, resetRateLimit, RATE_LIMITS, getClientIp } from '@/lib/core/rate-limit';
import { validateCsrfOrigin } from '@/lib/core/csrf';
import { recordUserSession } from '@/lib/services/security.service';

function getRoleDefaultRedirect(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/superadmin/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'GURU':
      return '/guru/dashboard';
    case 'PENGAWAS':
      return '/pengawas';
    default:
      return '/login';
  }
}

function sanitizeInternalRedirect(redirectParam: string | null, role: string): string {
  if (!redirectParam) return getRoleDefaultRedirect(role);
  const trimmed = redirectParam.trim();
  // Hanya terima path internal yang diawali '/', bukan '//' atau '/\'
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    // Role-specific allowed prefix checks
    if (role === 'SUPER_ADMIN' && trimmed.startsWith('/superadmin')) return trimmed;
    if (role === 'ADMIN' && (trimmed.startsWith('/admin') || trimmed.startsWith('/account'))) return trimmed;
    if (role === 'GURU' && (trimmed.startsWith('/guru') || trimmed.startsWith('/account'))) return trimmed;
    if (role === 'PENGAWAS' && (trimmed.startsWith('/pengawas') || trimmed.startsWith('/account'))) return trimmed;
  }
  return getRoleDefaultRedirect(role);
}

export async function POST(req: Request) {
  const clientIp = getClientIp(req);

  // 1. CSRF Protection
  const csrf = validateCsrfOrigin(req);
  if (!csrf.valid) {
    return NextResponse.json(
      { success: false, error: csrf.error || 'Akses ditolak: Validasi CSRF gagal.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { username, password, redirect: clientRedirect } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username dan kata sandi wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim().toLowerCase();

    // 2. Rate Limiting: IP Level
    const ipLimit = checkRateLimit(`login:ip:${clientIp}`, RATE_LIMITS.LOGIN_IP);
    if (!ipLimit.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'AUTH_RATE_LIMITED',
          error: `Terlalu banyak percobaan login dari IP ini. Silakan coba kembali dalam ${Math.ceil((ipLimit.retryAfterMs || 60000) / 60000)} menit.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((ipLimit.retryAfterMs || 60000) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // 3. Rate Limiting: Identifier Level
    const userLimit = checkRateLimit(`login:user:${cleanUsername}`, RATE_LIMITS.LOGIN);
    if (!userLimit.success) {
      await queryPostgres(
        `INSERT INTO audit_logs (id, action, details_json, ip_address, created_at)
         VALUES (uuid_generate_v4(), 'LOGIN_RATE_LIMITED', $1::jsonb, $2, NOW());`,
        [JSON.stringify({ username: cleanUsername, reason: 'rate_limit_exceeded' }), clientIp]
      ).catch(() => {});

      return NextResponse.json(
        {
          success: false,
          code: 'AUTH_RATE_LIMITED',
          error: `Terlalu banyak percobaan login untuk akun ini. Silakan coba kembali dalam ${Math.ceil((userLimit.retryAfterMs || 60000) / 60000)} menit.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((userLimit.retryAfterMs || 60000) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const userAgent = req.headers.get('user-agent') || 'unknown';

    // 4. Query user and related school status
    const userRes = await queryPostgres(
      `SELECT u.id, u.username, u.password_hash, u.full_name, u.role, u.is_active,
              COALESCE(u.status, 'ACTIVE') as status,
              COALESCE(u.failed_login_attempts, 0) as failed_login_attempts,
              u.locked_until,
              COALESCE(u.session_version, 0) as session_version,
              u.school_id, s.name as school_name, s.code as school_code,
              s.is_active as is_school_active, s.subscription_expires_at
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE LOWER(u.username) = $1
       LIMIT 1;`,
      [cleanUsername]
    );

    // 5. Account Enumeration Protection:
    // Pesan kesalahan generic jika akun tidak ditemukan
    if (userRes.rows.length === 0) {
      await queryPostgres(
        `INSERT INTO audit_logs (id, action, details_json, ip_address, user_agent, created_at)
         VALUES (uuid_generate_v4(), 'LOGIN_FAILED', $1::jsonb, $2, $3, NOW());`,
        [JSON.stringify({ username: cleanUsername, reason: 'user_not_found' }), clientIp, userAgent]
      ).catch(() => {});

      return NextResponse.json(
        { success: false, code: 'AUTH_INVALID_CREDENTIALS', error: 'Username atau kata sandi tidak valid.' },
        { status: 401 }
      );
    }

    const user = userRes.rows[0];

    // 6. Security Lock Check (Brute-force lockout)
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000));
      return NextResponse.json(
        {
          success: false,
          code: 'AUTH_ACCOUNT_LOCKED',
          error: `Akun Anda sedang dikunci sementara demi keamanan. Silakan coba kembali dalam ${remainingMinutes} menit atau hubungi Administrator.`,
        },
        { status: 403 }
      );
    } else if (user.locked_until && new Date(user.locked_until).getTime() <= Date.now()) {
      // Lock has expired -> auto unlock
      await queryPostgres(
        `UPDATE users SET status = 'ACTIVE', failed_login_attempts = 0, locked_until = NULL WHERE id = $1;`,
        [user.id]
      ).catch(() => {});
      user.status = 'ACTIVE';
      user.failed_login_attempts = 0;
    }

    // 7. Administrative Disable Check
    if (!user.is_active || user.status === 'INACTIVE') {
      return NextResponse.json(
        {
          success: false,
          code: 'AUTH_ACCOUNT_DISABLED',
          error: 'Akun Anda telah dinonaktifkan oleh Administrator. Silakan hubungi pengelola platform.',
        },
        { status: 403 }
      );
    }

    // 8. School Suspension Check (for non-Superadmin)
    if (user.role !== 'SUPER_ADMIN' && user.school_id && user.is_school_active === false) {
      return NextResponse.json(
        {
          success: false,
          code: 'AUTH_SCHOOL_SUSPENDED',
          error: 'Akses ditangguhkan: Satuan pendidikan Anda sedang dinonaktifkan oleh Administrator Platform.',
        },
        { status: 403 }
      );
    }

    // 9. School Subscription Expiry Check
    if (user.role !== 'SUPER_ADMIN' && user.school_id && user.subscription_expires_at) {
      const expires = new Date(user.subscription_expires_at).getTime();
      if (expires < Date.now()) {
        return NextResponse.json(
          {
            success: false,
            code: 'AUTH_SUBSCRIPTION_EXPIRED',
            error: 'Masa lisensi satuan pendidikan Anda telah berakhir. Harap hubungi penyedia platform Sagaya Exam untuk perpanjangan layanan.',
          },
          { status: 403 }
        );
      }
    }

    // 10. Password Verification (Argon2id + Scrypt KDF fallback)
    const isPasswordValid = await verifyPasswordAsync(password, user.password_hash);
    if (!isPasswordValid) {
      const newAttempts = Number(user.failed_login_attempts || 0) + 1;

      if (newAttempts >= 5) {
        // Lock account for 15 minutes after 5 consecutive failed attempts
        await queryPostgres(
          `UPDATE users SET status = 'LOCKED', failed_login_attempts = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2;`,
          [newAttempts, user.id]
        ).catch(() => {});

        await queryPostgres(
          `INSERT INTO audit_logs (id, user_id, role, school_id, action, severity, details_json, ip_address, user_agent, created_at)
           VALUES (uuid_generate_v4(), $1, $2, $3, 'ACCOUNT_LOCKED', 'WARNING', $4::jsonb, $5, $6, NOW());`,
          [
            user.id,
            user.role,
            user.school_id || null,
            JSON.stringify({ username: cleanUsername, reason: 'consecutive_failed_logins', attempts: newAttempts }),
            clientIp,
            userAgent,
          ]
        ).catch(() => {});

        return NextResponse.json(
          {
            success: false,
            code: 'AUTH_ACCOUNT_LOCKED',
            error: 'Akun Anda dikunci sementara selama 15 menit karena 5 kali percobaan kata sandi salah.',
          },
          { status: 403 }
        );
      } else {
        await queryPostgres(
          `UPDATE users SET failed_login_attempts = $1 WHERE id = $2;`,
          [newAttempts, user.id]
        ).catch(() => {});

        await queryPostgres(
          `INSERT INTO audit_logs (id, user_id, role, school_id, action, details_json, ip_address, user_agent, created_at)
           VALUES (uuid_generate_v4(), $1, $2, $3, 'LOGIN_FAILED', $4::jsonb, $5, $6, NOW());`,
          [
            user.id,
            user.role,
            user.school_id || null,
            JSON.stringify({ username: cleanUsername, attempts: newAttempts, reason: 'invalid_password' }),
            clientIp,
            userAgent,
          ]
        ).catch(() => {});

        return NextResponse.json(
          { success: false, code: 'AUTH_INVALID_CREDENTIALS', error: 'Username atau kata sandi tidak valid.' },
          { status: 401 }
        );
      }
    }

    // 11. Login Succeeded: Prepare Secure Session
    // Reset rate limit for user upon successful login
    resetRateLimit(`login:user:${cleanUsername}`);

    const sessionUser = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role as 'SUPER_ADMIN' | 'ADMIN' | 'GURU' | 'PENGAWAS',
      schoolId: user.school_id || null,
      schoolName: user.school_name || (user.role === 'SUPER_ADMIN' ? 'Semua Sekolah (Super Admin)' : null),
      sessionVersion: Number(user.session_version || 0),
    };

    // Fresh session token (Session fixation prevention)
    const token = await createSessionToken(sessionUser);

    // Record server-side session in user_sessions table
    const dbSessionId = await recordUserSession(
      user.id,
      token,
      clientIp,
      userAgent,
      sessionUser.sessionVersion,
      7
    );

    // Audit Log: LOGIN_SUCCESS
    await queryPostgres(
      `INSERT INTO audit_logs (id, user_id, role, school_id, action, severity, details_json, ip_address, user_agent, created_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, 'LOGIN_SUCCESS', 'INFO', $4::jsonb, $5, $6, NOW());`,
      [
        user.id,
        user.role,
        user.school_id || null,
        JSON.stringify({ username: user.username, sessionId: dbSessionId }),
        clientIp,
        userAgent,
      ]
    ).catch(() => {});

    // Calculate authorized redirect URL
    const targetRedirectUrl = sanitizeInternalRedirect(clientRedirect, user.role);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      redirectUrl: targetRedirectUrl,
      message: 'Login berhasil.',
    });

    // Set secure HTTP-only cookie
    response.cookies.set('sagaya_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days absolute expiration
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, code: 'AUTH_SERVER_ERROR', error: 'Terjadi kesalahan sistem saat memproses login.' },
      { status: 500 }
    );
  }
}
