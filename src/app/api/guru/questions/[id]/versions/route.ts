import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(['GURU', 'ADMIN', 'SUPER_ADMIN']);
  if (!auth.authorized) return auth.response;

  try {
    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const { id: questionId } = await params;

    // Pastikan soal berada di sekolah pengguna
    const qRes = await queryPostgres(
      `SELECT id FROM question_banks WHERE id = $1 AND school_id = $2;`,
      [questionId, schoolId]
    );

    if (qRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Soal tidak ditemukan.' },
        { status: 404 }
      );
    }

    const revRes = await queryPostgres(
      `SELECT qr.*, u.full_name as creator_name
       FROM question_revisions qr
       LEFT JOIN users u ON qr.created_by = u.id
       WHERE qr.question_id = $1
       ORDER BY qr.revision_number DESC;`,
      [questionId]
    );

    return NextResponse.json({
      success: true,
      revisions: revRes.rows.map((r) => ({
        id: r.id,
        revisionNumber: r.revision_number,
        topic: r.topic,
        difficulty: r.difficulty,
        type: r.type,
        questionText: r.question_text,
        mediaUrl: r.media_url,
        mediaType: r.media_type,
        options: r.options_json,
        answerKey: r.answer_key_json,
        explanation: r.explanation,
        rubric: r.rubric_json?.rubric,
        weight: parseFloat(r.weight || '1.0'),
        tags: r.tags || [],
        createdAt: r.created_at,
        creatorName: r.creator_name,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat versi soal.' },
      { status: 500 }
    );
  }
}
