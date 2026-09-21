import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { AnalyticsService } from '@/lib/services/analytics.service';
import { logAuditEvent } from '@/lib/services/audit.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const { examId } = await params;
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId') || undefined;
    const resultStatus = searchParams.get('resultStatus') || undefined;

    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);
    const analytics = await AnalyticsService.getExamAnalytics(context, examId, {
      classId,
      resultStatus,
    });

    // Audit log read
    await logAuditEvent({
      schoolId: auth.tenant.schoolId,
      userId: auth.user.id,
      action: 'REPORT_VIEWED',
      role: auth.user.role,
      resourceType: 'EXAM_ANALYTICS',
      resourceId: examId,
      details: { classId },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : error.message.includes('tidak ditemukan') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat analitik ujian.' },
      { status }
    );
  }
}
