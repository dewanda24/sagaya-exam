import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamResultService } from '@/lib/services/exam-result.service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const auth = await requireApiPermission('results.correct');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { resultId } = await params;
    const body = await req.json();
    const { newScore, reason } = body;

    if (newScore === undefined || !reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, error: 'newScore dan reason (alasan koreksi) wajib diisi.' },
        { status: 400 }
      );
    }

    const res = await ExamResultService.correctResult(
      resultId,
      schoolId,
      parseFloat(newScore),
      reason.trim(),
      {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Nilai ujian berhasil dikoreksi dan tercatat pada audit jejak rekam.',
      data: res,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengoreksi nilai ujian.' },
      { status: 400 }
    );
  }
}
