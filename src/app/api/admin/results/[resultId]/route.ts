import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamResultService } from '@/lib/services/exam-result.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const auth = await requireApiPermission('results.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const { resultId } = await params;
    const data = await ExamResultService.getResultDetail(schoolId, resultId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    const status = error.message?.includes('tidak ditemukan')
      ? 404
      : error.message?.includes('Akses ditolak')
      ? 403
      : 500;

    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat detail hasil ujian.' },
      { status }
    );
  }
}
