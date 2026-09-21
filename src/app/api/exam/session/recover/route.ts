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

    const data = await ExamSessionStateService.recover(authResult.context);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in POST /api/exam/session/recover:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memulihkan sesi ujian.' },
      { status: 500 }
    );
  }
}
