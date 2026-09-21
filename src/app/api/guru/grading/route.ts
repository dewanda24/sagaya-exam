import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherGradingService } from '@/lib/services/teacher-grading.service';

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const examId = url.searchParams.get('examId') || undefined;
    const classId = url.searchParams.get('classId') || undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : 0;

    const data = await TeacherGradingService.listPendingEssays(
      schoolId,
      auth.user.id,
      { examId, classId, limit, offset },
      auth.user.role
    );

    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat antrian penilaian essay.' },
      { status: 500 }
    );
  }
}
