import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { ProctorNoteService } from '@/lib/services/proctor-note.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');
    const participantId = searchParams.get('participantId') || undefined;

    if (!examId) {
      return NextResponse.json(
        { success: false, error: 'Parameter examId wajib disertakan.' },
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

    const data = await ProctorNoteService.getNotes(auth.user, schoolId, examId, participantId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat catatan pengawas.' },
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
    const { examId, roomId, participantId, content } = body;

    if (!examId || !content) {
      return NextResponse.json(
        { success: false, error: 'Parameter examId dan content wajib diisi.' },
        { status: 400 }
      );
    }

    const note = await ProctorNoteService.createNote(auth.user, schoolId, examId, {
      roomId,
      participantId,
      content,
    });

    return NextResponse.json({
      success: true,
      message: 'Catatan pengawas berhasil disimpan.',
      data: note,
    });
  } catch (error: any) {
    const isForbidden = error.message?.includes('Akses ditolak');
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyimpan catatan pengawas.' },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
