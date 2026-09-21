import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { listRegionalExams, createRegionalExam } from '@/lib/services/regional-exam.service';
import { getClientIp } from '@/lib/core/rate-limit';

export async function GET(req: Request) {
  const auth = await requireApiPermission('regional_exam.read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const subjectId = searchParams.get('subjectId') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await listRegionalExams({ search, status, subjectId, page, limit });

    return NextResponse.json({
      success: true,
      data: result.exams,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat daftar ujian serentak wilayah.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireApiPermission('regional_exam.create');
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const exam = await createRegionalExam(body, {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Ujian serentak wilayah berhasil dibuat dalam status DRAFT.',
      data: exam,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal membuat ujian wilayah.' },
      { status: 400 }
    );
  }
}
