import { NextResponse } from 'next/server';
import { authenticateStudentSession } from '@/lib/core/auth';
import { QuestionDeliveryService } from '@/lib/services/question-delivery.service';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateStudentSession(req);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, code: authResult.code },
        { status: authResult.status }
      );
    }

    const questions = await QuestionDeliveryService.getSessionQuestions(authResult.context);

    return NextResponse.json({
      success: true,
      data: questions,
    });
  } catch (error: any) {
    console.error('Error in GET /api/exam/session/current/questions:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat butir soal ujian.' },
      { status: 500 }
    );
  }
}
