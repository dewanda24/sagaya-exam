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

    const result = await ExamSessionStateService.submit(authResult.context);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/exam/session/submit:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mengirimkan jawaban ujian.' },
      { status: 500 }
    );
  }
}
