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

    const result = await ExamSessionStateService.startSession(authResult.context);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: (result as any).statusCode || 400 }
      );
    }


    return NextResponse.json({
      success: true,
      message: 'Ujian berhasil dimulai.',
      data: result,
    });
  } catch (error: any) {
    console.error('Error in POST /api/exam/session/start:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memulai sesi ujian.' },
      { status: 500 }
    );
  }
}
