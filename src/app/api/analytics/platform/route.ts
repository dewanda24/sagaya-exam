import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { AnalyticsService } from '@/lib/services/analytics.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);
    const platformAnalytics = await AnalyticsService.getPlatformAnalytics(context);

    return NextResponse.json({
      success: true,
      data: platformAnalytics,
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat analitik platform.' },
      { status }
    );
  }
}
