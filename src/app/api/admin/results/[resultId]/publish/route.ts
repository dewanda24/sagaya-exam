import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamResultService } from '@/lib/services/exam-result.service';
import { queryPostgres } from '@/lib/core/postgres';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const auth = await requireApiPermission('results.publish');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { resultId } = await params;

    // Ambil exam_id dari resultId
    const resRow = await queryPostgres(
      `SELECT exam_id FROM exam_results WHERE id = $1 AND school_id = $2;`,
      [resultId, schoolId]
    );

    if (resRow.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Hasil ujian tidak ditemukan.' }, { status: 404 });
    }

    const examId = resRow.rows[0].exam_id;
    const res = await ExamResultService.publishResults(
      examId,
      schoolId,
      {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
      },
      [resultId]
    );

    return NextResponse.json({
      success: true,
      message: 'Hasil ujian berhasil dipublikasikan (PUBLISHED).',
      data: res,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mempublikasikan hasil ujian.' },
      { status: 400 }
    );
  }
}
