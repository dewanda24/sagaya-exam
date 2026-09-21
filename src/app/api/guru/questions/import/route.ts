import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherQuestionService } from '@/lib/services/teacher-question.service';
import { QuestionType } from '@/lib/core/types';

export async function POST(req: Request) {
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

    const body = await req.json();
    const rows = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Daftar data soal import tidak boleh kosong.' },
        { status: 400 }
      );
    }

    if (rows.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Maksimal 200 butir soal yang dapat di-import dalam satu batch.' },
        { status: 400 }
      );
    }

    const createdList: any[] = [];
    const errorsList: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        if (!r.subjectId || !r.questionText) {
          throw new Error('Mata pelajaran dan teks soal wajib diisi.');
        }

        const validTypes: QuestionType[] = [
          'PILIHAN_GANDA',
          'PG_KOMPLEKS',
          'BENAR_SALAH',
          'MENJODOHKAN',
          'ISIAN_SINGKAT',
          'ESSAY',
        ];
        const qType: QuestionType = validTypes.includes(r.type) ? r.type : 'PILIHAN_GANDA';

        const created = await TeacherQuestionService.createQuestion(
          schoolId,
          auth.user.id,
          {
            subjectId: r.subjectId,
            topic: (r.topic || 'Soal Import').slice(0, 100),
            difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(r.difficulty) ? r.difficulty : 'MEDIUM',
            type: qType,
            questionText: r.questionText,
            options: r.options || [],
            answerKey: r.answerKey,
            explanation: r.explanation,
            rubric: r.rubric,
            weight: r.weight !== undefined ? Number(r.weight) : 1.0,
          },
          auth.user
        );
        createdList.push(created);
      } catch (err: any) {
        errorsList.push({ row: i + 1, error: err.message });
      }
    }

    return NextResponse.json({
      success: errorsList.length === 0,
      totalProcessed: rows.length,
      importedCount: createdList.length,
      errors: errorsList,
      message: `${createdList.length} soal berhasil di-import.${errorsList.length > 0 ? ` ${errorsList.length} baris gagal.` : ''}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal mengimpor data soal.' },
      { status: 500 }
    );
  }
}
