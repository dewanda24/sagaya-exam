import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/core/auth';
import { queryPostgres } from '@/lib/core/postgres';
import { getClientIp } from '@/lib/core/rate-limit';
import crypto from 'crypto';

export async function POST(req: Request) {
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;

    if (token) {
      const user = await verifySessionToken(token);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // 1. Invalidate session in user_sessions
      await queryPostgres(
        `UPDATE user_sessions 
         SET is_revoked = true, revoked_at = NOW(), revoked_reason = 'LOGOUT' 
         WHERE session_token_hash = $1;`,
        [tokenHash]
      ).catch(() => {});

      // 2. Audit Event: LOGOUT
      if (user) {
        await queryPostgres(
          `INSERT INTO audit_logs (id, user_id, role, school_id, action, severity, details_json, ip_address, user_agent, created_at)
           VALUES (uuid_generate_v4(), $1, $2, $3, 'LOGOUT', 'INFO', $4::jsonb, $5, $6, NOW());`,
          [
            user.id,
            user.role,
            user.schoolId || null,
            JSON.stringify({ username: user.username, reason: 'user_logout' }),
            clientIp,
            userAgent,
          ]
        ).catch(() => {});
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logout berhasil.',
    });

    // 3. Clear session cookie
    response.cookies.delete('sagaya_session');

    return response;
  } catch (error: any) {
    const response = NextResponse.json({
      success: true,
      message: 'Logout berhasil.',
    });
    response.cookies.delete('sagaya_session');
    return response;
  }
}
