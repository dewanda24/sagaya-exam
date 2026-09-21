import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { AnalyticsService } from '@/lib/services/analytics.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const { classId } = await params;
    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);

    const classAnalytics = await AnalyticsService.getClassAnalytics(context, classId);

    return NextResponse.json({
      success: true,
      data: classAnalytics,
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : error.message.includes('tidak ditemukan') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat analitik kelas.' },
      { status }
    );
  }
}
