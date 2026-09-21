import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { ProctorCoreService } from '@/lib/services/proctor-core.service';
import { ProctorAuthorizationService } from '@/lib/services/proctor-authorization.service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string; roomId: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const { examId, roomId } = await params;
    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak valid.' },
        { status: 400 }
      );
    }

    // IDOR check
    const accessCheck = await ProctorAuthorizationService.canAccessRoom(auth.user, examId, roomId, schoolId);
    if (!accessCheck.allowed) {
      return NextResponse.json(
        { success: false, error: accessCheck.reason || 'Akses ditolak: Anda tidak ditugaskan pada ruang ini.' },
        { status: 403 }
      );
    }

    const session = await ProctorCoreService.endMonitoring(
      auth.user.id,
      schoolId,
      examId,
      roomId
    );

    return NextResponse.json({
      success: true,
      message: 'Sesi pengawasan ruang telah diakhiri.',
      data: session,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengakhiri pengawasan ruang ujian.' },
      { status: 500 }
    );
  }
}
