import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { validateServerSession } from '@/lib/core/auth';
import { revokeUserSessionById } from '@/lib/services/security.service';
import { validateCsrfOrigin } from '@/lib/core/csrf';
import { getClientIp } from '@/lib/core/rate-limit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = validateCsrfOrigin(req);
  if (!csrf.valid) {
    return NextResponse.json(
      { success: false, error: csrf.error || 'Akses ditolak: Validasi CSRF gagal.' },
      { status: 403 }
    );
  }

  const clientIp = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  const cookieStore = await cookies();
  const token = cookieStore.get('sagaya_session')?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = await validateServerSession(token);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Session expired' }, { status: 401 });
  }

  try {
    const { id: targetSessionId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || 'Dicabut oleh pengguna dari panel keamanan';

    await revokeUserSessionById(targetSessionId, user.id, reason, {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      ip: clientIp,
      userAgent,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Sesi perangkat berhasil dicabut.',
    });

    // Check if the revoked session was the current session
    const currentTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { queryPostgres } = await import('@/lib/core/postgres');
    const checkCurrent = await queryPostgres(
      `SELECT session_token_hash FROM user_sessions WHERE id = $1;`,
      [targetSessionId]
    );

    if (checkCurrent.rows[0]?.session_token_hash === currentTokenHash) {
      response.cookies.delete('sagaya_session');
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mencabut sesi.' },
      { status: 400 }
    );
  }
}
