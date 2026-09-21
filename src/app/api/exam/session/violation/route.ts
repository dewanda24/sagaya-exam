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
    const { type, severity, metadata } = body;

    const allowedTypes = [
      'TAB_SWITCH',
      'FOCUS_LOST',
      'FULLSCREEN_EXIT',
      'NETWORK_DISCONNECT',
      'DEVICE_MISMATCH',
      'SUSPICIOUS_RECONNECT',
    ];

    const safeType = allowedTypes.includes(type) ? type : 'FOCUS_LOST';
    const safeSeverity = ['INFO', 'WARNING', 'CRITICAL'].includes(severity) ? severity : 'WARNING';

    const result = await ExamSessionStateService.recordViolation(authResult.context, {
      type: safeType as any,
      severity: safeSeverity as any,
      metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/exam/session/violation:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mencatat kejadian pelanggaran sesi.' },
      { status: 500 }
    );
  }
}
