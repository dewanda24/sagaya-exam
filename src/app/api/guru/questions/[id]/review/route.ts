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
    const body = await req.json();
    const action = body.action as 'APPROVE' | 'REJECT' | 'REQUEST_REVISION';
    const reason = body.reason;

    if (!['APPROVE', 'REJECT', 'REQUEST_REVISION'].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Aksi review harus salah satu dari: 'APPROVE', 'REJECT', atau 'REQUEST_REVISION'." },
        { status: 400 }
      );
    }

    const res = await TeacherQuestionService.reviewQuestion(
      schoolId,
      auth.user.id,
      id,
      action,
      reason,
      auth.user
    );

    return NextResponse.json(res);
  } catch (err: any) {
    const status = err.message?.includes('Akses ditolak') ? 403 : 400;
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memproses review soal.' },
      { status }
    );
  }
}
