import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { ExportService } from '@/lib/services/export.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const { id } = await params;
    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);

    const file = await ExportService.downloadExportJob(context, id);

    return new Response(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : error.message.includes('kedaluwarsa') ? 410 : 404;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengunduh berkas ekspor.' },
      { status }
    );
  }
}
