import { NextResponse } from 'next/server';
import { authenticateStudentSession } from '@/lib/core/auth';
import { ExamSessionStateService } from '@/lib/services/exam-session-state.service';

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
    const { questionId, answerValue, isDoubtful, version } = body;

    if (!questionId || typeof questionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID Soal wajib disertakan.' },
        { status: 400 }
      );
    }

    const result = await ExamSessionStateService.autosave(authResult.context, {
      questionId,
      answerValue,
      isDoubtful: !!isDoubtful,
      version: typeof version === 'number' ? version : 1,
    });

    if (!result.success) {
      const err = result as any;
      return NextResponse.json(
        { success: false, error: err.error },
        { status: err.status || 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/exam/session/autosave:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal menyimpan jawaban otomatis.' },
      { status: 500 }
    );
  }
}
