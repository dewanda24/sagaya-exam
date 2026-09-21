import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import {
  getRegionalExamDetail,
  assignSchoolsToRegionalExam,
  transitionRegionalExamStatus,
} from '@/lib/services/regional-exam.service';
import { getClientIp } from '@/lib/core/rate-limit';

export async function GET(
  req: Request,
  context: { params: Promise<{ examId: string }> }
) {
  const auth = await requireApiPermission('regional_exam.read');
  if (!auth.authorized) return auth.response;

  try {
    const { examId } = await context.params;
    const data = await getRegionalExamDetail(examId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat detail ujian wilayah.' },
      { status: 404 }
    );
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ examId: string }> }
) {
  const { examId } = await context.params;
  const body = await req.json();
  const { action, schoolIds, status } = body;
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  if (action === 'ASSIGN_SCHOOLS') {
    const auth = await requireApiPermission('regional_exam.update');
    if (!auth.authorized) return auth.response;

    try {
      const result = await assignSchoolsToRegionalExam(examId, schoolIds || [], {
        id: auth.user.id,
        role: auth.user.role,
        fullName: auth.user.fullName,
        ip: clientIp,
        userAgent,
      });

      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
  }

  if (action === 'TRANSITION_STATUS') {
    const normalizedStatus = (status || '').toUpperCase();
    let requiredPerm = 'regional_exam.update';
    if (normalizedStatus === 'PUBLISHED') requiredPerm = 'regional_exam.publish';
    if (normalizedStatus === 'ARCHIVED') requiredPerm = 'regional_exam.archive';

    const auth = await requireApiPermission(requiredPerm as any);
    if (!auth.authorized) return auth.response;

    try {
      const updated = await transitionRegionalExamStatus(examId, normalizedStatus, {
        id: auth.user.id,
        role: auth.user.role,
        fullName: auth.user.fullName,
        ip: clientIp,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        message: `Status ujian wilayah berhasil diubah ke ${normalizedStatus}.`,
        data: updated,
      });
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: false, error: 'Aksi tidak valid.' }, { status: 400 });
}
