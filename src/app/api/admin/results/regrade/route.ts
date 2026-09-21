import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamResultService } from '@/lib/services/exam-result.service';

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('results.regrade');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { examId, reason } = body;

    if (!examId || !reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, error: 'examId dan reason (alasan regrade) wajib diisi.' },
        { status: 400 }
      );
    }

    const res = await ExamResultService.regradeExam(
      examId,
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
      message: `Regrading berhasil diselesaikan. Total ${res.affectedCount} sesi peserta diperbarui.`,
      data: res,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menjalankan regrading ujian.' },
      { status: 400 }
    );
  }
}
