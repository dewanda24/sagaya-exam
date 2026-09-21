import { NextResponse } from 'next/server';
import { authenticateStudentSession } from '@/lib/core/auth';
import { ExamAnswerService } from '@/lib/services/exam-answer.service';

export async function POST(req: Request) {
  try {
    const authResult = await authenticateStudentSession(req);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, code: authResult.code },
        { status: authResult.status }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { questionId, isDoubtful } = body;

    if (!questionId) {
      return NextResponse.json(
        { success: false, error: 'ID Soal wajib disertakan.' },
        { status: 400 }
      );
    }

    const result = await ExamAnswerService.toggleMarkForReview(
      authResult.context,
      questionId,
      Boolean(isDoubtful)
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/exam/session/current/answers/mark:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memperbarui status ragu-ragu.' },
      { status: 500 }
    );
  }
}
