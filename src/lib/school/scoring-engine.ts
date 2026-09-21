import { QuestionBankItem } from '../core/types';

export interface QuestionScoreResult {
  questionId: string;
  isCorrect: boolean;
  score: number;
  maxScore: number;
  needsManualGrading: boolean;
  feedback?: string;
}

/**
 * Menilai jawaban siswa secara otomatis berdasarkan tipe soal dan kunci jawaban snapshot
 */
export function evaluateQuestionAnswer(
  question: QuestionBankItem,
  studentAnswer: any
): QuestionScoreResult {
  const maxScore = question.weight || 1.0;

  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
    return {
      questionId: question.id,
      isCorrect: false,
      score: 0,
      maxScore,
      needsManualGrading: question.type === 'ESSAY',
    };
  }

  switch (question.type) {
    case 'PILIHAN_GANDA': {
      const isCorrect = String(studentAnswer).trim().toUpperCase() === String(question.answerKey).trim().toUpperCase();
      return {
        questionId: question.id,
        isCorrect,
        score: isCorrect ? maxScore : 0,
        maxScore,
        needsManualGrading: false,
      };
    }

    case 'PG_KOMPLEKS': {
      // Array jawaban terpilih
      const userAnswers: string[] = Array.isArray(studentAnswer)
        ? studentAnswer.map((a) => String(a).trim().toUpperCase()).sort()
        : [];
      const correctAnswers: string[] = Array.isArray(question.answerKey)
        ? question.answerKey.map((a: any) => String(a).trim().toUpperCase()).sort()
        : [];

      // Periksa kecocokan persis
      const isExactMatch =
        userAnswers.length === correctAnswers.length &&
        userAnswers.every((val, idx) => val === correctAnswers[idx]);

      // Proporsional / Parsial (jika benar sebagian tanpa salah pilih)
      let score = 0;
      if (isExactMatch) {
        score = maxScore;
      } else if (correctAnswers.length > 0) {
        const truePositives = userAnswers.filter((a) => correctAnswers.includes(a)).length;
        const falsePositives = userAnswers.filter((a) => !correctAnswers.includes(a)).length;
        const netScore = Math.max(0, (truePositives - falsePositives) / correctAnswers.length);
        score = Number((netScore * maxScore).toFixed(2));
      }

      return {
        questionId: question.id,
        isCorrect: isExactMatch,
        score,
        maxScore,
        needsManualGrading: false,
      };
    }

    case 'BENAR_SALAH': {
      const userVal = String(studentAnswer).trim().toUpperCase();
      const keyVal = String(question.answerKey).trim().toUpperCase();
      const isCorrect = userVal === keyVal || userVal === (keyVal === 'TRUE' ? 'BENAR' : 'SALAH');
      return {
        questionId: question.id,
        isCorrect,
        score: isCorrect ? maxScore : 0,
        maxScore,
        needsManualGrading: false,
      };
    }

    case 'MENJODOHKAN': {
      // Objek pasangan: { "premise_id_1": "target_id_1", ... }
      const userPairs = typeof studentAnswer === 'object' && studentAnswer !== null ? studentAnswer : {};
      const keyPairs = typeof question.answerKey === 'object' && question.answerKey !== null ? question.answerKey : {};

      const totalPairs = Object.keys(keyPairs).length;
      if (totalPairs === 0) {
        return { questionId: question.id, isCorrect: true, score: maxScore, maxScore, needsManualGrading: false };
      }

      let matched = 0;
      for (const [premise, correctTarget] of Object.entries(keyPairs)) {
        if (userPairs[premise] && String(userPairs[premise]).trim() === String(correctTarget).trim()) {
          matched++;
        }
      }

      const score = Number(((matched / totalPairs) * maxScore).toFixed(2));
      return {
        questionId: question.id,
        isCorrect: matched === totalPairs,
        score,
        maxScore,
        needsManualGrading: false,
      };
    }

    case 'ISIAN_SINGKAT': {
      const userText = String(studentAnswer).trim().toLowerCase().replace(/\s+/g, ' ');
      // Kunci jawaban bisa berupa string tunggal atau array alternatif yang benar
      const allowedAnswers: string[] = Array.isArray(question.answerKey)
        ? question.answerKey.map((k: any) => String(k).trim().toLowerCase().replace(/\s+/g, ' '))
        : [String(question.answerKey).trim().toLowerCase().replace(/\s+/g, ' ')];

      const isCorrect = allowedAnswers.includes(userText);
      return {
        questionId: question.id,
        isCorrect,
        score: isCorrect ? maxScore : 0,
        maxScore,
        needsManualGrading: false,
      };
    }

    case 'ESSAY': {
      // Essay memerlukan penilaian manual guru
      return {
        questionId: question.id,
        isCorrect: false,
        score: 0,
        maxScore,
        needsManualGrading: true,
        feedback: 'Menunggu penilaian guru',
      };
    }

    default:
      return {
        questionId: question.id,
        isCorrect: false,
        score: 0,
        maxScore,
        needsManualGrading: false,
      };
  }
}

/**
 * Recalculate participant final score after essay grading or exam completion
 */
export async function calculateParticipantScore(examId: string, participantId: string): Promise<number> {
  const { queryPostgres } = await import('../core/postgres');

  // 1. Get exam snapshot and scoring rules
  const examRes = await queryPostgres(
    `SELECT question_snapshot_json, scoring_rules_json, passing_grade FROM exams WHERE id = $1;`,
    [examId]
  );
  const examRow = examRes.rows[0];
  const questions: QuestionBankItem[] = examRow?.question_snapshot_json || [];
  const scoringRules = examRow?.scoring_rules_json || {};

  // 2. Get student session
  const sessionRes = await queryPostgres(
    `SELECT id FROM exam_sessions WHERE participant_id = $1 LIMIT 1;`,
    [participantId]
  );
  if (sessionRes.rows.length === 0) return 0;
  const sessionId = sessionRes.rows[0].id;

  // 3. Fetch all student answers
  const answersRes = await queryPostgres(
    `SELECT question_id, COALESCE(auto_score, 0) as auto_score, COALESCE(manual_score, 0) as manual_score
     FROM student_answers WHERE session_id = $1;`,
    [sessionId]
  );
  const answersMap = new Map<string, number>();
  for (const row of answersRes.rows) {
    const totalQScore = (parseFloat(row.auto_score) || 0) + (parseFloat(row.manual_score) || 0);
    answersMap.set(row.question_id, totalQScore);
  }

  let finalScore = 0;

  // 4. Calculate score based on scoring mode
  if (scoringRules?.mode === 'PROPORTIONAL' && scoringRules?.proportional) {
    const objPct = Number(scoringRules.proportional.objectivePercentage || 70);
    const essayPct = Number(scoringRules.proportional.essayPercentage || 30);

    let earnedObj = 0;
    let maxObj = 0;
    let earnedEssay = 0;
    let maxEssay = 0;

    for (const q of questions) {
      const qWeight = q.weight || 1.0;
      const qScore = answersMap.get(q.id) || 0;

      if (q.type === 'ESSAY') {
        maxEssay += qWeight;
        earnedEssay += qScore;
      } else {
        maxObj += qWeight;
        earnedObj += qScore;
      }
    }

    if (maxObj > 0 && maxEssay > 0) {
      finalScore = (earnedObj / maxObj) * objPct + (earnedEssay / maxEssay) * essayPct;
    } else if (maxObj > 0) {
      finalScore = (earnedObj / maxObj) * 100;
    } else if (maxEssay > 0) {
      finalScore = (earnedEssay / maxEssay) * 100;
    }
  } else {
    // Default or TYPE_WEIGHTS mode
    let earnedScore = 0;
    let totalMaxScore = 0;

    for (const q of questions) {
      totalMaxScore += q.weight || 1.0;
      earnedScore += answersMap.get(q.id) || 0;
    }

    finalScore = totalMaxScore > 0 ? (earnedScore / totalMaxScore) * 100 : 0;
  }

  // Clamp score to 0 - 100 with 1 decimal
  finalScore = Number(Math.min(100, Math.max(0, finalScore)).toFixed(1));

  // 5. Update participant final_score and graded_status
  await queryPostgres(
    `UPDATE exam_participants 
     SET final_score = $1, graded_status = 'GRADED' 
     WHERE id = $2;`,
    [finalScore, participantId]
  );

  return finalScore;
}
