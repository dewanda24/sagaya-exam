import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { AnalyticsService } from '@/lib/services/analytics.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId') || undefined;
    const roomId = searchParams.get('roomId') || undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);
    const attendance = await AnalyticsService.getAttendanceAnalytics(context, {
      examId,
      roomId,
      dateFrom,
      dateTo,
    });

    return NextResponse.json({
      success: true,
      data: attendance,
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat analitik presensi.' },
      { status }
    );
  }
}
