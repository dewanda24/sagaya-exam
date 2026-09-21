import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamResultService } from '@/lib/services/exam-result.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('results.export');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');
    const format = (searchParams.get('format') || 'xlsx').toLowerCase() as 'csv' | 'xlsx';

    if (!examId) {
      return NextResponse.json({ success: false, error: 'Parameter examId wajib diisi.' }, { status: 400 });
    }

    const exportFile = await ExamResultService.exportResults(examId, schoolId, format);

    return new NextResponse(exportFile.data, {
      status: 200,
      headers: {
        'Content-Type': exportFile.contentType,
        'Content-Disposition': `attachment; filename="${exportFile.filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengekspor hasil ujian.' },
      { status: 500 }
    );
  }
}
