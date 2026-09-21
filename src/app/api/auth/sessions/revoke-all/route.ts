import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateServerSession } from '@/lib/core/auth';
import { revokeAllUserSessions } from '@/lib/services/security.service';
import { validateCsrfOrigin } from '@/lib/core/csrf';
import { getClientIp } from '@/lib/core/rate-limit';

export async function POST(req: Request) {
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
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || 'Pencabutan seluruh sesi atas inisiatif pengguna';

    const result = await revokeAllUserSessions(user.id, reason, {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      ip: clientIp,
      userAgent,
    });

    const response = NextResponse.json({
      success: true,
      message: result.message,
    });

    // Clear local session cookie since all sessions have been revoked
    response.cookies.delete('sagaya_session');

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mencabut seluruh sesi.' },
      { status: 500 }
    );
  }
}
