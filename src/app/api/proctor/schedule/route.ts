import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { ProctorCoreService } from '@/lib/services/proctor-core.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah (tenant) tidak valid.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || undefined;
    const status = searchParams.get('status') || undefined;
    const roomId = searchParams.get('roomId') || undefined;
    const examId = searchParams.get('examId') || undefined;

    const schedules = await ProctorCoreService.getProctorSchedule(
      auth.user.id,
      schoolId,
      auth.user.role,
      { date, status, roomId, examId }
    );

    return NextResponse.json({
      success: true,
      data: schedules,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat jadwal pengawasan.' },
      { status: 500 }
    );
  }
}
