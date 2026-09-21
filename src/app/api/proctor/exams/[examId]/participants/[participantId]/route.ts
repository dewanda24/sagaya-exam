import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';
import { ProctorMonitoringService } from '@/lib/services/proctor-monitoring.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string; participantId: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const { examId, participantId } = await params;
    const { searchParams } = new URL(req.url);
    let roomId = searchParams.get('roomId');

    if (!roomId) {
      const pRes = await queryPostgres(
        `SELECT room_id FROM exam_participants WHERE id = $1 AND exam_id = $2;`,
        [participantId, examId]
      );
      if (pRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Peserta tidak ditemukan pada ujian ini.' },
          { status: 404 }
        );
      }
      roomId = pRes.rows[0].room_id;
    }

    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak valid.' },
        { status: 400 }
      );
    }

    if (!roomId) {
      return NextResponse.json(
        { success: false, error: 'Ruang peserta tidak ditemukan.' },
        { status: 400 }
      );
    }

    const data = await ProctorMonitoringService.getParticipantDetail(
      auth.user,
      schoolId,
      examId,
      roomId,
      participantId
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    const isForbidden = error.message?.includes('Akses ditolak');
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat detail peserta.' },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
