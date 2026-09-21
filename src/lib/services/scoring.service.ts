import { queryPostgres, withTransaction } from '../core/postgres';
import { AuditService } from './audit.service';
import { ExamSnapshotService } from './exam-snapshot.service';

export interface ScoringQuestionConfig {
  id: string;
  type: string;
  points?: number;
  weight?: number;
  section?: string;
  answerKey?: any;
  options?: any[];
  rubric?: any;
  scoringConfig?: {
    scoring_mode?: 'ALL_OR_NOTHING' | 'PARTIAL_CREDIT' | 'CUSTOM';
    negative_marking?: boolean;
    wrong_answer_penalty?: number;
    case_sensitive?: boolean;
    trim_whitespace?: boolean;
    normalize_spaces?: boolean;
    ignore_punctuation?: boolean;
    accepted_answers?: string[];
    [key: string]: any;
  };
}

export interface QuestionEvaluation {
  questionId: string;
  questionVersionId?: string;
  type: string;
  rawAnswer: any;
  normalizedAnswer: any;
  isCorrect: boolean;
  score: number;
  maxScore: number;
  scoreStatus: 'AUTOMATED' | 'PENDING_MANUAL_REVIEW' | 'MANUALLY_GRADED';
  details?: Record<string, any>;
  feedback?: string;
}

export interface ExamScoringResult {
  rawScore: number;
  maxScore: number;
  normalizedScore: number;
  finalScore: number;
  percentage: number;
  status: 'PENDING' | 'PARTIALLY_GRADED' | 'GRADED' | 'REVIEWED' | 'PUBLISHED' | 'VOID';
  questions: QuestionEvaluation[];
  summary: {
    totalQuestions: number;
    correctCount: number;
    wrongCount: number;
    blankCount: number;
    essayPendingCount: number;
  };
}

export class ScoringService {
  /**
   * Deterministic round score function (default 2 decimals)
   */
  static roundScore(val: number, decimals: number = 2): number {
    if (isNaN(val) || !isFinite(val)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round((val + Number.EPSILON) * factor) / factor;
  }

  /**
   * Evaluasi satu butir soal secara server-authoritative
   */
  static scoreQuestion(
    question: ScoringQuestionConfig,
    studentAnswer: any,
    options?: any[],
    scoringConfig?: any
  ): QuestionEvaluation {
    const maxScore = Number(question.points ?? question.weight ?? 1.0);
    const config = {
      ...(question.scoringConfig || {}),
      ...(scoringConfig || {}),
    };

    const isUnanswered =
      studentAnswer === undefined ||
      studentAnswer === null ||
      studentAnswer === '' ||
      (Array.isArray(studentAnswer) && studentAnswer.length === 0) ||
      (typeof studentAnswer === 'object' && Object.keys(studentAnswer).length === 0);

    const type = (question.type || 'PILIHAN_GANDA').toUpperCase();

    switch (type) {
      case 'PILIHAN_GANDA': {
        if (isUnanswered) {
          return {
            questionId: question.id,
            type,
            rawAnswer: studentAnswer,
            normalizedAnswer: null,
            isCorrect: false,
            score: 0,
            maxScore,
            scoreStatus: 'AUTOMATED',
            details: { reason: 'UNANSWERED' },
          };
        }

        const normUser = String(studentAnswer).trim().toUpperCase();
        const normKey = String(question.answerKey).trim().toUpperCase();
        const isCorrect = normUser === normKey;

        let score = 0;
        if (isCorrect) {
          score = maxScore;
        } else if (config.negative_marking) {
          const penalty = Number(config.wrong_answer_penalty ?? 0.25);
          score = -Math.abs(penalty);
        }

        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: normUser,
          isCorrect,
          score: this.roundScore(score),
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { normUser, isCorrect },
        };
      }

      case 'PG_KOMPLEKS': {
        if (isUnanswered) {
          return {
            questionId: question.id,
            type,
            rawAnswer: studentAnswer,
            normalizedAnswer: [],
            isCorrect: false,
            score: 0,
            maxScore,
            scoreStatus: 'AUTOMATED',
            details: { reason: 'UNANSWERED' },
          };
        }

        const userAnswers: string[] = Array.isArray(studentAnswer)
          ? studentAnswer.map((a) => String(a).trim().toUpperCase()).sort()
          : [String(studentAnswer).trim().toUpperCase()];

        const correctKeys: string[] = Array.isArray(question.answerKey)
          ? question.answerKey.map((k: any) => String(k).trim().toUpperCase()).sort()
          : [String(question.answerKey).trim().toUpperCase()];

        const scoringMode = config.scoring_mode || 'ALL_OR_NOTHING';

        const isExactMatch =
          userAnswers.length === correctKeys.length &&
          userAnswers.every((val, idx) => val === correctKeys[idx]);

        if (scoringMode === 'ALL_OR_NOTHING') {
          let score = 0;
          if (isExactMatch) {
            score = maxScore;
          } else if (config.negative_marking) {
            const penalty = Number(config.wrong_answer_penalty ?? 0.25);
            score = -Math.abs(penalty);
          }
          return {
            questionId: question.id,
            type,
            rawAnswer: studentAnswer,
            normalizedAnswer: userAnswers,
            isCorrect: isExactMatch,
            score: this.roundScore(score),
            maxScore,
            scoreStatus: 'AUTOMATED',
            details: { scoringMode, isExactMatch },
          };
        }

        // PARTIAL_CREDIT
        let correctChosen = 0;
        let wrongChosen = 0;
        for (const ans of userAnswers) {
          if (correctKeys.includes(ans)) {
            correctChosen++;
          } else {
            wrongChosen++;
          }
        }

        const totalCorrect = correctKeys.length || 1;
        const penaltyMultiplier = config.wrong_penalty_factor ?? 0.25;
        let ratio = correctChosen / totalCorrect - wrongChosen * penaltyMultiplier;
        if (ratio < 0) ratio = 0;
        if (ratio > 1) ratio = 1;

        const partialScore = Math.max(0, Math.min(maxScore, ratio * maxScore));

        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: userAnswers,
          isCorrect: isExactMatch,
          score: this.roundScore(partialScore),
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { scoringMode: 'PARTIAL_CREDIT', correctChosen, wrongChosen, ratio },
        };
      }

      case 'BENAR_SALAH': {
        if (isUnanswered) {
          return {
            questionId: question.id,
            type,
            rawAnswer: studentAnswer,
            normalizedAnswer: null,
            isCorrect: false,
            score: 0,
            maxScore,
            scoreStatus: 'AUTOMATED',
            details: { reason: 'UNANSWERED' },
          };
        }

        const normalizeBool = (v: any): boolean | null => {
          if (v === true || v === false) return v;
          if (v === undefined || v === null) return null;
          const s = String(v).trim().toUpperCase();
          if (['TRUE', 'BENAR', 'T', 'B', '1'].includes(s)) return true;
          if (['FALSE', 'SALAH', 'F', 'S', '0'].includes(s)) return false;
          return null;
        };

        const userBool = normalizeBool(studentAnswer);
        const keyBool = normalizeBool(question.answerKey);
        const isCorrect = userBool !== null && userBool === keyBool;

        let score = 0;
        if (isCorrect) {
          score = maxScore;
        } else if (config.negative_marking) {
          const penalty = Number(config.wrong_answer_penalty ?? 0.25);
          score = -Math.abs(penalty);
        }

        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: userBool,
          isCorrect,
          score: this.roundScore(score),
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { userBool, keyBool },
        };
      }

      case 'MENJODOHKAN': {
        if (isUnanswered) {
          return {
            questionId: question.id,
            type,
            rawAnswer: studentAnswer,
            normalizedAnswer: {},
            isCorrect: false,
            score: 0,
            maxScore,
            scoreStatus: 'AUTOMATED',
            details: { reason: 'UNANSWERED' },
          };
        }

        const userPairs: Record<string, string> =
          typeof studentAnswer === 'object' && studentAnswer !== null ? studentAnswer : {};
        const keyPairs: Record<string, string> =
          typeof question.answerKey === 'object' && question.answerKey !== null ? question.answerKey : {};

        const totalPairs = Object.keys(keyPairs).length;
        if (totalPairs === 0) {
          return {
            questionId: question.id,
            type,
            rawAnswer: studentAnswer,
            normalizedAnswer: userPairs,
            isCorrect: true,
            score: maxScore,
            maxScore,
            scoreStatus: 'AUTOMATED',
          };
        }

        let correctMatches = 0;
        for (const [k, expectedVal] of Object.entries(keyPairs)) {
          const userVal = (userPairs[k] ?? '').toString().trim().toUpperCase();
          const expVal = (expectedVal ?? '').toString().trim().toUpperCase();
          if (userVal !== '' && userVal === expVal) {
            correctMatches++;
          }
        }

        const isExactMatch = correctMatches === totalPairs;
        const scoringMode = config.scoring_mode || 'PARTIAL_CREDIT';

        let score = 0;
        if (scoringMode === 'ALL_OR_NOTHING') {
          score = isExactMatch ? maxScore : 0;
        } else {
          score = Math.max(0, Math.min(maxScore, (correctMatches / totalPairs) * maxScore));
        }

        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: userPairs,
          isCorrect: isExactMatch,
          score: this.roundScore(score),
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { correctMatches, totalPairs, scoringMode },
        };
      }

      case 'ISIAN_SINGKAT': {
        if (isUnanswered) {
          return {
            questionId: question.id,
            type,
            rawAnswer: studentAnswer,
            normalizedAnswer: '',
            isCorrect: false,
            score: 0,
            maxScore,
            scoreStatus: 'AUTOMATED',
            details: { reason: 'UNANSWERED' },
          };
        }

        const cleanString = (val: any) => {
          if (val === undefined || val === null) return '';
          let s = String(val);
          if (config.trim_whitespace !== false) {
            s = s.trim();
          }
          if (config.normalize_spaces !== false) {
            s = s.replace(/\s+/g, ' ');
          }
          if (config.ignore_punctuation !== false) {
            s = s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"\[\]]/g, '');
          }
          if (!config.case_sensitive) {
            s = s.toLowerCase();
          }
          return s.trim();
        };

        const normUser = cleanString(studentAnswer);

        // Kunci jawaban bisa single string, array, atau accepted_answers di scoringConfig
        let acceptedKeys: string[] = [];
        if (Array.isArray(config.accepted_answers) && config.accepted_answers.length > 0) {
          acceptedKeys = config.accepted_answers;
        } else if (Array.isArray(question.answerKey)) {
          acceptedKeys = question.answerKey;
        } else if (question.answerKey !== undefined && question.answerKey !== null) {
          acceptedKeys = [question.answerKey];
        }

        const isCorrect = acceptedKeys.some((k) => cleanString(k) === normUser && normUser !== '');

        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: normUser,
          isCorrect,
          score: isCorrect ? maxScore : 0,
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { normUser, acceptedKeysCount: acceptedKeys.length },
        };
      }

      case 'ESSAY': {
        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: studentAnswer ? String(studentAnswer).trim() : '',
          isCorrect: false,
          score: 0,
          maxScore,
          scoreStatus: 'PENDING_MANUAL_REVIEW',
          details: { requiresManualReview: true, rubric: question.rubric },
          feedback: 'Menunggu penilaian guru.',
        };
      }

      default: {
        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: studentAnswer,
          isCorrect: false,
          score: 0,
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { unknownType: type },
        };
      }
    }
  }

  /**
   * Menghitung total nilai mentah (Raw Score)
   */
  static calculateRawScore(questionScores: { score: number }[]): number {
    const sum = questionScores.reduce((acc, q) => acc + (q.score || 0), 0);
    return this.roundScore(sum);
  }

  /**
   * Normalisasi nilai ke skala target (default 100)
   */
  static calculateNormalizedScore(rawScore: number, maxScore: number, targetScale: number = 100): number {
    if (maxScore <= 0) return 0;
    const normalized = (rawScore / maxScore) * targetScale;
    return this.roundScore(normalized);
  }

  /**
   * Menghitung nilai akhir dengan bobot seksi dan pembatasan skor minimum
   */
  static calculateFinalScore(
    evaluatedQuestions: QuestionEvaluation[],
    examPolicy?: {
      sectionWeights?: Record<string, number>;
      allowNegativeFinalScore?: boolean;
      targetScale?: number;
    }
  ): {
    rawScore: number;
    maxScore: number;
    normalizedScore: number;
    finalScore: number;
    percentage: number;
  } {
    let rawScore = 0;
    let maxScore = 0;

    for (const q of evaluatedQuestions) {
      rawScore += q.score || 0;
      maxScore += q.maxScore || 0;
    }

    rawScore = this.roundScore(rawScore);
    maxScore = this.roundScore(maxScore);

    const targetScale = examPolicy?.targetScale || 100;
    let normalizedScore = maxScore > 0 ? (rawScore / maxScore) * targetScale : 0;
    normalizedScore = this.roundScore(normalizedScore);

    // Clamp jika exam policy melarang nilai akhir negatif (default dilarang)
    let finalScore = normalizedScore;
    if (!examPolicy?.allowNegativeFinalScore) {
      finalScore = Math.max(0, finalScore);
    }
    finalScore = this.roundScore(finalScore);

    const percentage = maxScore > 0 ? this.roundScore(Math.max(0, (rawScore / maxScore) * 100)) : 0;

    return {
      rawScore,
      maxScore,
      normalizedScore,
      finalScore,
      percentage,
    };
  }

  /**
   * Menjalankan scoring session secara atomik, server-authoritative, dan idempoten
   */
  static async scoreExamSession(
    sessionId: string,
    actor?: { id: string; role: string; username: string }
  ): Promise<ExamScoringResult & { resultId: string; isNewResult: boolean }> {
    return await withTransaction(async (client) => {
      // 1. Lock session dengan row locking
      const sessRes = await client.query(
        `SELECT es.*, e.id as exam_id, e.school_id, e.title as exam_title, e.active_snapshot_id,
                ep.id as participant_id, ep.student_id
         FROM exam_sessions es
         JOIN exam_participants ep ON es.participant_id = ep.id
         JOIN exams e ON ep.exam_id = e.id
         WHERE es.id = $1
         FOR UPDATE;`,
        [sessionId]
      );

      if (sessRes.rows.length === 0) {
        throw new Error(`Sesi ujian '${sessionId}' tidak ditemukan.`);
      }

      const session = sessRes.rows[0];

      // 2. Cek Idempotency: Jika exam_results sudah pernah dibuat untuk sesi ini
      const existingResultRes = await client.query(
        `SELECT * FROM exam_results WHERE session_id = $1 LIMIT 1;`,
        [sessionId]
      );

      // Ambil snapshot ujian
      let snapshotId = session.snapshot_id || session.active_snapshot_id;
      if (!snapshotId) {
        // Cari atau buat snapshot aktif
        const activeSnap = await ExamSnapshotService.getActiveSnapshotForExam(session.exam_id);
        snapshotId = activeSnap.id;
        await client.query(`UPDATE exam_sessions SET snapshot_id = $1 WHERE id = $2;`, [snapshotId, sessionId]);
      }

      // Ambil snapshot questions (frozen)
      const frozenQuestionsRes = await client.query(
        `SELECT id, question_id, question_version_id, position, section, points, configuration_json
         FROM exam_snapshot_questions
         WHERE snapshot_id = $1
         ORDER BY position ASC;`,
        [snapshotId]
      );

      const frozenQuestions = frozenQuestionsRes.rows;
      if (frozenQuestions.length === 0) {
        throw new Error('Snapshot ujian tidak memiliki butir soal.');
      }

      // Ambil student answers
      const answersRes = await client.query(
        `SELECT * FROM student_answers WHERE session_id = $1;`,
        [sessionId]
      );

      const answersMap = new Map<string, any>();
      for (const ans of answersRes.rows) {
        answersMap.set(ans.question_id, ans);
      }

      // 3. Evaluasi setiap butir soal
      const evaluations: QuestionEvaluation[] = [];
      let correctCount = 0;
      let wrongCount = 0;
      let blankCount = 0;
      let essayPendingCount = 0;

      for (const fq of frozenQuestions) {
        const qConfig = fq.configuration_json;
        const qId = fq.question_id;
        const studentAnsRow = answersMap.get(qId);
        const rawAns = studentAnsRow?.answer_value_json;

        const evalRes = this.scoreQuestion(
          {
            id: qId,
            type: qConfig.type,
            points: Number(fq.points || qConfig.weight || 1.0),
            weight: Number(fq.points || qConfig.weight || 1.0),
            section: fq.section,
            answerKey: qConfig.answerKey,
            options: qConfig.options,
            rubric: qConfig.rubric,
            scoringConfig: qConfig.scoringConfig,
          },
          rawAns
        );

        evalRes.questionVersionId = fq.question_version_id || qId;

        // Jika soal essay sudah pernah dinilai guru sebelumnya, gunakan manual score yang tersimpan
        if (evalRes.type === 'ESSAY' && studentAnsRow?.manual_score !== null && studentAnsRow?.manual_score !== undefined) {
          evalRes.score = Number(studentAnsRow.manual_score);
          evalRes.scoreStatus = 'MANUALLY_GRADED';
          evalRes.details = {
            rubricScores: studentAnsRow.rubric_scores_json,
            feedback: studentAnsRow.feedback,
          };
        }

        if (evalRes.scoreStatus === 'PENDING_MANUAL_REVIEW') {
          essayPendingCount++;
        } else if (evalRes.isCorrect) {
          correctCount++;
        } else if (rawAns === undefined || rawAns === null || rawAns === '') {
          blankCount++;
        } else {
          wrongCount++;
        }

        evaluations.push(evalRes);
      }

      // 4. Hitung agregasi nilai
      const scores = this.calculateFinalScore(evaluations);

      const resultStatus = essayPendingCount > 0 ? 'PARTIALLY_GRADED' : 'GRADED';

      const breakdown = {
        totalQuestions: frozenQuestions.length,
        correctCount,
        wrongCount,
        blankCount,
        essayPendingCount,
      };

      let resultId: string;
      let isNewResult = false;

      if (existingResultRes.rows.length > 0) {
        // Update existing result
        resultId = existingResultRes.rows[0].id;
        await client.query(
          `UPDATE exam_results SET
             raw_score = $1,
             max_score = $2,
             normalized_score = $3,
             final_score = $4,
             percentage = $5,
             status = CASE WHEN status IN ('REVIEWED', 'PUBLISHED', 'VOID') THEN status ELSE $6 END,
             breakdown_json = $7,
             graded_at = NOW(),
             updated_at = NOW()
           WHERE id = $8;`,
          [
            scores.rawScore,
            scores.maxScore,
            scores.normalizedScore,
            scores.finalScore,
            scores.percentage,
            resultStatus,
            JSON.stringify(breakdown),
            resultId,
          ]
        );
      } else {
        // Insert new exam_results
        const insRes = await client.query(
          `INSERT INTO exam_results (
             id, exam_id, session_id, participant_id, student_id, school_id,
             raw_score, max_score, normalized_score, final_score, percentage,
             status, scoring_version, breakdown_json, graded_at, created_at, updated_at
           ) VALUES (
             uuid_generate_v4(), $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, 'v1.0', $12, NOW(), NOW(), NOW()
           ) RETURNING id;`,
          [
            session.exam_id,
            sessionId,
            session.participant_id,
            session.student_id,
            session.school_id,
            scores.rawScore,
            scores.maxScore,
            scores.normalizedScore,
            scores.finalScore,
            scores.percentage,
            resultStatus,
            JSON.stringify(breakdown),
          ]
        );
        resultId = insRes.rows[0].id;
        isNewResult = true;
      }

      // 5. Simpan / Perbarui exam_question_results
      for (const ev of evaluations) {
        await client.query(
          `INSERT INTO exam_question_results (
             id, result_id, question_id, question_version_id, answer,
             score, max_score, score_status, feedback, created_at, updated_at
           ) VALUES (
             uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
           )
           ON CONFLICT (result_id, question_id) DO UPDATE SET
             score = EXCLUDED.score,
             max_score = EXCLUDED.max_score,
             score_status = CASE 
               WHEN exam_question_results.score_status = 'MANUALLY_GRADED' THEN 'MANUALLY_GRADED' 
               ELSE EXCLUDED.score_status 
             END,
             answer = EXCLUDED.answer,
             updated_at = NOW();`,
          [
            resultId,
            ev.questionId,
            ev.questionVersionId || ev.questionId,
            JSON.stringify(ev.rawAnswer ?? null),
            ev.score,
            ev.maxScore,
            ev.scoreStatus,
            ev.feedback || null,
          ]
        );

        // Sinkronisasi ke student_answers untuk backward compatibility
        await client.query(
          `UPDATE student_answers SET
             auto_score = $1,
             updated_at = NOW()
           WHERE session_id = $2 AND question_id = $3;`,
          [ev.score, sessionId, ev.questionId]
        );
      }

      // 6. Sinkronisasi status di exam_participants untuk backward compatibility
      await client.query(
        `UPDATE exam_participants SET
           final_score = $1,
           graded_status = $2
         WHERE id = $3;`,
        [scores.finalScore, resultStatus === 'PARTIALLY_GRADED' ? 'PARTIAL' : 'GRADED', session.participant_id]
      );

      // 7. Audit log
      await AuditService.createLog({
        action: isNewResult ? 'SCORING_COMPLETED' : 'RESULT_RECALCULATED',
        schoolId: session.school_id,
        actor: actor || { id: session.student_id, username: 'system_scoring', role: 'SYSTEM' },
        resourceType: 'EXAM_RESULT',
        resourceId: resultId,
        details: {
          examId: session.exam_id,
          sessionId,
          participantId: session.participant_id,
          rawScore: scores.rawScore,
          maxScore: scores.maxScore,
          finalScore: scores.finalScore,
          status: resultStatus,
          isNewResult,
        },
      });

      return {
        resultId,
        isNewResult,
        rawScore: scores.rawScore,
        maxScore: scores.maxScore,
        normalizedScore: scores.normalizedScore,
        finalScore: scores.finalScore,
        percentage: scores.percentage,
        status: resultStatus,
        questions: evaluations,
        summary: breakdown,
      };
    });
  }
}
