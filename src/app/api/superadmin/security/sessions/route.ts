import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { getActiveSessions, revokeSession } from '@/lib/services/security.service';
import { getClientIp } from '@/lib/core/rate-limit';

export async function GET(req: Request) {
  const auth = await requireApiPermission('security.read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await getActiveSessions(page, limit);

    return NextResponse.json({
      success: true,
      data: result.sessions,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat sesi aktif.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireApiPermission('security.manage');
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const { sessionId, reason } = body;
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Session ID wajib disertakan.' }, { status: 400 });
    }

    const result = await revokeSession(sessionId, reason, {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mencabut sesi.' },
      { status: 400 }
    );
  }
}
