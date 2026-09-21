import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { ProctorCoreService } from '@/lib/services/proctor-core.service';
import { ProctorAuthorizationService } from '@/lib/services/proctor-authorization.service';
import { hasUserPermission } from '@/lib/core/permissions';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string; roomId: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    if (!hasUserPermission(auth.user, 'proctor.exam.monitor')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Anda tidak memiliki izin untuk memantau ujian.' },
        { status: 403 }
      );
    }

    const { examId, roomId } = await params;
    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak valid.' },
        { status: 400 }
      );
    }

    // IDOR check: Verifikasi pengawas ditugaskan pada ruang ini
    const accessCheck = await ProctorAuthorizationService.canAccessRoom(auth.user, examId, roomId, schoolId);
    if (!accessCheck.allowed) {
      return NextResponse.json(
        { success: false, error: accessCheck.reason || 'Akses ditolak: Anda tidak ditugaskan pada ruang ini.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const checklist = body.checklist || {};

    const session = await ProctorCoreService.startMonitoring(
      auth.user.id,
      schoolId,
      examId,
      roomId,
      checklist
    );

    return NextResponse.json({
      success: true,
      message: 'Sesi pengawasan ruang berhasil dimulai.',
      data: session,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memulai pengawasan ruang ujian.' },
      { status: 400 }
    );
  }
}
