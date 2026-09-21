import { NextResponse } from 'next/server';
import { authenticateStudentSession } from '@/lib/core/auth';
import { ExamSessionStateService } from '@/lib/services/exam-session-state.service';

/**
 * POST /api/exam/session
 * Starts or enters active exam session for the authenticated student.
 */
export async function POST(req: Request) {
  try {
    const authResult = await authenticateStudentSession(req);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, code: authResult.code },
        { status: authResult.status }
      );
    }

    // If currently READY, transition to IN_PROGRESS
    if (authResult.context.status === 'READY') {
      const startRes = await ExamSessionStateService.startSession(authResult.context);
      if (!startRes.success) {
        return NextResponse.json(
          { success: false, error: startRes.error },
          { status: (startRes as any).statusCode || 400 }
        );
      }

    }

    const data = await ExamSessionStateService.getCurrentSessionData(authResult.context);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in POST /api/exam/session:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memproses sesi ujian.' },
      { status: 500 }
    );
  }
}
