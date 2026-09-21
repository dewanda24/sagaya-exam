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
    const { currentQuestionIndex = 0 } = body;

    const result = await ExamSessionStateService.heartbeat(
      authResult.context,
      Number(currentQuestionIndex) || 0
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/exam/session/heartbeat:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memproses detak jantung (heartbeat) sesi.' },
      { status: 500 }
    );
  }
}
