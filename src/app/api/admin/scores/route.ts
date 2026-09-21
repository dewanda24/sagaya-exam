import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { calculateParticipantScore } from '@/lib/school/scoring-engine';
import { verifySessionToken } from '@/lib/core/auth';
import { getTenantContext } from '@/lib/core/tenant';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenant = await getTenantContext(user, searchParams);
    let examId = searchParams.get('examId');

    // List available exams for active tenant
    let examsSql = `SELECT id, title, status FROM exams WHERE 1=1`;
    const examFilterParams: any[] = [];
    if (tenant.schoolId) {
      examFilterParams.push(tenant.schoolId);
      examsSql += ` AND school_id = $1`;
    }
    examsSql += ` ORDER BY created_at DESC;`;
    const availableExamsRes = await queryPostgres(examsSql, examFilterParams);

    if (!examId) {
      if (availableExamsRes.rows.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            exam: null,
            participants: [],
            stats: { totalStudents: 0, completedCount: 0, averageScore: 0, highestScore: 0, lowestScore: 0 },
            availableExams: [],
          },
        });
      }
      examId = availableExamsRes.rows[0].id;
    }

    const examRes = await queryPostgres(
      `SELECT e.*, s.name as subject_name, sc.name as school_name 
       FROM exams e 
       JOIN subjects s ON e.subject_id = s.id 
       LEFT JOIN schools sc ON e.school_id = sc.id
       WHERE e.id = $1;`,
      [examId]
    );
    const exam = examRes.rows[0];
    if (!exam) {
      return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    const participantsRes = await queryPostgres(
      `SELECT ep.*, s.full_name, s.nisn, s.nis, c.name as class_name,
              es.id as session_id, es.status as session_status, es.server_started_at, es.submitted_at,
              es.tab_violation_count
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       LEFT JOIN exam_sessions es ON ep.id = es.participant_id
       WHERE ep.exam_id = $1
       ORDER BY c.name ASC, s.full_name ASC;`,
      [examId]
    );

    // Fetch student answers for essays
    const essayAnswersRes = await queryPostgres(
      `SELECT sa.*, es.participant_id
       FROM student_answers sa
       JOIN exam_sessions es ON sa.session_id = es.id
       WHERE es.participant_id IN (
         SELECT id FROM exam_participants WHERE exam_id = $1
       );`,
      [examId]
    );

    const essayMap = new Map<string, any[]>();
    for (const ans of essayAnswersRes.rows) {
      const pId = ans.participant_id;
      if (!essayMap.has(pId)) essayMap.set(pId, []);
      essayMap.get(pId)?.push({
        questionId: ans.question_id,
        answerValue: ans.answer_value_json,
        autoScore: ans.auto_score,
        manualScore: ans.manual_score,
        feedback: ans.feedback,
      });
    }

    const questions = exam.question_snapshot_json || [];

    const participants = participantsRes.rows.map((r: any) => ({
      participantId: r.id,
      sessionId: r.session_id || r.id,
      studentId: r.student_id,
      fullName: r.full_name,
      nisn: r.nisn,
      nis: r.nis,
      className: r.class_name || 'Tanpa Kelas',
      token: r.token,
      assignedPackage: r.assigned_package,
      finalScore: r.final_score !== null ? parseFloat(r.final_score) : null,
      gradedStatus: r.graded_status || 'PENDING',
      sessionStatus: r.session_status || 'NOT_STARTED',
      startedAt: r.server_started_at,
      submittedAt: r.submitted_at,
      tabViolations: r.tab_violation_count || 0,
      answers: essayMap.get(r.id) || [],
    }));

    // Summary statistics
    const passingGrade = exam.passing_grade ? parseFloat(exam.passing_grade) : 75;
    const completed = participants.filter((p) => p.finalScore !== null);
    const passed = completed.filter((p) => (p.finalScore || 0) >= passingGrade);
    const remedial = completed.filter((p) => (p.finalScore || 0) < passingGrade);
    const avgScore =
      completed.length > 0
        ? (completed.reduce((acc, curr) => acc + (curr.finalScore || 0), 0) / completed.length).toFixed(1)
        : 0;
    const highestScore =
      completed.length > 0 ? Math.max(...completed.map((p) => p.finalScore || 0)) : 0;
    const lowestScore =
      completed.length > 0 ? Math.min(...completed.map((p) => p.finalScore || 0)) : 0;

    return NextResponse.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          subjectName: exam.subject_name,
          schoolName: exam.school_name || 'SMA Negeri 1 Sagaya',
          durationMinutes: exam.duration_minutes,
          passingGrade,
          scoringRules: exam.scoring_rules_json || null,
          totalQuestions: questions.length,
          questions,
        },
        participants,
        availableExams: availableExamsRes.rows,
        stats: {
          totalStudents: participants.length,
          completedCount: completed.length,
          passedCount: passed.length,
          remedialCount: remedial.length,
          passRate: completed.length > 0 ? Math.round((passed.length / completed.length) * 100) : 0,
          averageScore: parseFloat(avgScore as string),
          highestScore,
          lowestScore,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat rekap nilai.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, questionId, manualScore, feedback, answers } = body;

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Parameter sessionId diperlukan.' }, { status: 400 });
    }

    const itemsToUpdate: Array<{ questionId: string; manualScore: number; feedback?: string }> = [];

    if (Array.isArray(answers) && answers.length > 0) {
      for (const a of answers) {
        if (a.questionId && a.manualScore !== undefined && a.manualScore !== null) {
          itemsToUpdate.push({
            questionId: a.questionId,
            manualScore: parseFloat(a.manualScore),
            feedback: a.feedback || '',
          });
        }
      }
    } else if (questionId && manualScore !== undefined) {
      itemsToUpdate.push({
        questionId,
        manualScore: parseFloat(manualScore),
        feedback: feedback || '',
      });
    }

    if (itemsToUpdate.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada nilai butir soal yang disertakan.' },
        { status: 400 }
      );
    }

    // Update all student_answers for this session/participant
    for (const item of itemsToUpdate) {
      await queryPostgres(
        `UPDATE student_answers 
         SET manual_score = $1, feedback = $2 
         WHERE (session_id = $3 OR session_id IN (SELECT id FROM exam_sessions WHERE participant_id = $3)) 
           AND question_id = $4;`,
        [item.manualScore, item.feedback || '', sessionId, item.questionId]
      );
    }

    // Recalculate participant score
    const sessionRes = await queryPostgres(
      `SELECT es.participant_id, ep.exam_id 
       FROM exam_sessions es 
       JOIN exam_participants ep ON es.participant_id = ep.id 
       WHERE es.id = $1 OR es.participant_id = $1;`,
      [sessionId]
    );

    if (sessionRes.rows.length > 0) {
      const { participant_id, exam_id } = sessionRes.rows[0];
      await calculateParticipantScore(exam_id, participant_id);

      // Check if all essay questions for this exam are now graded
      const examRes = await queryPostgres(`SELECT question_snapshot_json FROM exams WHERE id = $1;`, [exam_id]);
      const examQs = examRes.rows[0]?.question_snapshot_json || [];
      const essayQs = examQs.filter((q: any) => q.type === 'ESSAY');

      if (essayQs.length > 0) {
        const gradedAnswersRes = await queryPostgres(
          `SELECT question_id FROM student_answers 
           WHERE (session_id = $1 OR session_id IN (SELECT id FROM exam_sessions WHERE participant_id = $1))
             AND manual_score IS NOT NULL;`,
          [sessionId]
        );
        const gradedQIds = new Set(gradedAnswersRes.rows.map((r: any) => r.question_id));
        const allEssaysGraded = essayQs.every((eq: any) => gradedQIds.has(eq.id));

        if (allEssaysGraded) {
          await queryPostgres(
            `UPDATE exam_participants SET graded_status = 'GRADED' WHERE id = $1;`,
            [participant_id]
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${itemsToUpdate.length} butir jawaban essay berhasil dinilai dan nilai akhir peserta dikalkulasi ulang.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyimpan nilai essay.' },
      { status: 500 }
    );
  }
}
