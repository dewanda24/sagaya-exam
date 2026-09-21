import { NextResponse } from 'next/server';
import { db } from '@/lib/school/db-service';
import { verifyStudentSessionAccess } from '@/lib/core/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // IDOR Protection: Verify student session binding or authorized proctor staff
    const authCheck = await verifyStudentSessionAccess(req, sessionId);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error || 'Akses ditolak.' },
        { status: authCheck.status || 401 }
      );
    }

    const session = await db.getSessionById(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sesi ujian tidak ditemukan.' },
        { status: 404 }
      );
    }

    if (session.status === 'SUBMITTED') {
      return NextResponse.json({
        success: true,
        message: 'Ujian telah dikirimkan sebelumnya.',
        data: {
          finalScore: session.participant?.finalScore ?? 0,
          submittedAt: session.submittedAt,
        },
      });
    }

    const result = await db.submitExam(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Ujian berhasil diserahkan.',
      data: {
        finalScore: result.finalScore,
        totalEarned: result.totalEarned,
        maxPossibleScore: result.maxPossibleScore,
        needsManualGrading: result.needsManualGrading,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengirimkan ujian.' },
      { status: 500 }
    );
  }
}
