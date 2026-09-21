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
    const res = await TeacherQuestionService.submitForReview(
      schoolId,
      auth.user.id,
      id,
      auth.user
    );

    return NextResponse.json(res);
  } catch (err: any) {
    const status = err.message?.includes('Akses ditolak') ? 403 : 400;
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal mengirim soal untuk review.' },
      { status }
    );
  }
}
