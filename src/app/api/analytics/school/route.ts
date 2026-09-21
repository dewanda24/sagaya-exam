import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { AnalyticsService } from '@/lib/services/analytics.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN']);
    if (!auth.authorized) return auth.response;

    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);
    const schoolAnalytics = await AnalyticsService.getSchoolAnalytics(context);

    return NextResponse.json({
      success: true,
      data: schoolAnalytics,
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat analitik sekolah.' },
      { status }
    );
  }
}
