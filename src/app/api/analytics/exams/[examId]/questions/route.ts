import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { QuestionAnalyticsService } from '@/lib/services/question-analytics.service';
import { logAuditEvent } from '@/lib/services/audit.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const { examId } = await params;
    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);

    const questionAnalytics = await QuestionAnalyticsService.getExamQuestionAnalytics(context, examId);

    await logAuditEvent({
      schoolId: auth.tenant.schoolId,
      userId: auth.user.id,
      action: 'REPORT_VIEWED',
      role: auth.user.role,
      resourceType: 'ITEM_ANALYSIS',
      resourceId: examId,
      details: { totalQuestions: questionAnalytics.totalQuestions },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: questionAnalytics,
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : error.message.includes('tidak ditemukan') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat analisis butir soal.' },
      { status }
    );
  }
}
