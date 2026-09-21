import { NextResponse } from 'next/server';
import { db } from '@/lib/school/db-service';
import { verifyStudentSessionAccess } from '@/lib/core/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // IDOR Protection: Verify student session binding
    const authCheck = await verifyStudentSessionAccess(req, sessionId);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error || 'Akses ditolak.' },
        { status: authCheck.status || 401 }
      );
    }

    const { questionId, answerValue, isDoubtful } = await req.json();

    if (!questionId) {
      return NextResponse.json(
        { success: false, error: 'ID Soal wajib disertakan.' },
        { status: 400 }
      );
    }

    const session = await db.getSessionById(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sesi ujian tidak valid.' },
        { status: 404 }
      );
    }

    if (session.status === 'SUBMITTED' || session.status === 'EXPIRED') {
      return NextResponse.json(
        { success: false, error: 'Ujian sudah diserahkan atau waktu telah habis.' },
        { status: 403 }
      );
    }

    // Validate questionId belongs to the exam's snapshot questions (Fix H-006)
    const snapshot = session.participant?.exam?.questionSnapshotJson;
    if (Array.isArray(snapshot) && snapshot.length > 0) {
      const questionExists = snapshot.some((q: any) => q.id === questionId);
      if (!questionExists) {
        return NextResponse.json(
          { success: false, error: 'ID Soal tidak terdaftar dalam paket ujian sesi ini.' },
          { status: 400 }
        );
      }
    }

    const saved = await db.saveAnswer(sessionId, questionId, answerValue, !!isDoubtful);

    return NextResponse.json({
      success: true,
      data: {
        savedAt: saved.updatedAt,
        questionId: saved.questionId,
        isDoubtful: saved.isDoubtful,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyimpan jawaban otomatis.' },
      { status: 500 }
    );
  }
}
