import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamResultService } from '@/lib/services/exam-result.service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const auth = await requireApiPermission('results.void');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { resultId } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, error: 'Alasan pembatalan (VOID) wajib dicantumkan.' },
        { status: 400 }
      );
    }

    const res = await ExamResultService.voidResult(
      resultId,
      schoolId,
      reason.trim(),
      {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Hasil ujian berhasil dibatalkan (VOID).',
      data: res,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal membatalkan hasil ujian.' },
      { status: 400 }
    );
  }
}
