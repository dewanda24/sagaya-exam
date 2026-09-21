import { NextResponse } from 'next/server';
import { authenticateStudentSession } from '@/lib/core/auth';
import { ExamAnswerService } from '@/lib/services/exam-answer.service';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateStudentSession(req);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, code: authResult.code },
        { status: authResult.status }
      );
    }

    const summary = await ExamAnswerService.getAnswerReviewSummary(authResult.context);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error in GET /api/exam/session/current/summary:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat ringkasan pengerjaan ujian.' },
      { status: 500 }
    );
  }
}
