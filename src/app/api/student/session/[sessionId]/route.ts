import { NextResponse } from 'next/server';
import { db } from '@/lib/school/db-service';
import { verifyStudentSessionAccess } from '@/lib/core/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // IDOR Protection: Verify student session binding or authorized staff
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

    const participant = session.participant;
    const exam = participant?.exam;

    if (!exam) {
      return NextResponse.json(
        { success: false, error: 'Data ujian tidak valid.' },
        { status: 404 }
      );
    }

    // Amankan snapshot soal: Hapus answerKey dan explanation dari payload ke client!
    const clientSafeQuestions = exam.questionSnapshotJson.map((q) => {
      const { answerKey, explanation, ...safeQ } = q as any;

      // Sanitasi khusus soal MENJODOHKAN / MATCHING
      if (safeQ.type === 'MENJODOHKAN' || safeQ.type === 'MATCHING') {
        let leftItems: string[] = [];
        let rightItems: string[] = [];

        if (safeQ.matchingItems && Array.isArray(safeQ.matchingItems.leftItems)) {
          leftItems = safeQ.matchingItems.leftItems.map((i: any) => typeof i === 'object' ? i.text || i.label || String(i) : String(i));
          rightItems = safeQ.matchingItems.rightItems.map((i: any) => typeof i === 'object' ? i.text || i.label || String(i) : String(i));
        } else if (Array.isArray(safeQ.options) && safeQ.options.length > 0) {
          leftItems = safeQ.options.map((o: any) => typeof o === 'object' ? o.premise || o.text || String(o) : String(o));
          rightItems = safeQ.options.map((o: any) => typeof o === 'object' ? o.target || o.text || String(o) : String(o));
        } else if (answerKey) {
          if (Array.isArray(answerKey)) {
            leftItems = answerKey.map((pair: any) => pair.premise || pair.left || String(pair));
            rightItems = answerKey.map((pair: any) => pair.target || pair.right || String(pair));
          } else if (typeof answerKey === 'object') {
            leftItems = Object.keys(answerKey);
            rightItems = Object.values(answerKey).map(String);
          }
        }

        // Filter valid and deduplicate right items
        leftItems = leftItems.filter(Boolean);
        rightItems = Array.from(new Set(rightItems.filter(Boolean)));

        // Acak urutan opsi kanan agar tidak membocorkan pasangan paralel
        const shuffledRight = [...rightItems].sort(() => 0.5 - Math.random());

        safeQ.matchingItems = {
          leftItems: leftItems.map((text, idx) => ({ id: `left_${idx + 1}`, text })),
          rightItems: shuffledRight.map((text, idx) => ({ id: `right_${idx + 1}`, text })),
        };
      }

      return safeQ;
    });

    // Ambil jawaban yang sudah pernah tersimpan
    const savedAnswers = await db.getAnswersBySessionId(sessionId);

    // Hitung sisa waktu server
    const now = Date.now();
    const expiresAt = new Date(session.serverExpiresAt).getTime();
    const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          serverStartedAt: session.serverStartedAt,
          serverExpiresAt: session.serverExpiresAt,
          remainingSeconds,
          tabViolationCount: session.tabViolationCount,
        },
        participant: {
          studentName: participant?.student?.fullName,
          nisn: participant?.student?.nisn,
          className: participant?.student?.classRoomName,
          assignedPackage: participant?.assignedPackage,
        },
        exam: {
          id: exam.id,
          title: exam.title,
          subject: exam.subjectName,
          durationMinutes: exam.durationMinutes,
          navigationPolicy: (exam as any).navigationPolicy || 'FREE_NAVIGATION',
        },
        questions: clientSafeQuestions,
        answers: savedAnswers.reduce((acc: any, curr) => {
          acc[curr.questionId] = {
            value: curr.answerValue,
            isDoubtful: curr.isDoubtful,
          };
          return acc;
        }, {}),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat sesi ujian.' },
      { status: 500 }
    );
  }
}
