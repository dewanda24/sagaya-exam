import { QuestionTypeHandler, ValidationResult, EvaluationResult } from './types';

export interface RubricCriterion {
  id?: string;
  name: string;
  description?: string;
  maxPoints: number;
}

export class EssayHandler implements QuestionTypeHandler {
  type = 'ESSAY' as const;
  label = 'Uraian / Essay';

  validate(data: {
    questionText: string;
    rubric?: any; // String instruction or RubricCriterion[]
    weight?: number;
  }): ValidationResult {
    const errors: string[] = [];

    if (!data.questionText || !data.questionText.trim()) {
      errors.push('Teks pertanyaan essay tidak boleh kosong.');
    }

    if (data.weight === undefined || data.weight <= 0) {
      errors.push('Bobot nilai maksimal essay harus lebih besar dari 0.');
    }

    if (Array.isArray(data.rubric)) {
      let totalRubricPoints = 0;
      for (let i = 0; i < data.rubric.length; i++) {
        const c = data.rubric[i];
        if (!c.name || !c.name.trim()) {
          errors.push(`Kriteria rubrik ke-${i + 1} wajib memiliki nama kriteria.`);
        }
        if (c.maxPoints === undefined || c.maxPoints <= 0) {
          errors.push(`Poin kriteria '${c.name || i + 1}' harus lebih besar dari 0.`);
        } else {
          totalRubricPoints += Number(c.maxPoints);
        }
      }

      if (data.weight && Math.abs(totalRubricPoints - data.weight) > 0.01) {
        errors.push(
          `Total poin rubrik (${totalRubricPoints}) harus sama dengan bobot total soal (${data.weight}).`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  sanitizeForStudent(question: any): any {
    const { answerKey, answer_key_json, explanation, teacher_internal_note, ...studentSafe } = question;
    return {
      ...studentSafe,
      // Siswa hanya boleh melihat deskripsi umum kriteria penilaian rubrik tanpa bocoran pedoman jawaban internal
      rubric: Array.isArray(question.rubric)
        ? question.rubric.map((r: any) => ({
            name: r.name,
            description: r.description,
            maxPoints: r.maxPoints,
          }))
        : typeof question.rubric === 'string'
        ? question.rubric
        : undefined,
    };
  }

  evaluate(
    _userAnswer: any,
    _answerKey: any,
    _options?: any[],
    weight = 1.0
  ): EvaluationResult {
    // Soal essay dinilai secara manual oleh Guru (Teacher Manual Scoring)
    return {
      isCorrect: false,
      score: 0,
      maxScore: weight,
      details: { requiresManualGrading: true },
      feedback: 'Menunggu penilaian guru.',
    };
  }

  /**
   * Validasi nilai koreksi manual oleh Guru.
   * Skor harus berada di dalam batas: 0 <= score <= maxScore.
   */
  validateManualScore(
    score: number,
    maxScore: number,
    rubricScores?: Record<string, number>
  ): { valid: boolean; error?: string } {
    if (typeof score !== 'number' || isNaN(score)) {
      return { valid: false, error: 'Nilai harus berupa angka valid.' };
    }

    if (score < 0) {
      return { valid: false, error: 'Nilai essay tidak boleh negatif.' };
    }

    if (score > maxScore) {
      return {
        valid: false,
        error: `Nilai essay (${score}) tidak boleh melebihi nilai maksimal (${maxScore}).`,
      };
    }

    if (rubricScores && typeof rubricScores === 'object') {
      for (const [key, val] of Object.entries(rubricScores)) {
        if (typeof val !== 'number' || val < 0) {
          return { valid: false, error: `Nilai kriteria rubrik '${key}' tidak boleh negatif.` };
        }
      }
    }

    return { valid: true };
  }

  normalizeAnswer(rawAnswer: any): string {
    return (rawAnswer ?? '').toString().trim();
  }
}
