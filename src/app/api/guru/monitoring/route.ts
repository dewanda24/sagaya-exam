import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherExamService } from '@/lib/services/teacher-exam.service';

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
    const examId = url.searchParams.get('examId');

    if (!examId) {
      return NextResponse.json(
        { success: false, error: 'ID Ujian (examId) wajib disertakan.' },
        { status: 400 }
      );
    }

    const data = await TeacherExamService.getExamMonitoring(
      schoolId,
      auth.user.id,
      examId,
      auth.user.role
    );

    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    const status = err.message?.includes('Akses ditolak') ? 403 : 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat data monitoring ujian.' },
      { status }
    );
  }
}
