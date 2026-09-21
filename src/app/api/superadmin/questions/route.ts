import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { listGlobalQuestions, createGlobalQuestion } from '@/lib/services/question.service';
import { getClientIp } from '@/lib/core/rate-limit';

export async function GET(req: Request) {
  const auth = await requireApiPermission('question.global.read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const subjectId = searchParams.get('subjectId') || undefined;
    const difficulty = searchParams.get('difficulty') || undefined;
    const type = searchParams.get('type') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await listGlobalQuestions({ search, status, subjectId, difficulty, type, page, limit });

    return NextResponse.json({
      success: true,
      data: result.questions,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat bank soal global.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireApiPermission('question.global.review');
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const question = await createGlobalQuestion(body, {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Soal global berhasil dibuat dalam status DRAFT.',
      data: question,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal membuat butir soal.' },
      { status: 400 }
    );
  }
}
