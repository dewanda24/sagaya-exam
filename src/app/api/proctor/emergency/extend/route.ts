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
    const { examId, roomId, durationMinutes, reason } = body;

    if (!examId || !roomId || !durationMinutes || !reason) {
      return NextResponse.json(
        { success: false, error: 'Parameter examId, roomId, durationMinutes, dan reason wajib diisi.' },
        { status: 400 }
      );
    }

    const result = await ProctorSessionControlService.requestEmergencyExtension(
      auth.user,
      schoolId,
      examId,
      roomId,
      parseInt(String(durationMinutes), 10),
      reason
    );

    return NextResponse.json(result);
  } catch (error: any) {
    const isForbidden = error.message?.includes('Akses ditolak');
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengajukan perpanjangan darurat.' },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
