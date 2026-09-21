import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamResultService } from '@/lib/services/exam-result.service';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('results.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');
    const classId = searchParams.get('classId') || undefined;
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;

    // Ambil daftar exams untuk filter dropdown
    const examsRes = await queryPostgres(
      `SELECT id, title, status FROM exams WHERE school_id = $1 ORDER BY start_time DESC;`,
      [schoolId]
    );

    const targetExamId = examId || examsRes.rows[0]?.id;
    if (!targetExamId) {
      return NextResponse.json({
        success: true,
        data: {
          exams: [],
          exam: null,
          statistics: null,
          participants: [],
        },
      });
    }

    const results = await ExamResultService.getExamResults(schoolId, targetExamId, { classId, search, status });

    return NextResponse.json({
      success: true,
      data: {
        exams: examsRes.rows,
        ...results,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat hasil ujian.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('results.publish');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { examId, resultIds } = body;

    if (!examId) {
      return NextResponse.json({ success: false, error: 'examId wajib diisi.' }, { status: 400 });
    }

    const res = await ExamResultService.publishResults(
      examId,
      schoolId,
      {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
      },
      resultIds
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil mempublikasikan ${res.publishedCount} hasil ujian.`,
      data: res,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mempublikasikan hasil ujian.' },
      { status: 400 }
    );
  }
}
