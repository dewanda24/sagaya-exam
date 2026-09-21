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
    const { questionId, answer, answerValue, clientVersion, version, isDoubtful, clear } = body;

    const finalQuestionId = questionId;
    const finalAnswer = answer !== undefined ? answer : answerValue;
    const finalVersion = typeof clientVersion === 'number' ? clientVersion : typeof version === 'number' ? version : 1;

    if (!finalQuestionId) {
      return NextResponse.json(
        { success: false, error: 'ID Soal wajib disertakan.' },
        { status: 400 }
      );
    }

    const result = await ExamAnswerService.saveAnswer(authResult.context, {
      questionId: finalQuestionId,
      answer: finalAnswer,
      clientVersion: finalVersion,
      isDoubtful,
      clear: Boolean(clear),
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code, serverVersion: result.serverVersion },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/exam/session/current/answers:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memproses jawaban ujian.' },
      { status: 500 }
    );
  }
}
