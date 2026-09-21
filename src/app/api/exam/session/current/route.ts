import { NextResponse } from 'next/server';
import { authenticateStudentSession } from '@/lib/core/auth';
import { ExamSessionStateService } from '@/lib/services/exam-session-state.service';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateStudentSession(req);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, code: authResult.code },
        { status: authResult.status }
      );
    }

    const data = await ExamSessionStateService.getCurrentSessionData(authResult.context);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/exam/session/current:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memuat sesi ujian saat ini.' },
      { status: 500 }
    );
  }
}
