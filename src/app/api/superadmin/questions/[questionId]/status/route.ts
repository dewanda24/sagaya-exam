import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { transitionQuestionStatus, QuestionLifecycleStatus } from '@/lib/services/question.service';
import { getClientIp } from '@/lib/core/rate-limit';

export async function POST(
  req: Request,
  context: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await context.params;
  const body = await req.json();
  const { status, rejectionReason } = body;
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  if (!status) {
    return NextResponse.json({ success: false, error: 'Status target wajib disertakan.' }, { status: 400 });
  }

  const targetStatus = status.toUpperCase() as QuestionLifecycleStatus;

  // Determine required permission based on target status
  let requiredPerm = 'question.global.review';
  if (targetStatus === 'APPROVED') requiredPerm = 'question.global.approve';
  if (targetStatus === 'PUBLISHED') requiredPerm = 'question.global.publish';
  if (targetStatus === 'LOCKED') requiredPerm = 'question.global.lock';

  const auth = await requireApiPermission(requiredPerm as any);
  if (!auth.authorized) return auth.response;

  try {
    const updated = await transitionQuestionStatus(
      questionId,
      targetStatus,
      {
        id: auth.user.id,
        role: auth.user.role,
        fullName: auth.user.fullName,
        ip: clientIp,
        userAgent,
      },
      rejectionReason
    );

    return NextResponse.json({
      success: true,
      message: `Status soal berhasil diubah ke ${targetStatus}.`,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengubah status soal.' },
      { status: 400 }
    );
  }
}
