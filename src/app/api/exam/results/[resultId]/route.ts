import { NextResponse } from 'next/server';
import { authenticateStudentSession } from '@/lib/core/auth';
import { ExamResultService } from '@/lib/services/exam-result.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const { resultId } = await params;

    // Otentikasi sesi siswa (mengizinkan sesi read-only / submitted)
    const authResult = await authenticateStudentSession(req, { allowReadOnly: true });
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, code: authResult.code },
        { status: authResult.status }
      );
    }

    const data = await ExamResultService.getStudentPublishedResult(resultId, authResult.context);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    const status = error.message?.includes('Akses ditolak')
      ? 403
      : error.message?.includes('belum dipublikasikan')
      ? 403
      : error.message?.includes('tidak ditemukan')
      ? 404
      : 500;

    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat hasil ujian.' },
      { status }
    );
  }
}
