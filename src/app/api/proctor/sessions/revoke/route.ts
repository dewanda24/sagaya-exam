import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { ProctorSessionControlService } from '@/lib/services/proctor-session-control.service';

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak valid.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { examId, roomId, participantId, reason } = body;

    if (!examId || !roomId || !participantId || !reason) {
      return NextResponse.json(
        { success: false, error: 'Parameter examId, roomId, participantId, dan reason wajib diisi.' },
        { status: 400 }
      );
    }

    const result = await ProctorSessionControlService.revokeStudentSession(
      auth.user,
      schoolId,
      examId,
      roomId,
      participantId,
      reason
    );

    return NextResponse.json(result);
  } catch (error: any) {
    const isForbidden = error.message?.includes('Akses ditolak');
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mencabut sesi siswa.' },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
