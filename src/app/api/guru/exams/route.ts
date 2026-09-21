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
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 20;
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : 0;

    const data = await TeacherExamService.listExams(
      schoolId,
      auth.user.id,
      { status, search, limit, offset },
      auth.user.role
    );

    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat daftar ujian.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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

    const body = await req.json();

    const created = await TeacherExamService.createExam(
      schoolId,
      auth.user.id,
      {
        title: body.title,
        subjectId: body.subjectId,
        targetClassIds: body.targetClassIds || [],
        academicYearId: body.academicYearId,
        semesterId: body.semesterId,
        durationMinutes: Number(body.durationMinutes || 90),
        startTime: body.startTime,
        endTime: body.endTime,
        randomizeQuestions: body.randomizeQuestions,
        randomizeOptions: body.randomizeOptions,
        showScorePolicy: body.showScorePolicy,
        questionIds: body.questionIds,
        passingGrade: body.passingGrade ? Number(body.passingGrade) : 75,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      message: 'Ujian berhasil dibuat sebagai DRAFT.',
      data: created,
    });
  } catch (err: any) {
    const status = err.message?.includes('Akses ditolak') ? 403 : 400;
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal membuat ujian.' },
      { status }
    );
  }
}
