import { QuestionTypeHandler, ValidationResult, EvaluationResult, ScoringMethod } from './types';

export class ComplexMultipleChoiceHandler implements QuestionTypeHandler {
  type = 'PG_KOMPLEKS' as const;
  label = 'Pilihan Ganda Kompleks (Multi-Jawaban)';

  validate(data: {
    questionText: string;
    options?: any[];
    answerKey: any;
    weight?: number;
    scoringConfig?: { method?: ScoringMethod };
  }): ValidationResult {
    const errors: string[] = [];

    if (!data.questionText || !data.questionText.trim()) {
      errors.push('Teks pertanyaan tidak boleh kosong.');
    }

    if (!Array.isArray(data.options) || data.options.length < 2) {
      errors.push('Pilihan ganda kompleks harus memiliki minimal 2 opsi.');
    }

    if (!Array.isArray(data.answerKey) || data.answerKey.length === 0) {
      errors.push('Kunci jawaban pilihan ganda kompleks harus berupa array berisi minimal 1 jawaban benar.');
    } else if (Array.isArray(data.options)) {
      const validIds = data.options.map((o) => (o.id || o.key || '').toString().toUpperCase());
      for (const k of data.answerKey) {
        if (!validIds.includes(k.toString().toUpperCase())) {
          errors.push(`Kunci jawaban '${k}' tidak ditemukan pada opsi yang tersedia.`);
        }
      }
    }

    if (data.weight !== undefined && data.weight < 0) {
      errors.push('Bobot nilai tidak boleh bernilai negatif.');
    }

    return { valid: errors.length === 0, errors };
  }

  sanitizeForStudent(question: any): any {
    const { answerKey, answer_key_json, explanation, rubric, ...studentSafe } = question;
    return {
      ...studentSafe,
      options: (question.options || question.options_json || []).map((o: any) => ({
        id: o.id || o.key,
        text: o.text,
        imageUrl: o.imageUrl,
      })),
    };
  }

  evaluate(
    userAnswer: any,
    answerKey: any,
    _options?: any[],
    weight = 1.0,
    scoringConfig?: { method?: ScoringMethod }
  ): EvaluationResult {
    const userAnswers: string[] = Array.isArray(userAnswer)
      ? userAnswer.map((a) => a.toString().trim().toUpperCase())
      : userAnswer
      ? [userAnswer.toString().trim().toUpperCase()]
      : [];

    const correctAnswers: string[] = Array.isArray(answerKey)
      ? answerKey.map((k) => k.toString().trim().toUpperCase())
      : [];

    const method = scoringConfig?.method || 'ALL_OR_NOTHING';

    if (method === 'ALL_OR_NOTHING') {
      const isCorrect =
        userAnswers.length === correctAnswers.length &&
        userAnswers.every((ans) => correctAnswers.includes(ans));

      return {
        isCorrect,
        score: isCorrect ? weight : 0,
        maxScore: weight,
        details: { method, userAnswers, correctAnswers },
      };
    }

    // PARTIAL_CREDIT:
    // Nilai = (Benar yang dipilih / Total Jawaban Benar) - (Salah yang dipilih / Total Pilihan Salah)
    let correctChosen = 0;
    let wrongChosen = 0;

    userAnswers.forEach((ans) => {
      if (correctAnswers.includes(ans)) {
        correctChosen++;
      } else {
        wrongChosen++;
      }
    });

    const totalCorrect = correctAnswers.length || 1;
    let ratio = correctChosen / totalCorrect - (wrongChosen > 0 ? wrongChosen * 0.25 : 0);
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;

    const score = Math.round(ratio * weight * 100) / 100;
    const isCorrect = score === weight;

    return {
      isCorrect,
      score,
      maxScore: weight,
      details: {
        method: 'PARTIAL_CREDIT',
        correctChosen,
        wrongChosen,
        ratio,
      },
    };
  }

  normalizeAnswer(rawAnswer: any): string[] {
    if (Array.isArray(rawAnswer)) {
      return rawAnswer.map((x) => (x ?? '').toString().trim().toUpperCase()).sort();
    }
    if (rawAnswer) {
      return [rawAnswer.toString().trim().toUpperCase()];
    }
    return [];
  }
}
