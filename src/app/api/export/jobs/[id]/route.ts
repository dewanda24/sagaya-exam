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
    const job = await ExportService.getExportJob(context, id);

    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        reportType: job.report_type,
        format: job.format,
        status: job.status,
        fileName: job.file_name,
        fileSizeBytes: job.file_size_bytes,
        errorMessage: job.error_message,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        expiresAt: job.expires_at,
        downloadUrl: job.status === 'COMPLETED' ? `/api/export/download/${job.id}` : null,
      },
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : error.message.includes('tidak ditemukan') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memeriksa status ekspor.' },
      { status }
    );
  }
}
