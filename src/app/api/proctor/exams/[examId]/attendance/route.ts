import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AttendanceService, AttendanceStatus } from '@/lib/services/attendance.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const { examId } = await params;
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'Parameter roomId wajib disertakan.' },
        { status: 400 }
      );
    }

    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak valid.' },
        { status: 400 }
      );
    }

    const data = await AttendanceService.getAttendanceList(auth.user, schoolId, examId, roomId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    const isForbidden = error.message?.includes('Akses ditolak');
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat presensi ruang.' },
      { status: isForbidden ? 403 : 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const { examId } = await params;
    const body = await req.json();
    const { roomId, participantId, status, notes } = body;

    if (!roomId || !participantId || !status) {
      return NextResponse.json(
        { success: false, error: 'Parameter roomId, participantId, dan status wajib diisi.' },
        { status: 400 }
      );
    }

    const validStatuses: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Status presensi tidak valid. Pilihan: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak valid.' },
        { status: 400 }
      );
    }

    const record = await AttendanceService.updateAttendance(
      auth.user,
      schoolId,
      examId,
      roomId,
      participantId,
      status,
      notes
    );

    return NextResponse.json({
      success: true,
      message: 'Status presensi peserta berhasil diperbarui.',
      data: record,
    });
  } catch (error: any) {
    const isForbidden = error.message?.includes('Akses ditolak');
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui presensi peserta.' },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
