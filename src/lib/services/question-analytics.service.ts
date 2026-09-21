import { queryPostgres } from '../core/postgres';
import { AnalyticsContext, AnalyticsAuthService } from '../core/analytics-auth';

export interface QuestionItemAnalytics {
  questionId: string;
  snapshotQuestionId: string;
  position: number;
  questionType: string;
  questionText: string;
  maxScore: number;
  totalAttempts: number;
  answeredCount: number;
  blankCount: number;
  correctCount: number;
  incorrectCount: number;
  partiallyCorrectCount: number;
  accuracyPercentage: number;
  averageScore: number;
  difficultyIndex: number; // p-value: correct / valid attempts
  difficultyClassification: 'SANGAT_MUDAH' | 'MUDAH' | 'SEDANG' | 'SUKAR' | 'SANGAT_SUKAR';
  discriminationIndex: number | null; // d-value: p_upper27% - p_lower27%
  discriminationClassification?: string;
  optionsDistribution?: Array<{
    optionId: string;
    optionLabel: string;
    count: number;
    percentage: number;
    isKey: boolean;
  }>;
  distractorEfficiency?: Array<{
    optionId: string;
    optionLabel: string;
    isEffectiveDistractor: boolean; // dipilih >= 5% peserta jika bukan kunci
    selectionRate: number;
  }>;
  essayStats?: {
    gradedCount: number;
    pendingCount: number;
    averageScore: number;
    scoreDistribution: Record<string, number>;
  };
  matchingStats?: {
    totalPairs: number;
    averageMatchedPairs: number;
  };
}

export class QuestionAnalyticsService {
  /**
   * Mengklasifikasikan indeks kesukaran butir soal (Difficulty Index p-value)
   * Formula: p = correct_responses / valid_attempts
   * Referensi Pedagogis Evaluasi Pendidikan:
   *  p >= 0.85 : Sangat Mudah
   *  0.70 <= p < 0.85 : Mudah
   *  0.30 <= p < 0.70 : Sedang
   *  0.15 <= p < 0.30 : Sukar
   *  p < 0.15 : Sangat Sukar
   */
  static classifyDifficulty(p: number): 'SANGAT_MUDAH' | 'MUDAH' | 'SEDANG' | 'SUKAR' | 'SANGAT_SUKAR' {
    if (p >= 0.85) return 'SANGAT_MUDAH';
    if (p >= 0.70) return 'MUDAH';
    if (p >= 0.30) return 'SEDANG';
    if (p >= 0.15) return 'SUKAR';
    return 'SANGAT_SUKAR';
  }

  /**
   * Mengklasifikasikan daya pembeda soal (Discrimination Index d-value)
   * Formula: d = p_upper27% - p_lower27%
   */
  static classifyDiscrimination(d: number): string {
    if (d >= 0.40) return 'Sangat Baik (Excellent)';
    if (d >= 0.30) return 'Baik (Good)';
    if (d >= 0.20) return 'Cukup (Satisfactory - Needs Revision)';
    if (d >= 0.0) return 'Jelek (Poor - Discard or Major Revise)';
    return 'Sangat Buruk / Negatif (Misleading Item)';
  }

  /**
   * Mengambil analisis butir soal komprehensif berbasis ExamSnapshot (Immutability Guaranteed)
   */
  static async getExamQuestionAnalytics(
    context: AnalyticsContext,
    examId: string
  ): Promise<{
    examId: string;
    snapshotId: string;
    totalQuestions: number;
    totalParticipantsEvaluated: number;
    questions: QuestionItemAnalytics[];
  }> {
    // 1. Otorisasi Akses Ujian
    const { schoolId } = await AnalyticsAuthService.assertExamAccess(context, examId);

    // 2. Ambil snapshot aktif yang digunakan ujian
    const examRes = await queryPostgres(
      `SELECT e.id, e.title, e.active_snapshot_id 
       FROM exams e 
       WHERE e.id = $1 AND e.school_id = $2 LIMIT 1;`,
      [examId, schoolId]
    );

    if (examRes.rows.length === 0) {
      throw new Error('Ujian tidak ditemukan.');
    }

    let snapshotId = examRes.rows[0].active_snapshot_id;
    if (!snapshotId) {
      // Fallback: cari snapshot terbaru dari ujian ini
      const snapRes = await queryPostgres(
        `SELECT id FROM exam_snapshots WHERE exam_id = $1 ORDER BY version DESC LIMIT 1;`,
        [examId]
      );
      if (snapRes.rows.length > 0) {
        snapshotId = snapRes.rows[0].id;
      }
    }

    if (!snapshotId) {
      throw new Error('Ujian ini belum memiliki snapshot konfigurasi butir soal.');
    }

    // 3. Ambil seluruh butir soal yang TERKUNCI DALAM SNAPSHOT (exam_snapshot_questions)
    const snapshotQuestionsRes = await queryPostgres(
      `SELECT esq.id as snapshot_question_id, esq.question_id, esq.position, esq.points,
              esq.configuration_json
       FROM exam_snapshot_questions esq
       WHERE esq.snapshot_id = $1
       ORDER BY esq.position ASC;`,
      [snapshotId]
    );

    const snapshotQuestions = snapshotQuestionsRes.rows;

    // 4. Ambil seluruh hasil penilaian dan jawaban siswa pada ujian ini
    // Membaca dari exam_results dan exam_question_results + student_answers
    const resultsRes = await queryPostgres(
      `SELECT er.id as result_id, er.final_score, er.status as result_status,
              eqr.question_id, eqr.score, eqr.max_score, eqr.score_status,
              sa.answer_value_json, sa.state as answer_state
       FROM exam_results er
       JOIN exam_question_results eqr ON er.id = eqr.result_id
       LEFT JOIN student_answers sa ON sa.session_id = er.session_id AND sa.question_id = eqr.question_id
       WHERE er.exam_id = $1 AND er.school_id = $2 AND er.status NOT IN ('VOID')
       ORDER BY er.final_score DESC;`,
      [examId, schoolId]
    );

    const allRows = resultsRes.rows;

    // Identifikasi total peserta unik yang dievaluasi
    const uniqueResultIds = Array.from(new Set(allRows.map((r) => r.result_id)));
    const totalParticipantsEvaluated = uniqueResultIds.length;

    // Persiapkan kelompok Upper 27% dan Lower 27% untuk kalkulasi Discrimination Index
    let upperGroupResultIds = new Set<string>();
    let lowerGroupResultIds = new Set<string>();

    if (totalParticipantsEvaluated >= 10) {
      const groupSize = Math.max(1, Math.round(totalParticipantsEvaluated * 0.27));
      const sortedResultIds = uniqueResultIds; // already sorted by er.final_score DESC
      upperGroupResultIds = new Set(sortedResultIds.slice(0, groupSize));
      lowerGroupResultIds = new Set(sortedResultIds.slice(sortedResultIds.length - groupSize));
    }

    // 5. Agregasi statistik per butir soal
    const analyzedQuestions: QuestionItemAnalytics[] = [];

    for (const sq of snapshotQuestions) {
      const qConf = sq.configuration_json || {};
      const qType = qConf.type || 'PILIHAN_GANDA';
      const qText = qConf.questionText || '';
      const maxScore = parseFloat(sq.points || qConf.points || '1.0');
      const questionId = sq.question_id;

      // Filter seluruh response siswa untuk butir soal ini
      const qResponses = allRows.filter((r) => r.question_id === questionId);
      const totalAttempts = qResponses.length;

      let answeredCount = 0;
      let blankCount = 0;
      let correctCount = 0;
      let incorrectCount = 0;
      let partiallyCorrectCount = 0;
      let totalScoreAcquired = 0;

      // Discrimination tracking
      let upperCorrect = 0;
      let lowerCorrect = 0;
      let upperAttempts = 0;
      let lowerAttempts = 0;

      // Option frequency tracking (untuk MC & PG Kompleks)
      const optionCounts: Record<string, number> = {};
      if (Array.isArray(qConf.options)) {
        for (const opt of qConf.options) {
          optionCounts[opt.id] = 0;
        }
      }

      // Essay tracking
      let essayGradedCount = 0;
      let essayPendingCount = 0;
      let essayScoreSum = 0;
      const essayScoreBuckets: Record<string, number> = {
        '0': 0,
        '1-25%': 0,
        '26-50%': 0,
        '51-75%': 0,
        '76-100%': 0,
      };

      for (const resp of qResponses) {
        const score = parseFloat(resp.score || '0');
        totalScoreAcquired += score;

        const isBlank =
          resp.answer_state === 'UNANSWERED' ||
          resp.answer_value_json === null ||
          resp.answer_value_json === undefined ||
          (Array.isArray(resp.answer_value_json) && resp.answer_value_json.length === 0) ||
          resp.answer_value_json === '';

        if (isBlank) {
          blankCount++;
        } else {
          answeredCount++;
        }

        const isFullCorrect = score >= maxScore && maxScore > 0;
        const isPartial = score > 0 && score < maxScore;

        if (isFullCorrect) {
          correctCount++;
        } else if (isPartial) {
          partiallyCorrectCount++;
        } else {
          incorrectCount++;
        }

        // Upper & Lower group accounting
        if (upperGroupResultIds.has(resp.result_id)) {
          upperAttempts++;
          if (isFullCorrect) upperCorrect++;
        }
        if (lowerGroupResultIds.has(resp.result_id)) {
          lowerAttempts++;
          if (isFullCorrect) lowerCorrect++;
        }

        // Option frequency
        if (qType === 'PILIHAN_GANDA' && typeof resp.answer_value_json === 'string') {
          const optKey = resp.answer_value_json;
          if (optionCounts[optKey] !== undefined) {
            optionCounts[optKey]++;
          }
        } else if (qType === 'PG_KOMPLEKS' && Array.isArray(resp.answer_value_json)) {
          for (const optKey of resp.answer_value_json) {
            if (optionCounts[optKey] !== undefined) {
              optionCounts[optKey]++;
            }
          }
        }

        // Essay specific
        if (qType === 'ESSAY') {
          if (resp.score_status === 'PENDING_MANUAL_REVIEW') {
            essayPendingCount++;
          } else {
            essayGradedCount++;
            essayScoreSum += score;
            const ratio = maxScore > 0 ? (score / maxScore) * 100 : 0;
            if (ratio === 0) essayScoreBuckets['0']++;
            else if (ratio <= 25) essayScoreBuckets['1-25%']++;
            else if (ratio <= 50) essayScoreBuckets['26-50%']++;
            else if (ratio <= 75) essayScoreBuckets['51-75%']++;
            else essayScoreBuckets['76-100%']++;
          }
        }
      }

      // Valid attempts (peserta yang terdaftar dan menyerahkan sesi)
      const validAttempts = totalAttempts > 0 ? totalAttempts : 1;
      const difficultyIndex = Math.round((correctCount / validAttempts) * 100) / 100;
      const difficultyClassification = this.classifyDifficulty(difficultyIndex);
      const accuracyPercentage = Math.round((correctCount / validAttempts) * 10000) / 100;
      const averageScore = Math.round((totalScoreAcquired / validAttempts) * 100) / 100;

      // Discrimination Index
      let discriminationIndex: number | null = null;
      let discriminationClassification: string | undefined = undefined;

      if (upperAttempts > 0 && lowerAttempts > 0) {
        const pUpper = upperCorrect / upperAttempts;
        const pLower = lowerCorrect / lowerAttempts;
        discriminationIndex = Math.round((pUpper - pLower) * 100) / 100;
        discriminationClassification = this.classifyDiscrimination(discriminationIndex);
      }

      // Format Option & Distractor Analysis
      let optionsDistribution: QuestionItemAnalytics['optionsDistribution'] = undefined;
      let distractorEfficiency: QuestionItemAnalytics['distractorEfficiency'] = undefined;

      if (Array.isArray(qConf.options) && qConf.options.length > 0) {
        const correctKey = qConf.answerKey || qConf.correctOptionId;
        optionsDistribution = qConf.options.map((opt: any) => {
          const count = optionCounts[opt.id] || 0;
          const pct = Math.round((count / validAttempts) * 10000) / 100;
          const isKey = Array.isArray(correctKey) ? correctKey.includes(opt.id) : correctKey === opt.id;
          return {
            optionId: opt.id,
            optionLabel: opt.text || opt.label || opt.id,
            count,
            percentage: pct,
            isKey,
          };
        });

        // Distractor Efficiency: pengecoh efektif jika dipilih >= 5% dari total peserta
        distractorEfficiency = (optionsDistribution || [])
          .filter((opt) => !opt.isKey)
          .map((opt) => ({
            optionId: opt.optionId,
            optionLabel: opt.optionLabel,
            isEffectiveDistractor: opt.percentage >= 5.0,
            selectionRate: opt.percentage,
          }));
      }

      // Essay specific stats
      let essayStats: QuestionItemAnalytics['essayStats'] = undefined;
      if (qType === 'ESSAY') {
        essayStats = {
          gradedCount: essayGradedCount,
          pendingCount: essayPendingCount,
          averageScore: essayGradedCount > 0 ? Math.round((essayScoreSum / essayGradedCount) * 100) / 100 : 0,
          scoreDistribution: essayScoreBuckets,
        };
      }

      analyzedQuestions.push({
        questionId,
        snapshotQuestionId: sq.snapshot_question_id,
        position: sq.position,
        questionType: qType,
        questionText: qText,
        maxScore,
        totalAttempts,
        answeredCount,
        blankCount,
        correctCount,
        incorrectCount,
        partiallyCorrectCount,
        accuracyPercentage,
        averageScore,
        difficultyIndex,
        difficultyClassification,
        discriminationIndex,
        discriminationClassification,
        optionsDistribution,
        distractorEfficiency,
        essayStats,
      });
    }

    return {
      examId,
      snapshotId,
      totalQuestions: analyzedQuestions.length,
      totalParticipantsEvaluated,
      questions: analyzedQuestions,
    };
  }
}
