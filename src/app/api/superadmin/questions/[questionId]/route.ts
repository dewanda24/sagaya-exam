import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { getGlobalQuestionDetail, updateOrReviseGlobalQuestion } from '@/lib/services/question.service';
import { getClientIp } from '@/lib/core/rate-limit';

export async function GET(
  req: Request,
  context: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireApiPermission('question.global.read');
  if (!auth.authorized) return auth.response;

  try {
    const { questionId } = await context.params;
    const data = await getGlobalQuestionDetail(questionId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat detail soal.' },
      { status: 404 }
    );
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireApiPermission('question.global.review');
  if (!auth.authorized) return auth.response;

  try {
    const { questionId } = await context.params;
    const body = await req.json();
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const result = await updateOrReviseGlobalQuestion(questionId, body, {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui soal.' },
      { status: 400 }
    );
  }
}
