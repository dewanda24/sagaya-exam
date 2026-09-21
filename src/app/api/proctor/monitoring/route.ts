import { NextResponse } from 'next/server';
import { db } from '@/lib/school/db-service';
import { requireApiAuth } from '@/lib/core/rbac';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId') || undefined;
    const roomId = searchParams.get('roomId') || undefined;
    const sessionNumber = searchParams.get('sessionNumber') || undefined;
    const schoolId = auth.tenant.schoolId || auth.user.schoolId || undefined;
    const userId = auth.user.id;

    const data = await db.getProctorMonitoringData(examId, roomId, sessionNumber, schoolId, userId);

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat monitoring pengawas.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { action, examId, durationMinutes = 15, message } = body;

    if (!examId) {
      return NextResponse.json(
        { success: false, error: 'Parameter examId wajib disertakan.' },
        { status: 400 }
      );
    }

    if (action === 'RELEASE_TOKEN') {
      const result = await db.releaseExamToken(examId, durationMinutes);
      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Ujian tidak ditemukan.' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: `Token sesi ujian baru berhasil dirilis: ${result.release_token}`,
        data: result,
      });
    }

    if (action === 'BROADCAST') {
      if (!message || !message.trim()) {
        return NextResponse.json(
          { success: false, error: 'Pesan pengumuman kilat tidak boleh kosong.' },
          { status: 400 }
        );
      }
      const result = await db.broadcastExamAnnouncement(examId, message.trim());
      return NextResponse.json({
        success: true,
        message: 'Pengumuman kilat berhasil dikirim ke layar seluruh siswa.',
        data: result,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Aksi proktor tidak valid.' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses aksi kendali proktor.' },
      { status: 500 }
    );
  }
}
