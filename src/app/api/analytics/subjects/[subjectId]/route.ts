import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { AnalyticsService } from '@/lib/services/analytics.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const { subjectId } = await params;
    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);

    const subjectAnalytics = await AnalyticsService.getSubjectAnalytics(context, subjectId);

    return NextResponse.json({
      success: true,
      data: subjectAnalytics,
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : error.message.includes('tidak ditemukan') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat analitik mata pelajaran.' },
      { status }
    );
  }
}
