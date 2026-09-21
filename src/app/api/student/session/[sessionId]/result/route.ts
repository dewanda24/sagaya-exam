import { NextResponse } from 'next/server';
import { db } from '@/lib/school/db-service';
import { queryPostgres } from '@/lib/core/postgres';
import { verifyStudentSessionAccess } from '@/lib/core/auth';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // IDOR Protection: Memastikan hanya sesi siswa bersangkutan yang berhak
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

    if (session.status !== 'SUBMITTED') {
      return NextResponse.json(
        { success: false, error: 'Sesi ujian belum selesai dikumpulkan.' },
        { status: 400 }
      );
    }

    const participant = session.participant;
    const exam = participant?.exam;
    if (!exam || !participant) {
      return NextResponse.json(
        { success: false, error: 'Data ujian tidak valid.' },
        { status: 404 }
      );
    }

    // Periksa status publikasi ujian & kebijakan tampilan nilai
    const examRes = await queryPostgres(
      `SELECT show_score_policy, passing_grade FROM exams WHERE id = $1;`,
      [exam.id]
    );
    const examRule = examRes.rows[0];
    const showScorePolicy = examRule?.show_score_policy || 'AFTER_ALL_DONE';
    const passingGrade = parseFloat(examRule?.passing_grade || '75');

    // Cari data di exam_results jika sudah terkompilasi
    const resultRes = await queryPostgres(
      `SELECT id, final_score, raw_score, max_score, percentage, is_passed, status, published_at
       FROM exam_results 
       WHERE exam_id = $1 AND student_id = $2
       LIMIT 1;`,
      [exam.id, participant.student?.id]
    );

    const examResult = resultRes.rows[0];
    const isImmediately = showScorePolicy === 'IMMEDIATELY';
    const isPublished = examResult?.status === 'PUBLISHED' || isImmediately;

    // Jika belum dipublikasikan
    if (!isPublished) {
      return NextResponse.json({
        success: true,
        data: {
          isPublished: false,
          exam: {
            title: exam.title,
            subject: exam.subjectName,
            passingGrade,
          },
          participant: {
            studentName: participant.student?.fullName,
            nisn: participant.student?.nisn,
            className: participant.student?.classRoomName,
          },
          session: {
            submittedAt: session.submittedAt,
          },
          message: 'Hasil ujian akan tersedia setelah proses penilaian dan verifikasi selesai diumumkan oleh pihak sekolah.',
        },
      });
    }

    // Jika sudah dipublikasikan: ambil breakdown perolehan poin tersanitasi (zero answer keys, zero private notes)
    let breakdown: any[] = [];
    if (examResult?.id) {
      const qRes = await queryPostgres(
        `SELECT eqr.score, eqr.max_score, eqr.feedback, esq.position, esq.configuration_json
         FROM exam_question_results eqr
         LEFT JOIN exam_snapshot_questions esq ON eqr.question_id = esq.question_id
         WHERE eqr.result_id = $1
         ORDER BY esq.position ASC NULLS LAST;`,
        [examResult.id]
      );

      breakdown = qRes.rows.map((row: any, idx: number) => {
        const qConf = row.configuration_json || {};
        return {
          number: row.position || idx + 1,
          questionText: qConf.questionText || '',
          score: parseFloat(row.score || 0),
          maxScore: parseFloat(row.max_score || 0),
          feedback: row.feedback || null,
        };
      });
    }

    const finalScore = examResult?.final_score !== undefined
      ? parseFloat(examResult.final_score)
      : (participant as any).finalScore ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        isPublished: true,
        exam: {
          title: exam.title,
          subject: exam.subjectName,
          passingGrade,
        },
        participant: {
          studentName: participant.student?.fullName,
          nisn: participant.student?.nisn,
          className: participant.student?.classRoomName,
        },
        session: {
          submittedAt: session.submittedAt,
        },
        score: {
          finalScore,
          passingGrade,
          isPassed: finalScore >= passingGrade,
          publishedAt: examResult?.published_at || session.submittedAt,
        },
        breakdown,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat hasil ujian.' },
      { status: 500 }
    );
  }
}
