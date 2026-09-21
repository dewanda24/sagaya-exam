import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherQuestionService } from '@/lib/services/teacher-question.service';
import { QuestionType, DifficultyLevel } from '@/lib/core/types';

export async function GET(req: Request) {
  const auth = await requireApiAuth(['GURU', 'ADMIN', 'SUPER_ADMIN']);
  if (!auth.authorized) return auth.response;

  try {
    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const subjectId = url.searchParams.get('subjectId') || undefined;
    const type = (url.searchParams.get('type') as QuestionType) || undefined;
    const difficulty = (url.searchParams.get('difficulty') as DifficultyLevel) || undefined;
    const status = url.searchParams.get('status') || undefined;
    const mode = (url.searchParams.get('mode') as 'TEACHER' | 'STUDENT') || 'TEACHER';

    const { questions } = await TeacherQuestionService.listQuestions(
      schoolId,
      auth.user.id,
      { subjectId, type, difficulty, status, limit: 1000 },
      auth.user.role
    );

    // Format export data dengan formula injection protection
    const sanitizedRows = questions.map((q, idx) => {
      const row: Record<string, any> = {
        No: idx + 1,
        Topik: TeacherQuestionService.sanitizeForExport(q.topic),
        Tipe: TeacherQuestionService.sanitizeForExport(q.type),
        TingkatKesulitan: TeacherQuestionService.sanitizeForExport(q.difficulty),
        MataPelajaran: TeacherQuestionService.sanitizeForExport(q.subjectName),
        TeksSoal: TeacherQuestionService.sanitizeForExport(q.questionText),
        Bobot: q.weight,
      };

      if (mode === 'TEACHER') {
        // Teacher export menyertakan kunci dan pembahasan
        row['KunciJawaban'] = TeacherQuestionService.sanitizeForExport(
          typeof q.answerKey === 'object' ? JSON.stringify(q.answerKey) : q.answerKey
        );
        row['Pembahasan'] = TeacherQuestionService.sanitizeForExport(q.explanation || '');
      }

      return row;
    });

    return NextResponse.json({
      success: true,
      mode,
      count: sanitizedRows.length,
      data: sanitizedRows,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal mengekspor data soal.' },
      { status: 500 }
    );
  }
}
