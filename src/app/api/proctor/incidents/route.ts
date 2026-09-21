import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { IncidentService } from '@/lib/services/incident.service';

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId') || undefined;
    const roomId = searchParams.get('roomId') || undefined;
    const status = searchParams.get('status') || undefined;

    const data = await IncidentService.getIncidents(auth.user, schoolId, { examId, roomId, status });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat insiden ujian.' },
      { status: 500 }
    );
  }
}

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
    const { examId, roomId, participantId, category, severity, description, actionTaken } = body;

    if (!examId || !category || !severity || !description) {
      return NextResponse.json(
        { success: false, error: 'Parameter examId, category, severity, dan description wajib diisi.' },
        { status: 400 }
      );
    }

    const record = await IncidentService.createIncident(auth.user, schoolId, examId, {
      roomId,
      participantId,
      category,
      severity,
      description,
      actionTaken,
    });

    return NextResponse.json({
      success: true,
      message: 'Laporan insiden berhasil disimpan.',
      data: record,
    });
  } catch (error: any) {
    const isForbidden = error.message?.includes('Akses ditolak');
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal melaporkan insiden.' },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
