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
    const search = url.searchParams.get('search') || undefined;
    const authorScope = (url.searchParams.get('authorScope') as any) || 'MINE';
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 20;
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : 0;

    const data = await TeacherQuestionService.listQuestions(
      schoolId,
      auth.user.id,
      { subjectId, type, difficulty, status, search, authorScope, limit, offset },
      auth.user.role
    );

    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat daftar soal.' },
      { status: 500 }
    );
  }
}

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

    // Client parameter manipulation defense: Author selalu mengacu pada session user
    const created = await TeacherQuestionService.createQuestion(
      schoolId,
      auth.user.id,
      {
        subjectId: body.subjectId,
        topic: body.topic,
        difficulty: body.difficulty,
        type: body.type,
        questionText: body.questionText,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
        options: body.options,
        answerKey: body.answerKey,
        explanation: body.explanation,
        rubric: body.rubric,
        weight: body.weight !== undefined ? Number(body.weight) : 1.0,
        tags: body.tags,
        stimulusTitle: body.stimulusTitle,
        stimulusText: body.stimulusText,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      message: 'Soal berhasil disimpan sebagai DRAFT.',
      data: created,
    });
  } catch (err: any) {
    const status = err.message?.includes('Akses ditolak') ? 403 : 400;
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal membuat soal.' },
      { status }
    );
  }
}
