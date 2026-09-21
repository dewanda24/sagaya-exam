import { QuestionTypeHandler, ValidationResult, EvaluationResult } from './types';

export class MultipleChoiceHandler implements QuestionTypeHandler {
  type = 'PILIHAN_GANDA' as const;
  label = 'Pilihan Ganda Tunggal';

  validate(data: {
    questionText: string;
    options?: any[];
    answerKey: any;
    weight?: number;
  }): ValidationResult {
    const errors: string[] = [];

    if (!data.questionText || !data.questionText.trim()) {
      errors.push('Teks pertanyaan tidak boleh kosong.');
    }

    if (!Array.isArray(data.options) || data.options.length < 2) {
      errors.push('Pilihan ganda harus memiliki minimal 2 opsi jawaban.');
    } else {
      const emptyOptions = data.options.filter((opt) => !opt || !opt.text || !opt.text.trim());
      if (emptyOptions.length > 0) {
        errors.push('Seluruh opsi pilihan jawaban harus memiliki teks.');
      }
    }

    if (data.answerKey === undefined || data.answerKey === null || data.answerKey === '') {
      errors.push('Kunci jawaban wajib dipilih.');
    } else if (Array.isArray(data.options)) {
      const validIds = data.options.map((o) => (o.id || o.key || '').toString().toUpperCase());
      const keyStr = (data.answerKey || '').toString().toUpperCase();
      if (!validIds.includes(keyStr)) {
        errors.push(`Kunci jawaban '${keyStr}' tidak ditemukan di antara opsi jawaban yang tersedia.`);
      }
    }

    if (data.weight !== undefined && data.weight < 0) {
      errors.push('Bobot nilai tidak boleh negatif.');
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
    weight = 1.0
  ): EvaluationResult {
    const normUser = (userAnswer ?? '').toString().trim().toUpperCase();
    const normKey = (answerKey ?? '').toString().trim().toUpperCase();
    const isCorrect = normUser !== '' && normUser === normKey;

    return {
      isCorrect,
      score: isCorrect ? weight : 0,
      maxScore: weight,
      details: { userAnswer: normUser },
    };
  }

  normalizeAnswer(rawAnswer: any): string {
    return (rawAnswer ?? '').toString().trim().toUpperCase();
  }
}
