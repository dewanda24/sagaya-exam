import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { queryPostgres } from '@/lib/core/postgres';
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

  try {
    const { identifier } = await req.json().catch(() => ({}));

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Identifier (username atau email) wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    // 2. Rate Limiting
    const rateLimit = checkRateLimit(`forgot:${clientIp}:${cleanIdentifier}`, RATE_LIMITS.FORGOT_PASSWORD);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'AUTH_RATE_LIMITED',
          error: `Terlalu banyak permintaan reset kata sandi. Coba lagi dalam ${Math.ceil((rateLimit.retryAfterMs || 60000) / 60000)} menit.`,
        },
        { status: 429 }
      );
    }

    // 3. User lookup by username identifier
    const userRes = await queryPostgres(
      `SELECT id, username, role, school_id, is_active, COALESCE(status, 'ACTIVE') as status
       FROM users
       WHERE LOWER(username) = $1
       LIMIT 1;`,
      [cleanIdentifier]
    );

    let devResetLink: string | undefined;

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];

      // Only generate reset token if account is active
      if (user.is_active && user.status !== 'INACTIVE') {
        // Generate cryptographically random 32-byte token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        // Invalidate any previous unused reset tokens for this user
        await queryPostgres(
          `UPDATE password_reset_tokens 
           SET used_at = NOW() 
           WHERE user_id = $1 AND used_at IS NULL;`,
          [user.id]
        );

        // Store hashed token with 1-hour expiration
        await queryPostgres(
          `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
           VALUES (uuid_generate_v4(), $1, $2, NOW() + INTERVAL '1 hour', NOW());`,
          [user.id, tokenHash]
        );

        // Audit Event
        await queryPostgres(
          `INSERT INTO audit_logs (id, user_id, role, school_id, action, severity, details_json, ip_address, user_agent, created_at)
           VALUES (uuid_generate_v4(), $1, $2, $3, 'PASSWORD_RESET_REQUESTED', 'INFO', $4::jsonb, $5, $6, NOW());`,
          [
            user.id,
            user.role,
            user.school_id || null,
            JSON.stringify({ username: user.username, identifier: cleanIdentifier }),
            clientIp,
            userAgent,
          ]
        ).catch(() => {});

        devResetLink = `/reset-password?token=${rawToken}`;
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEV ONLY] Password reset link for ${user.username}: ${devResetLink}`);
        }
      }
    }

    // 4. Uniform Response (Account Enumeration Protection)
    // Always returns same message regardless of whether the identifier exists
    return NextResponse.json({
      success: true,
      message: 'Jika akun terdaftar dalam sistem, tautan pemulihan kata sandi telah diproses.',
      // Only include resetToken in non-production for automated testing & development convenience
      ...(process.env.NODE_ENV !== 'production' && devResetLink ? { devResetLink } : {}),
    });
  } catch (error: any) {
    console.error('FORGOT PWD ERROR:', error);
    return NextResponse.json(
      { success: false, code: 'AUTH_SERVER_ERROR', error: error?.message || 'Terjadi kesalahan sistem saat memproses permintaan.' },
      { status: 500 }
    );
  }
}
