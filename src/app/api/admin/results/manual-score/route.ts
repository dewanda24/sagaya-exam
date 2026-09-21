import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamResultService } from '@/lib/services/exam-result.service';

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
    const participantId = searchParams.get('participantId');

    if (!examId || !participantId) {
      return NextResponse.json({ success: false, error: 'examId dan participantId wajib diisi.' }, { status: 400 });
    }

    const data = await ExamResultService.getStudentAnswersForGrading(schoolId, examId, participantId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat lembar jawaban siswa.' }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('results.score');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { examId, participantId, questionId, score, feedback } = body;

    if (!examId || !participantId || !questionId || score === undefined) {
      return NextResponse.json(
        { success: false, error: 'examId, participantId, questionId, dan score wajib diisi.' },
        { status: 400 }
      );
    }

    const res = await ExamResultService.submitManualScore(
      schoolId,
      examId,
      participantId,
      questionId,
      parseFloat(score),
      feedback,
      {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Nilai essay berhasil disimpan dan nilai akhir siswa diperbarui.',
      data: res,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menyimpan nilai manual.' }, { status: 400 });
  }
}
