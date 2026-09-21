import { QuestionTypeHandler, ValidationResult, EvaluationResult } from './types';

export class TrueFalseHandler implements QuestionTypeHandler {
  type = 'BENAR_SALAH' as const;
  label = 'Benar / Salah';

  validate(data: {
    questionText: string;
    answerKey: any;
    weight?: number;
  }): ValidationResult {
    const errors: string[] = [];

    if (!data.questionText || !data.questionText.trim()) {
      errors.push('Teks pernyataan tidak boleh kosong.');
    }

    if (data.answerKey === undefined || data.answerKey === null) {
      errors.push('Kunci jawaban Benar/Salah wajib ditentukan.');
    } else {
      const valStr = data.answerKey.toString().trim().toUpperCase();
      const validKeys = ['TRUE', 'FALSE', 'BENAR', 'SALAH', 'T', 'F', 'B', 'S', '1', '0'];
      if (!validKeys.includes(valStr)) {
        errors.push("Kunci jawaban harus berupa 'TRUE' (BENAR) atau 'FALSE' (SALAH).");
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
      options: [
        { id: 'TRUE', text: 'Benar' },
        { id: 'FALSE', text: 'Salah' },
      ],
    };
  }

  evaluate(
    userAnswer: any,
    answerKey: any,
    _options?: any[],
    weight = 1.0
  ): EvaluationResult {
    const normUser = this.normalizeBoolean(userAnswer);
    const normKey = this.normalizeBoolean(answerKey);

    const isCorrect = normUser !== null && normUser === normKey;

    return {
      isCorrect,
      score: isCorrect ? weight : 0,
      maxScore: weight,
      details: { userAnswer: normUser },
    };
  }

  private normalizeBoolean(val: any): boolean | null {
    if (val === true || val === false) return val;
    if (val === undefined || val === null) return null;
    const str = val.toString().trim().toUpperCase();
    if (['TRUE', 'BENAR', 'T', 'B', '1'].includes(str)) return true;
    if (['FALSE', 'SALAH', 'F', 'S', '0'].includes(str)) return false;
    return null;
  }

  normalizeAnswer(rawAnswer: any): boolean | null {
    return this.normalizeBoolean(rawAnswer);
  }
}
