import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherQuestionService } from '@/lib/services/teacher-question.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(['GURU', 'ADMIN', 'SUPER_ADMIN']);
  if (!auth.authorized) return auth.response;

  try {
    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const { id } = await params;
    const question = await TeacherQuestionService.getQuestionDetail(
      schoolId,
      auth.user.id,
      id,
      auth.user.role
    );

    return NextResponse.json({ success: true, data: question });
  } catch (err: any) {
    const status = err.message?.includes('Akses ditolak') ? 403 : 404;
    return NextResponse.json(
      { success: false, error: err.message || 'Soal tidak ditemukan.' },
      { status }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(['GURU', 'ADMIN', 'SUPER_ADMIN']);
  if (!auth.authorized) return auth.response;

  try {
    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    const updated = await TeacherQuestionService.updateQuestion(
      schoolId,
      auth.user.id,
      id,
      {
        topic: body.topic,
        difficulty: body.difficulty,
        type: body.type,
        questionText: body.questionText,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
        options: body.options,
        answerKey: body.answerKey,
        explanation: body.explanation,
        rubric: body.rubric,
        weight: body.weight !== undefined ? Number(body.weight) : undefined,
        tags: body.tags,
        stimulusTitle: body.stimulusTitle,
        stimulusText: body.stimulusText,
        expectedVersion: body.expectedVersion,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      message: 'Soal berhasil diperbarui.',
      data: updated,
    });
  } catch (err: any) {
    let status = 400;
    if (err.message?.includes('Akses ditolak')) status = 403;
    if (err.message?.includes('tidak ditemukan')) status = 404;
    if (err.message?.includes('Data telah berubah')) status = 409; // Concurrency conflict
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memperbarui soal.' },
      { status }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(['GURU', 'ADMIN', 'SUPER_ADMIN']);
  if (!auth.authorized) return auth.response;

  try {
    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const { id } = await params;
    const res = await TeacherQuestionService.deleteDraftQuestion(
      schoolId,
      auth.user.id,
      id,
      auth.user
    );

    return NextResponse.json(res);
  } catch (err: any) {
    const status = err.message?.includes('Akses ditolak') ? 403 : 400;
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal menghapus soal.' },
      { status }
    );
  }
}
