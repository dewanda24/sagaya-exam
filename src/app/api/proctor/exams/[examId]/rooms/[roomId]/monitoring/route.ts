import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { ProctorMonitoringService } from '@/lib/services/proctor-monitoring.service';

export async function GET(
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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const connection = searchParams.get('connection') || undefined;

    const data = await ProctorMonitoringService.getRoomMonitoringData(
      auth.user,
      schoolId,
      examId,
      roomId,
      { search, status, connection }
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    const isForbidden = error.message?.includes('Akses ditolak');
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat monitoring ruang ujian.' },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
