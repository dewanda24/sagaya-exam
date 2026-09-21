import { NextResponse } from 'next/server';
import { authenticateStudentSession } from '@/lib/core/auth';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const authResult = await authenticateStudentSession(req);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error, code: authResult.code },
        { status: authResult.status }
      );
    }

    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get('questionId');
    const mediaUrl = searchParams.get('mediaUrl');

    if (!questionId || !mediaUrl) {
      return NextResponse.json(
        { success: false, error: 'Parameter questionId dan mediaUrl wajib disertakan.' },
        { status: 400 }
      );
    }

    const { sessionId } = authResult.context;

    // Verifikasi bahwa questionId dan mediaUrl benar-benar terikat pada snapshot sesi aktif ini
    const mediaCheckRes = await queryPostgres(
      `SELECT qm.id, sq.configuration_json
       FROM question_order_maps qm
       JOIN exam_snapshot_questions sq ON qm.snapshot_question_id = sq.id
       WHERE qm.session_id = $1 AND qm.question_id = $2
       LIMIT 1;`,
      [sessionId, questionId]
    );

    if (mediaCheckRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Soal tidak terdaftar dalam sesi Anda.' },
        { status: 403 }
      );
    }

    const config = mediaCheckRes.rows[0].configuration_json || {};
    const attachedMediaUrl = config.mediaUrl || config.media_url;

    // Cek juga di opsi jika ada
    let isAttached = attachedMediaUrl === mediaUrl;
    if (!isAttached && Array.isArray(config.options)) {
      isAttached = config.options.some((opt: any) => opt.mediaUrl === mediaUrl || opt.media_url === mediaUrl);
    }

    if (!isAttached) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Media tidak terafiliasi dengan soal ini.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        authorized: true,
        mediaUrl,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/exam/session/current/media:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memverifikasi otorisasi media.' },
      { status: 500 }
    );
  }
}
