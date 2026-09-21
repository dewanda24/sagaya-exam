import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { queryPostgres, withTransaction } from '@/lib/core/postgres';
import { validateServerSession, createSessionToken } from '@/lib/core/auth';
import { hashPassword, verifyPassword, validatePasswordPolicy } from '@/lib/core/password';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/core/rate-limit';
import { validateCsrfOrigin } from '@/lib/core/csrf';
import { recordUserSession } from '@/lib/services/security.service';

export async function POST(req: Request) {
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // 1. CSRF Protection
  const csrf = validateCsrfOrigin(req);
  if (!csrf.valid) {
    return NextResponse.json(
      { success: false, error: csrf.error || 'Akses ditolak: Validasi CSRF gagal.' },
      { status: 403 }
    );
  }

  // 2. Authentication Check
  const cookieStore = await cookies();
  const token = cookieStore.get('sagaya_session')?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Sesi tidak ditemukan.' },
      { status: 401 }
    );
  }

  const currentUser = await validateServerSession(token);
  if (!currentUser) {
    const res = NextResponse.json(
      { success: false, error: 'Unauthorized: Sesi tidak valid atau telah kedaluwarsa.' },
      { status: 401 }
    );
    res.cookies.delete('sagaya_session');
    return res;
  }

  // 3. Rate Limiting
  const rateLimit = checkRateLimit(`change_pwd:${currentUser.id}`, RATE_LIMITS.CHANGE_PASSWORD);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        success: false,
        code: 'AUTH_RATE_LIMITED',
        error: `Terlalu banyak percobaan ganti kata sandi. Coba lagi dalam ${Math.ceil((rateLimit.retryAfterMs || 60000) / 60000)} menit.`,
      },
      { status: 429 }
    );
  }

  try {
    const { oldPassword, newPassword, confirmPassword } = await req.json().catch(() => ({}));

    if (!oldPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Kata sandi saat ini, kata sandi baru, dan konfirmasi wajib diisi.' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru.' },
        { status: 400 }
      );
    }

    if (oldPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: 'Kata sandi baru tidak boleh sama dengan kata sandi lama.' },
        { status: 400 }
      );
    }

    // 4. Validate Policy
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      return NextResponse.json(
        { success: false, error: policy.errors[0] || 'Kata sandi tidak memenuhi kriteria keamanan.' },
        { status: 400 }
      );
    }

    // 5. Query user to verify old password
    const userRes = await queryPostgres(
      `SELECT id, username, password_hash, role, school_id, COALESCE(session_version, 0) as session_version
       FROM users WHERE id = $1 LIMIT 1;`,
      [currentUser.id]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Pengguna tidak ditemukan.' }, { status: 404 });
    }

    const dbUser = userRes.rows[0];

    const isOldValid = await verifyPassword(oldPassword, dbUser.password_hash);
    if (!isOldValid) {
      return NextResponse.json(
        { success: false, error: 'Kata sandi saat ini yang Anda masukkan salah.' },
        { status: 400 }
      );
    }

    // 6. Hash new password with Argon2id
    const newHash = await hashPassword(newPassword);
    const newSessionVersion = Number(dbUser.session_version || 0) + 1;

    // 7. Update database: atomic transaction
    await withTransaction(async (client) => {
      // Update password & increment session_version
      await client.query(
        `UPDATE users 
         SET password_hash = $1, 
             session_version = $2, 
             must_change_password = false 
         WHERE id = $3;`,
        [newHash, newSessionVersion, dbUser.id]
      );

      // Invalidate all old sessions in user_sessions
      await client.query(
        `UPDATE user_sessions 
         SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'PASSWORD_CHANGED' 
         WHERE user_id = $1 AND is_revoked = false;`,
        [dbUser.id]
      );
    });

    // 8. Re-issue fresh session for the current active browser
    const updatedSessionUser = {
      ...currentUser,
      sessionVersion: newSessionVersion,
    };
    const newToken = await createSessionToken(updatedSessionUser);
    await recordUserSession(
      dbUser.id,
      newToken,
      clientIp,
      userAgent,
      newSessionVersion,
      7
    );

    // 9. Audit Event: PASSWORD_CHANGED
    await queryPostgres(
      `INSERT INTO audit_logs (id, user_id, role, school_id, action, severity, details_json, ip_address, user_agent, created_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, 'PASSWORD_CHANGED', 'INFO', $4::jsonb, $5, $6, NOW());`,
      [
        dbUser.id,
        dbUser.role,
        dbUser.school_id || null,
        JSON.stringify({ username: dbUser.username, reason: 'user_initiated' }),
        clientIp,
        userAgent,
      ]
    ).catch(() => {});

    const response = NextResponse.json({
      success: true,
      message: 'Kata sandi berhasil diubah. Sesi perangkat lain telah dicabut secara otomatis.',
    });

    // Set updated cookie
    response.cookies.set('sagaya_session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, code: 'AUTH_SERVER_ERROR', error: 'Gagal memperbarui kata sandi.' },
      { status: 500 }
    );
  }
}
