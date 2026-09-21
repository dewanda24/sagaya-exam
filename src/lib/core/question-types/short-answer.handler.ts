import { QuestionTypeHandler, ValidationResult, EvaluationResult } from './types';

export interface ShortAnswerRules {
  caseSensitive?: boolean;
  trimWhitespace?: boolean;
  ignorePunctuation?: boolean;
}

export class ShortAnswerHandler implements QuestionTypeHandler {
  type = 'ISIAN_SINGKAT' as const;
  label = 'Isian Singkat';

  validate(data: {
    questionText: string;
    answerKey: any; // string or array of accepted strings
    weight?: number;
    scoringConfig?: { rules?: ShortAnswerRules };
  }): ValidationResult {
    const errors: string[] = [];

    if (!data.questionText || !data.questionText.trim()) {
      errors.push('Teks pertanyaan tidak boleh kosong.');
    }

    if (data.answerKey === undefined || data.answerKey === null) {
      errors.push('Kunci jawaban isian singkat wajib diisi.');
    } else {
      const keys = Array.isArray(data.answerKey) ? data.answerKey : [data.answerKey];
      const validKeys = keys.filter((k) => k !== undefined && k !== null && k.toString().trim() !== '');
      if (validKeys.length === 0) {
        errors.push('Kunci jawaban isian singkat harus memiliki minimal satu kata kunci jawaban.');
      }
    }

    if (data.weight !== undefined && data.weight < 0) {
      errors.push('Bobot nilai tidak boleh negatif.');
    }

    return { valid: errors.length === 0, errors };
  }

  sanitizeForStudent(question: any): any {
    const { answerKey, answer_key_json, explanation, rubric, ...studentSafe } = question;
    return studentSafe;
  }

  evaluate(
    userAnswer: any,
    answerKey: any,
    _options?: any[],
    weight = 1.0,
    scoringConfig?: { rules?: ShortAnswerRules }
  ): EvaluationResult {
    const rules: ShortAnswerRules = {
      caseSensitive: false,
      trimWhitespace: true,
      ignorePunctuation: true,
      ...(scoringConfig?.rules || {}),
    };

    const normUser = this.cleanText(userAnswer, rules);
    if (!normUser) {
      return { isCorrect: false, score: 0, maxScore: weight };
    }

    const keys = Array.isArray(answerKey) ? answerKey : [answerKey];
    const isCorrect = keys.some((k) => this.cleanText(k, rules) === normUser);

    return {
      isCorrect,
      score: isCorrect ? weight : 0,
      maxScore: weight,
      details: { normalizedUserAnswer: normUser },
    };
  }

  private cleanText(val: any, rules: ShortAnswerRules): string {
    if (val === undefined || val === null) return '';
    let str = val.toString();

    if (rules.trimWhitespace !== false) {
      str = str.trim().replace(/\s+/g, ' ');
    }

    if (rules.ignorePunctuation !== false) {
      // Hilangkan tanda baca .,;:!?'"-_()[]{} dsb
      str = str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"\[\]]/g, '');
    }

    if (!rules.caseSensitive) {
      str = str.toLowerCase();
    }

    return str.trim();
  }

  normalizeAnswer(rawAnswer: any, rules?: ShortAnswerRules): string {
    return this.cleanText(rawAnswer, rules || { caseSensitive: false, trimWhitespace: true, ignorePunctuation: true });
  }
}
