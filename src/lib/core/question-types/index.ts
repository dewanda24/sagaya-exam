import { QuestionType, QuestionTypeHandler } from './types';
import { MultipleChoiceHandler } from './multiple-choice.handler';
import { ComplexMultipleChoiceHandler } from './complex-multiple-choice.handler';
import { TrueFalseHandler } from './true-false.handler';
import { MatchingHandler } from './matching.handler';
import { ShortAnswerHandler } from './short-answer.handler';
import { EssayHandler } from './essay.handler';

export * from './types';
export * from './multiple-choice.handler';
export * from './complex-multiple-choice.handler';
export * from './true-false.handler';
export * from './matching.handler';
export * from './short-answer.handler';
export * from './essay.handler';

export class QuestionTypeRegistry {
  private static handlers: Map<QuestionType, QuestionTypeHandler> = new Map<QuestionType, QuestionTypeHandler>([
    ['PILIHAN_GANDA', new MultipleChoiceHandler()],
    ['PG_KOMPLEKS', new ComplexMultipleChoiceHandler()],
    ['BENAR_SALAH', new TrueFalseHandler()],
    ['MENJODOHKAN', new MatchingHandler()],
    ['ISIAN_SINGKAT', new ShortAnswerHandler()],
    ['ESSAY', new EssayHandler()],
  ]);

  /**
   * Mendaftarkan atau meng-override handler tipe soal baru secara dinamis (extensible).
   */
  static register(handler: QuestionTypeHandler) {
    this.handlers.set(handler.type, handler);
  }

  /**
   * Mengambil handler berdasarkan tipe soal.
   */
  static getHandler(type: QuestionType | string): QuestionTypeHandler {
    const handler = this.handlers.get(type as QuestionType);
    if (!handler) {
      throw new Error(`Tipe soal '${type}' tidak dikenali atau belum terdaftar dalam registry.`);
    }
    return handler;
  }

  /**
   * Mengambil daftar seluruh tipe soal yang didukung beserta label deskriptifnya.
   */
  static getSupportedTypes(): { type: QuestionType; label: string }[] {
    return Array.from(this.handlers.values()).map((h) => ({
      type: h.type,
      label: h.label,
    }));
  }

  /**
   * Menghilangkan jawaban/kunci dan catatan internal guru secara aman sebelum data dikirim ke siswa atau student preview.
   */
  static sanitizeQuestionForStudent(question: any): any {
    if (!question) return question;
    const handler = this.getHandler(question.type || 'PILIHAN_GANDA');
    const sanitized = handler.sanitizeForStudent(question);
    
    // Universal Defense-in-depth: strip any sensitive teacher/internal/answer fields
    delete sanitized.answerKey;
    delete sanitized.answer_key;
    delete sanitized.answer_key_json;
    delete sanitized.explanation;
    delete sanitized.teacher_internal_note;
    delete sanitized.teacherInternalNote;
    delete sanitized.internal_note;
    delete sanitized.internalNote;
    delete sanitized.guidelines;
    delete sanitized.scoring_guide;
    return sanitized;
  }
}
