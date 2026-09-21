import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { AnalyticsAuthService } from '@/lib/core/analytics-auth';
import { ExportService } from '@/lib/services/export.service';

/**
 * GET: Ekspor Langsung (Synchronous) untuk berkas laporan cepat
 */
export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');
    const classId = searchParams.get('classId') || undefined;
    const format = (searchParams.get('format') || 'xlsx').toLowerCase() as 'csv' | 'xlsx' | 'pdf';

    if (!examId) {
      return NextResponse.json({ success: false, error: 'Parameter examId wajib diisi.' }, { status: 400 });
    }

    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);
    const exportResult = await ExportService.exportExamResults(context, examId, format, { classId });

    return new Response(new Uint8Array(exportResult.buffer), {
      status: 200,
      headers: {
        'Content-Type': exportResult.contentType,
        'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    const status = error.message.includes('Akses ditolak') ? 403 : error.message.includes('tidak ditemukan') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghasilkan berkas ekspor.' },
      { status }
    );
  }
}

/**
 * POST: Buat Antrian Ekspor Asinkron (Async Export Job) untuk dataset besar
 */
export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { reportType, format = 'XLSX', filters = {} } = body;

    if (!reportType) {
      return NextResponse.json({ success: false, error: 'reportType wajib diisi.' }, { status: 400 });
    }

    const context = AnalyticsAuthService.fromSession(auth.user, auth.tenant);
    const job = await ExportService.createExportJob(context, reportType, format.toUpperCase(), filters);

    // Trigger process in background
    setTimeout(async () => {
      try {
        await ExportService.processExportJob(job.id);
      } catch (e) {
        console.error('Async export job processing error:', e);
      }
    }, 10);

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        message: 'Antrian pembuatan berkas ekspor telah dibuat.',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal membuat antrian ekspor.' },
      { status: 500 }
    );
  }
}
