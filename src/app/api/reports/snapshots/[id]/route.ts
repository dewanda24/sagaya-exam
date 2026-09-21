import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { ReportSnapshotService } from '@/lib/services/report-snapshot.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const { id } = await params;
    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);

    const snapshot = await ReportSnapshotService.getSnapshot(context, id);

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : error.message.includes('tidak ditemukan') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat snapshot laporan.' },
      { status }
    );
  }
}
