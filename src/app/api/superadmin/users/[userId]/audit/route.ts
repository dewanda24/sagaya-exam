import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { getUserAuditTrail } from '@/lib/services/user.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireApiPermission('user.read');
  if (!auth.authorized) return auth.response;

  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID wajib disertakan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const auditLogs = await getUserAuditTrail(userId, limit);

    return NextResponse.json({
      success: true,
      data: auditLogs,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat rekam jejak audit pengguna.' },
      { status: 500 }
    );
  }
}
