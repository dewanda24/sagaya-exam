import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamResultService } from '@/lib/services/exam-result.service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const auth = await requireApiPermission('results.review');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { resultId } = await params;
    const res = await ExamResultService.reviewResult(resultId, schoolId, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Hasil ujian berhasil disetujui (REVIEWED).',
      data: res,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses review hasil ujian.' },
      { status: 400 }
    );
  }
}
