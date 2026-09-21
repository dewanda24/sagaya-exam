import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherGradingService } from '@/lib/services/teacher-grading.service';

export async function POST(
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

    const { id: answerId } = await params;
    const body = await req.json();

    if (body.manualScore === undefined || body.manualScore === null) {
      return NextResponse.json(
        { success: false, error: 'Nilai manual (manualScore) wajib diisi.' },
        { status: 400 }
      );
    }

    const res = await TeacherGradingService.gradeEssay(
      schoolId,
      auth.user.id,
      answerId,
      {
        manualScore: Number(body.manualScore),
        rubricScores: body.rubricScores,
        feedback: body.feedback,
        teacherInternalNote: body.teacherInternalNote,
        clientVersion: body.clientVersion !== undefined ? Number(body.clientVersion) : undefined,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      message: 'Penilaian essay berhasil disimpan.',
      data: res,
    });
  } catch (err: any) {
    const status =
      err.code === 'REVIEW_CONFLICT' || err.status === 409
        ? 409
        : err.message?.includes('Akses ditolak')
        ? 403
        : 400;

    return NextResponse.json(
      { success: false, error: err.message || 'Gagal menyimpan penilaian essay.', code: err.code },
      { status }
    );
  }
}
