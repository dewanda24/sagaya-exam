import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { getSchoolDetail, updateSchool, changeSchoolStatus } from '@/lib/services/school.service';
import { getClientIp } from '@/lib/core/rate-limit';

export async function GET(
  req: Request,
  context: { params: Promise<{ schoolId: string }> }
) {
  const auth = await requireApiPermission('school.read');
  if (!auth.authorized) return auth.response;

  try {
    const { schoolId } = await context.params;
    const data = await getSchoolDetail(schoolId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat data sekolah.' },
      { status: 404 }
    );
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ schoolId: string }> }
) {
  const auth = await requireApiPermission('school.update');
  if (!auth.authorized) return auth.response;

  try {
    const { schoolId } = await context.params;
    const body = await req.json();
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const updated = await updateSchool(schoolId, body, {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Data satuan pendidikan berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui data sekolah.' },
      { status: 400 }
    );
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ schoolId: string }> }
) {
  const { schoolId } = await context.params;
  const body = await req.json();
  const { action, reason } = body;
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  if (!action || !['SUSPEND', 'ACTIVATE', 'ARCHIVE'].includes(action.toUpperCase())) {
    return NextResponse.json(
      { success: false, error: 'Aksi tidak valid. Pilihan: SUSPEND, ACTIVATE, ARCHIVE.' },
      { status: 400 }
    );
  }

  const normalizedAction = action.toUpperCase();
  const requiredPerm = normalizedAction === 'ARCHIVE' ? 'school.archive' : 'school.suspend';

  const auth = await requireApiPermission(requiredPerm);
  if (!auth.authorized) return auth.response;

  try {
    const targetStatus =
      normalizedAction === 'SUSPEND'
        ? 'SUSPENDED'
        : normalizedAction === 'ACTIVATE'
        ? 'ACTIVE'
        : 'ARCHIVED';

    const result = await changeSchoolStatus(schoolId, targetStatus, reason, {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `Status satuan pendidikan berhasil diubah ke ${targetStatus}.`,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengubah status sekolah.' },
      { status: 400 }
    );
  }
}
