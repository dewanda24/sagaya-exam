import { NextResponse } from 'next/server';
import { authenticateStudentSession } from '@/lib/core/auth';
import { QuestionDeliveryService } from '@/lib/services/question-delivery.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    const authResult = await authenticateStudentSession(req);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, code: authResult.code },
        { status: authResult.status }
      );
    }

    const resolvedParams = await params;
    const { questionId } = resolvedParams;

    if (!questionId) {
      return NextResponse.json(
        { success: false, error: 'ID Soal wajib disertakan.' },
        { status: 400 }
      );
    }

    const question = await QuestionDeliveryService.getQuestionById(authResult.context, questionId);

    return NextResponse.json({
      success: true,
      data: question,
    });
  } catch (error: any) {
    console.error('Error in GET /api/exam/session/current/questions/[questionId]:', error);
    const statusCode = error.message?.includes('Akses ditolak') ? 403 : 500;
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat soal ujian.' },
      { status: statusCode }
    );
  }
}
