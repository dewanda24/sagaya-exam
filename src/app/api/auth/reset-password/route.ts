import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { queryPostgres, withTransaction } from '@/lib/core/postgres';
import { hashPassword, validatePasswordPolicy } from '@/lib/core/password';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/core/rate-limit';
import { validateCsrfOrigin } from '@/lib/core/csrf';

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

  // 2. Rate Limiting
  const rateLimit = checkRateLimit(`reset:${clientIp}`, RATE_LIMITS.RESET_PASSWORD);
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        success: false,
        code: 'AUTH_RATE_LIMITED',
        error: `Terlalu banyak percobaan reset kata sandi. Coba lagi dalam ${Math.ceil((rateLimit.retryAfterMs || 60000) / 60000)} menit.`,
      },
      { status: 429 }
    );
  }

  try {
    const { token, newPassword, confirmPassword } = await req.json().catch(() => ({}));

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, code: 'AUTH_RESET_INVALID', error: 'Token reset kata sandi tidak valid.' },
        { status: 400 }
      );
    }

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Kata sandi baru dan konfirmasi wajib diisi.' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru.' },
        { status: 400 }
      );
    }

    // 3. Password Policy Validation
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      return NextResponse.json(
        { success: false, error: policy.errors[0] || 'Kata sandi tidak memenuhi kebijakan keamanan.' },
        { status: 400 }
      );
    }

    // 4. Verify Token Hash
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const tokenRes = await queryPostgres(
      `SELECT prt.id, prt.user_id, prt.token_hash, prt.expires_at, prt.used_at,
              u.username, u.role, u.school_id, u.is_active, COALESCE(u.status, 'ACTIVE') as status
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token_hash = $1
       LIMIT 1;`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, code: 'AUTH_RESET_INVALID', error: 'Tautan pemulihan kata sandi tidak valid.' },
        { status: 400 }
      );
    }

    const resetRecord = tokenRes.rows[0];

    // Single-use token enforcement
    if (resetRecord.used_at) {
      return NextResponse.json(
        { success: false, code: 'AUTH_RESET_USED', error: 'Tautan pemulihan ini sudah pernah digunakan.' },
        { status: 400 }
      );
    }

    // Expiration enforcement
    if (new Date(resetRecord.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, code: 'AUTH_RESET_EXPIRED', error: 'Tautan pemulihan kata sandi telah kedaluwarsa.' },
        { status: 400 }
      );
    }

    // User status check
    if (!resetRecord.is_active || resetRecord.status === 'INACTIVE') {
      return NextResponse.json(
        { success: false, code: 'AUTH_ACCOUNT_DISABLED', error: 'Akun terkait sedang dinonaktifkan.' },
        { status: 403 }
      );
    }

    // 5. Hash new password with Argon2id
    const newPasswordHash = await hashPassword(newPassword);

    // 6. Execute atomic update
    await withTransaction(async (client) => {
      // Update password, increment session_version to invalidate all existing tokens
      await client.query(
        `UPDATE users 
         SET password_hash = $1, 
             session_version = COALESCE(session_version, 0) + 1,
             must_change_password = false,
             failed_login_attempts = 0,
             locked_until = NULL,
             status = 'ACTIVE'
         WHERE id = $2;`,
        [newPasswordHash, resetRecord.user_id]
      );

      // Mark token as used
      await client.query(
        `UPDATE password_reset_tokens 
         SET used_at = NOW() 
         WHERE id = $1;`,
        [resetRecord.id]
      );

      // Invalidate all active user sessions in database
      await client.query(
        `UPDATE user_sessions 
         SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'PASSWORD_RESET' 
         WHERE user_id = $1 AND is_revoked = false;`,
        [resetRecord.user_id]
      );
    });

    // 7. Audit Event: PASSWORD_RESET_COMPLETED
    await queryPostgres(
      `INSERT INTO audit_logs (id, user_id, role, school_id, action, severity, details_json, ip_address, user_agent, created_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, 'PASSWORD_RESET_COMPLETED', 'INFO', $4::jsonb, $5, $6, NOW());`,
      [
        resetRecord.user_id,
        resetRecord.role,
        resetRecord.school_id || null,
        JSON.stringify({ username: resetRecord.username }),
        clientIp,
        userAgent,
      ]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Kata sandi berhasil diperbarui. Silakan masuk menggunakan kata sandi baru Anda.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, code: 'AUTH_SERVER_ERROR', error: 'Terjadi kesalahan sistem saat memperbarui kata sandi.' },
      { status: 500 }
    );
  }
}
