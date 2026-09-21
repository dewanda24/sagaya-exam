import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { AnalyticsService } from '@/lib/services/analytics.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    // Siswa juga diizinkan mengakses analitik dirinya sendiri
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const { studentId } = await params;
    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);

    const studentAnalytics = await AnalyticsService.getStudentAnalytics(context, studentId);

    return NextResponse.json({
      success: true,
      data: studentAnalytics,
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : error.message.includes('tidak ditemukan') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat analitik siswa.' },
      { status }
    );
  }
}
