import { NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/core/postgres';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/core/auth';

/**
 * GET /api/admin/item-analysis?examId=...
 * Calculates Item Difficulty (Tingkat Kesukaran), Discrimination Index (Daya Pembeda),
 * and Distractor Efficiency (Efektivitas Pengecoh).
 */
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user || !['SUPER_ADMIN', 'ADMIN', 'GURU'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let examId = searchParams.get('examId');

    // Get available exams for selection dropdown
    let availableExamsQuery = `
      SELECT e.id, e.title, s.name as subject_name, e.created_at, sc.name as school_name
      FROM exams e
      JOIN subjects s ON e.subject_id = s.id
      LEFT JOIN schools sc ON e.school_id = sc.id
    `;
    const queryParams: any[] = [];
    if (user.role !== 'SUPER_ADMIN' && user.schoolId) {
      availableExamsQuery += ` WHERE e.school_id = $1`;
      queryParams.push(user.schoolId);
    }
    availableExamsQuery += ` ORDER BY e.created_at DESC LIMIT 30;`;
    const availableExamsRes = await queryPostgres(availableExamsQuery, queryParams);

    if (!examId && availableExamsRes.rows.length > 0) {
      examId = availableExamsRes.rows[0].id;
    }

    if (!examId) {
      return NextResponse.json({
        success: true,
        data: {
          exam: null,
          availableExams: availableExamsRes.rows,
          analysis: [],
          summary: { totalStudents: 0, totalQuestions: 0, avgDifficulty: 0 },
        },
      });
    }

    // Fetch exam info
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

    const questions: any[] = exam.question_snapshot_json || [];

    // Fetch participants with completed sessions and their final scores
    const participantsRes = await queryPostgres(
      `SELECT ep.id, ep.final_score, s.full_name, c.name as class_name, es.id as session_id
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       LEFT JOIN exam_sessions es ON ep.id = es.participant_id
       WHERE ep.exam_id = $1 AND ep.final_score IS NOT NULL
       ORDER BY ep.final_score DESC;`,
      [examId]
    );

    const completedParticipants = participantsRes.rows;
    const totalStudents = completedParticipants.length;

    // Fetch all student answers for this exam
    const answersRes = await queryPostgres(
      `SELECT sa.session_id, sa.question_id, sa.answer_value_json, sa.auto_score, sa.manual_score, es.participant_id
       FROM student_answers sa
       JOIN exam_sessions es ON sa.session_id = es.id
       WHERE es.participant_id IN (
         SELECT id FROM exam_participants WHERE exam_id = $1
       );`,
      [examId]
    );

    // Map answers by participantId -> questionId -> answer
    const answerMap = new Map<string, Map<string, any>>();
    for (const ans of answersRes.rows) {
      const pId = ans.participant_id;
      if (!answerMap.has(pId)) {
        answerMap.set(pId, new Map());
      }
      answerMap.get(pId)!.set(ans.question_id, ans);
    }

    // Split participants into Upper Group (Kelompok Atas: top 27% or top 50%) and Lower Group (Kelompok Bawah)
    const upperCount = Math.max(1, Math.round(totalStudents * 0.27));
    const upperGroup = completedParticipants.slice(0, upperCount);
    const lowerGroup = completedParticipants.slice(Math.max(0, totalStudents - upperCount));

    const analysis = questions.map((q, idx) => {
      const qId = q.id;
      const weight = q.weight || 10;
      let totalScoreEarned = 0;
      let correctCount = 0;
      const distractorDistribution: Record<string, number> = {};

      if (q.options && Array.isArray(q.options)) {
        for (const opt of q.options) {
          distractorDistribution[opt.key] = 0;
        }
      }

      let upperCorrect = 0;
      let lowerCorrect = 0;

      for (const p of completedParticipants) {
        const ansObj = answerMap.get(p.id)?.get(qId);
        if (ansObj) {
          const score = (ansObj.autoScore ?? ansObj.auto_score ?? 0) + (ansObj.manualScore ?? ansObj.manual_score ?? 0);
          totalScoreEarned += score;

          // Check if deemed fully correct or >= 70% of question weight
          const isCorrect = score >= weight * 0.7;
          if (isCorrect) correctCount++;

          // Track distractor for single choice
          const val = ansObj.answerValue ?? ansObj.answer_value_json;
          if (typeof val === 'string' && distractorDistribution[val] !== undefined) {
            distractorDistribution[val]++;
          }
        }
      }

      // Upper group stats
      for (const p of upperGroup) {
        const ansObj = answerMap.get(p.id)?.get(qId);
        if (ansObj) {
          const score = (ansObj.autoScore ?? ansObj.auto_score ?? 0) + (ansObj.manualScore ?? ansObj.manual_score ?? 0);
          if (score >= weight * 0.7) upperCorrect++;
        }
      }

      // Lower group stats
      for (const p of lowerGroup) {
        const ansObj = answerMap.get(p.id)?.get(qId);
        if (ansObj) {
          const score = (ansObj.autoScore ?? ansObj.auto_score ?? 0) + (ansObj.manualScore ?? ansObj.manual_score ?? 0);
          if (score >= weight * 0.7) lowerCorrect++;
        }
      }

      // 1. Tingkat Kesukaran (P): Nilai Rata-rata / Bobot Maksimal (0.00 - 1.00)
      const difficultyIndex =
        totalStudents > 0 ? parseFloat((correctCount / totalStudents).toFixed(2)) : 0;

      let difficultyCategory = 'Sedang';
      if (difficultyIndex > 0.7) {
        difficultyCategory = 'Mudah';
      } else if (difficultyIndex < 0.3) {
        difficultyCategory = 'Sukar';
      }

      // 2. Daya Pembeda (D): (Benar Kelompok Atas - Benar Kelompok Bawah) / Ukuran Kelompok
      const discriminationIndex =
        upperGroup.length > 0
          ? parseFloat(((upperCorrect - lowerCorrect) / upperGroup.length).toFixed(2))
          : 0;

      let discriminationCategory = 'Cukup';
      if (discriminationIndex >= 0.4) {
        discriminationCategory = 'Sangat Baik';
      } else if (discriminationIndex >= 0.3) {
        discriminationCategory = 'Baik';
      } else if (discriminationIndex >= 0.2) {
        discriminationCategory = 'Cukup';
      } else {
        discriminationCategory = 'Buruk (Perlu Revisi)';
      }

      return {
        number: idx + 1,
        questionId: q.id,
        type: q.type,
        topic: q.topic || 'Umum',
        cognitiveLevel: q.cognitiveLevel || 'L2_PENERAPAN',
        competenceCode: q.competenceCode || '',
        questionText: q.questionText,
        weight,
        correctCount,
        totalAnswered: totalStudents,
        difficultyIndex,
        difficultyCategory,
        discriminationIndex,
        discriminationCategory,
        distractorDistribution,
        answerKey: q.answerKey,
      };
    });

    const avgDiff =
      analysis.length > 0
        ? parseFloat((analysis.reduce((acc, curr) => acc + curr.difficultyIndex, 0) / analysis.length).toFixed(2))
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          subjectName: exam.subject_name,
          schoolName: exam.school_name || 'SMA Negeri Sagaya',
          durationMinutes: exam.duration_minutes,
        },
        availableExams: availableExamsRes.rows,
        analysis,
        summary: {
          totalStudents,
          totalQuestions: questions.length,
          avgDifficulty: avgDiff,
          sukarCount: analysis.filter((a) => a.difficultyCategory === 'Sukar').length,
          sedangCount: analysis.filter((a) => a.difficultyCategory === 'Sedang').length,
          mudahCount: analysis.filter((a) => a.difficultyCategory === 'Mudah').length,
          goodDiscriminationCount: analysis.filter((a) => ['Baik', 'Sangat Baik'].includes(a.discriminationCategory)).length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error calculating item analysis:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghitung analisis butir soal.' },
      { status: 500 }
    );
  }
}
