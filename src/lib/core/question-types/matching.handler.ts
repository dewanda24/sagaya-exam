import { QuestionTypeHandler, ValidationResult, EvaluationResult } from './types';

export class MatchingHandler implements QuestionTypeHandler {
  type = 'MENJODOHKAN' as const;
  label = 'Menjodohkan (Matching)';

  validate(data: {
    questionText: string;
    options?: any[]; // Format: array of pairs { id, premise, target } OR { left: [], right: [] }
    answerKey: any;  // Record<premiseId, targetId>
    weight?: number;
  }): ValidationResult {
    const errors: string[] = [];

    if (!data.questionText || !data.questionText.trim()) {
      errors.push('Instruksi soal menjodohkan tidak boleh kosong.');
    }

    if (!Array.isArray(data.options) || data.options.length < 2) {
      errors.push('Soal menjodohkan harus memiliki minimal 2 pasangan premis dan target.');
    } else {
      for (let i = 0; i < data.options.length; i++) {
        const item = data.options[i];
        if (!item.premise || !item.premise.trim()) {
          errors.push(`Premis kolom kiri pada baris ke-${i + 1} tidak boleh kosong.`);
        }
        if (!item.target || !item.target.trim()) {
          errors.push(`Target kolom kanan pada baris ke-${i + 1} tidak boleh kosong.`);
        }
      }
    }

    if (!data.answerKey || typeof data.answerKey !== 'object') {
      errors.push('Kunci pemetaan jawaban menjodohkan harus berupa objek asosiasi.');
    }

    if (data.weight !== undefined && data.weight < 0) {
      errors.push('Bobot nilai tidak boleh negatif.');
    }

    return { valid: errors.length === 0, errors };
  }

  sanitizeForStudent(question: any): any {
    const { answerKey, answer_key_json, explanation, rubric, ...studentSafe } = question;
    const rawPairs = question.options || question.options_json || [];

    // Pisahkan item kiri dan kanan secara teracak agar tidak langsung berjejer jawaban aslinya
    const leftItems = rawPairs.map((p: any, idx: number) => ({
      id: p.id || `L_${idx}`,
      text: p.premise,
    }));

    const rightItems = rawPairs.map((p: any, idx: number) => ({
      id: p.id || `R_${idx}`,
      text: p.target,
    }));

    return {
      ...studentSafe,
      pairs: {
        left: leftItems,
        right: rightItems,
      },
    };
  }

  evaluate(
    userAnswer: any,
    answerKey: any,
    _options?: any[],
    weight = 1.0
  ): EvaluationResult {
    if (!userAnswer || typeof userAnswer !== 'object' || !answerKey || typeof answerKey !== 'object') {
      return { isCorrect: false, score: 0, maxScore: weight };
    }

    const keyKeys = Object.keys(answerKey);
    if (keyKeys.length === 0) {
      return { isCorrect: false, score: 0, maxScore: weight };
    }

    let correctMatches = 0;
    for (const k of keyKeys) {
      const userTarget = (userAnswer[k] ?? '').toString().trim().toUpperCase();
      const expectedTarget = (answerKey[k] ?? '').toString().trim().toUpperCase();
      if (userTarget !== '' && userTarget === expectedTarget) {
        correctMatches++;
      }
    }

    const ratio = correctMatches / keyKeys.length;
    const score = Math.round(ratio * weight * 100) / 100;
    const isCorrect = correctMatches === keyKeys.length;

    return {
      isCorrect,
      score,
      maxScore: weight,
      details: { correctMatches, totalPairs: keyKeys.length },
    };
  }

  normalizeAnswer(rawAnswer: any): Record<string, string> {
    if (!rawAnswer || typeof rawAnswer !== 'object') return {};
    const res: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawAnswer)) {
      res[k.trim()] = (v ?? '').toString().trim();
    }
    return res;
  }
}
