import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { ReportSnapshotService } from '@/lib/services/report-snapshot.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get('reportType') || undefined;
    const status = searchParams.get('status') || undefined;

    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);
    const snapshots = await ReportSnapshotService.listSnapshots(context, { reportType, status });

    return NextResponse.json({
      success: true,
      data: snapshots,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat snapshot laporan.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN']);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { reportType, scope, filters, dataPayload, dataVersion, scoringVersion, status } = body;

    if (!reportType || !dataPayload) {
      return NextResponse.json(
        { success: false, error: 'reportType dan dataPayload wajib diisi.' },
        { status: 400 }
      );
    }

    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);
    const snapshot = await ReportSnapshotService.createSnapshot(context, {
      reportType,
      scope,
      filters,
      dataPayload,
      dataVersion,
      scoringVersion,
      status,
    });

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal membuat snapshot laporan.' },
      { status: 500 }
    );
  }
}
