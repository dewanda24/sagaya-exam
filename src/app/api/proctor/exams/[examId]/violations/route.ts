import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { ViolationService } from '@/lib/services/violation.service';
import { hasUserPermission } from '@/lib/core/permissions';

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

    const data = await ViolationService.getRoomViolations(auth.user, schoolId, examId, roomId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    const isForbidden = error.message?.includes('Akses ditolak');
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat catatan pelanggaran.' },
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

    if (!hasUserPermission(auth.user, 'proctor.violation.read')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Anda tidak memiliki izin mencatat pelanggaran.' },
        { status: 403 }
      );
    }

    const { examId } = await params;
    const body = await req.json();
    const { roomId, participantId, sessionId, eventType, severity = 'INFO', description, metadata } = body;

    if (!participantId || !eventType) {
      return NextResponse.json(
        { success: false, error: 'Parameter participantId dan eventType wajib diisi.' },
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

    const record = await ViolationService.recordViolation(
      schoolId,
      examId,
      roomId || null,
      participantId,
      sessionId || null,
      eventType,
      severity,
      description,
      metadata
    );

    return NextResponse.json({
      success: true,
      message: 'Kejadian pelanggaran berhasil dicatat.',
      data: record,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mencatat kejadian pelanggaran.' },
      { status: 500 }
    );
  }
}
