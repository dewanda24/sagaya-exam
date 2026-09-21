import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { SchoolExamService } from '@/lib/services/school-exam.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiPermission('exams.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { id: examId } = await params;
    const exam = await SchoolExamService.getExamById(schoolId, examId);
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        examId: exam.id,
        title: exam.title,
        status: exam.status,
        snapshotQuestions: exam.questionSnapshotJson,
        totalSnapshotQuestions: exam.questionSnapshotJson.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat snapshot ujian.' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiPermission('exams.lock');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { id: examId } = await params;
    const res = await SchoolExamService.publishAndLockExam(schoolId, examId, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: `Snapshot berhasil dibuat dan dibekukan. ${res.totalSnapshotQuestions} butir soal terkunci.`,
      data: res,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal membekukan snapshot ujian.' }, { status: 400 });
  }
}
