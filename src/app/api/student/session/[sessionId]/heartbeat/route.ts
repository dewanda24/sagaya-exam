import { NextResponse } from 'next/server';
import { db } from '@/lib/school/db-service';
import { queryPostgres } from '@/lib/core/postgres';
import { verifyStudentSessionAccess } from '@/lib/core/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // IDOR Protection: Verify student session binding or proctor staff
    const authCheck = await verifyStudentSessionAccess(req, sessionId);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error || 'Akses ditolak.' },
        { status: authCheck.status || 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { currentQuestionIndex = 0, tabViolations = 0 } = body;

    // Sanitize values (Fix H-005: prevent negative or invalid numbers)
    const safeViolations = Math.max(0, Math.min(1000, Number(tabViolations) || 0));
    const safeQuestionIndex = Math.max(0, Number(currentQuestionIndex) || 0);

    const session = await db.getSessionById(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sesi ujian tidak ditemukan.' },
        { status: 404 }
      );
    }

    await db.updateHeartbeat(sessionId, safeQuestionIndex, safeViolations);

    // Hitung sisa waktu server
    const now = Date.now();
    const expiresAt = new Date(session.serverExpiresAt).getTime();
    const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));

    // Jika waktu server habis, auto-expire / force submit
    let isExpired = remainingSeconds <= 0;
    if (isExpired && session.status === 'IN_PROGRESS') {
      await db.submitExam(sessionId);
    }

    // Query active broadcast announcement within last 10 minutes
    const bcastRes = await queryPostgres(
      `SELECT e.active_broadcast_message
       FROM exam_sessions es
       JOIN exam_participants ep ON es.participant_id = ep.id
       JOIN exams e ON ep.exam_id = e.id
       WHERE es.id = $1 
         AND e.active_broadcast_message IS NOT NULL 
         AND e.active_broadcast_at >= NOW() - INTERVAL '10 minutes'
       LIMIT 1;`,
      [sessionId]
    ).catch(() => ({ rows: [] }));
    const broadcastMessage = bcastRes.rows[0]?.active_broadcast_message || null;

    return NextResponse.json({
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        remainingSeconds,
        isExpired,
        status: session.status,
        broadcastMessage,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Heartbeat error.' },
      { status: 500 }
    );
  }
}
