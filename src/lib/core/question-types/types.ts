export type QuestionType =
  | 'PILIHAN_GANDA'
  | 'PG_KOMPLEKS'
  | 'BENAR_SALAH'
  | 'MENJODOHKAN'
  | 'ISIAN_SINGKAT'
  | 'ESSAY';

export type ScoringMethod = 'ALL_OR_NOTHING' | 'PARTIAL_CREDIT';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface EvaluationResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  details?: Record<string, any>;
  feedback?: string;
}

export interface QuestionTypeHandler {
  type: QuestionType;
  label: string;
  validate(data: {
    questionText: string;
    options?: any[];
    answerKey: any;
    rubric?: any;
    weight?: number;
    explanation?: string;
    scoringConfig?: any;
  }): ValidationResult;

  sanitizeForStudent(question: {
    id: string;
    type: QuestionType;
    questionText: string;
    mediaUrl?: string;
    mediaType?: string;
    options?: any[];
    answerKey?: any;
    explanation?: string;
    rubric?: any;
    weight?: number;
    [key: string]: any;
  }): any;

  evaluate(
    userAnswer: any,
    answerKey: any,
    options?: any[],
    weight?: number,
    scoringConfig?: any
  ): EvaluationResult;

  normalizeAnswer(rawAnswer: any, rules?: any): any;
}
