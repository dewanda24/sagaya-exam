import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherQuestionService } from '@/lib/services/teacher-question.service';

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

    const { id } = await params;
    const duplicated = await TeacherQuestionService.duplicateQuestion(
      schoolId,
      auth.user.id,
      id,
      auth.user
    );

    return NextResponse.json({
      success: true,
      message: 'Soal berhasil diduplikasi.',
      data: duplicated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal menduplikasi soal.' },
      { status: 400 }
    );
  }
}
