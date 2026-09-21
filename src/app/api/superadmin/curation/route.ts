import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU'], searchParams);
    if (!auth.authorized) return auth.response;

    const statusFilter = searchParams.get('status') || 'ALL';
    const subjectFilter = searchParams.get('subjectId');
    const schoolFilter = searchParams.get('schoolId');
    const search = searchParams.get('search');

    let query = `
      SELECT 
        qb.id,
        qb.school_id,
        sc.name as school_name,
        sc.code as school_code,
        qb.subject_id,
        s.name as subject_name,
        qb.teacher_id,
        u.full_name as teacher_name,
        qb.topic,
        qb.difficulty,
        qb.type,
        qb.cognitive_level,
        qb.competence_code,
        qb.question_text,
        qb.media_url,
        qb.media_type,
        qb.options_json,
        qb.answer_key_json,
        qb.rubric_json,
        qb.weight,
        qb.tags,
        qb.is_shared,
        qb.curation_status,
        qb.curation_notes,
        qb.curated_by,
        qb.curated_at,
        qb.created_at
      FROM question_banks qb
      LEFT JOIN subjects s ON qb.subject_id = s.id
      LEFT JOIN schools sc ON qb.school_id = sc.id
      LEFT JOIN users u ON qb.teacher_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Filter by curation status
    if (statusFilter !== 'ALL') {
      params.push(statusFilter);
      query += ` AND qb.curation_status = $${params.length}`;
    }

    // Filter by subject
    if (subjectFilter) {
      params.push(subjectFilter);
      query += ` AND qb.subject_id = $${params.length}`;
    }

    // Filter by school
    if (schoolFilter) {
      params.push(schoolFilter);
      query += ` AND qb.school_id = $${params.length}`;
    }

    // Text search
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (qb.question_text ILIKE $${params.length} OR qb.topic ILIKE $${params.length} OR qb.competence_code ILIKE $${params.length})`;
    }

    // If teacher or school admin (non-superadmin), only show their own school questions or approved regional questions
    if (auth.user.role !== 'SUPER_ADMIN') {
      params.push(auth.user.schoolId);
      query += ` AND (qb.school_id = $${params.length} OR qb.curation_status = 'APPROVED_REGIONAL')`;
    }

    query += ` ORDER BY qb.created_at DESC LIMIT 100;`;

    const res = await queryPostgres(query, params);

    // Fetch summary statistics
    const statsRes = await queryPostgres(`
      SELECT 
        count(*) as total_questions,
        count(CASE WHEN is_shared = true THEN 1 END) as total_shared,
        count(CASE WHEN curation_status = 'APPROVED_REGIONAL' THEN 1 END) as approved_regional,
        count(CASE WHEN curation_status = 'PENDING_REVIEW' THEN 1 END) as pending_review,
        count(CASE WHEN curation_status = 'REJECTED' THEN 1 END) as rejected
      FROM question_banks;
    `);

    // Available subjects and schools for filters
    const subjectsRes = await queryPostgres(`SELECT id, name, code FROM subjects ORDER BY name ASC;`);
    const schoolsRes = await queryPostgres(`SELECT id, name, code FROM schools WHERE is_active = true ORDER BY name ASC;`);

    const stats = statsRes.rows[0] || {};

    return NextResponse.json({
      success: true,
      data: {
        questions: res.rows.map((r: any) => ({
          id: r.id,
          schoolId: r.school_id,
          schoolName: r.school_name || 'Standar Pusat/Dinas',
          schoolCode: r.school_code,
          subjectId: r.subject_id,
          subjectName: r.subject_name || 'Umum',
          teacherId: r.teacher_id,
          teacherName: r.teacher_name || 'Guru Pengampu',
          topic: r.topic,
          difficulty: r.difficulty,
          type: r.type,
          cognitiveLevel: r.cognitive_level || 'L2_PENERAPAN',
          competenceCode: r.competence_code || '-',
          questionText: r.question_text,
          mediaUrl: r.media_url,
          mediaType: r.media_type,
          options: r.options_json || [],
          answerKey: r.answer_key_json,
          rubric: r.rubric_json?.text || '',
          weight: parseFloat(r.weight) || 10,
          tags: r.tags || [],
          isShared: r.is_shared,
          curationStatus: r.curation_status || 'PENDING_REVIEW',
          curationNotes: r.curation_notes || '',
          curatedBy: r.curated_by,
          curatedAt: r.curated_at,
          createdAt: r.created_at,
        })),
        stats: {
          totalQuestions: parseInt(stats.total_questions || '0', 10),
          totalShared: parseInt(stats.total_shared || '0', 10),
          approvedRegional: parseInt(stats.approved_regional || '0', 10),
          pendingReview: parseInt(stats.pending_review || '0', 10),
          rejected: parseInt(stats.rejected || '0', 10),
        },
        subjects: subjectsRes.rows,
        schools: schoolsRes.rows,
        canCurate: auth.user.role === 'SUPER_ADMIN',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat bank soal kurasi.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const {
      questionId,
      status,
      notes,
      cognitiveLevel,
      competenceCode,
      weight,
    } = body;

    if (!questionId || !status) {
      return NextResponse.json(
        { success: false, error: 'questionId dan status wajib disertakan.' },
        { status: 400 }
      );
    }

    const curatorName = auth.user.fullName || auth.user.username || 'Super Admin (Dinas)';

    const updateRes = await queryPostgres(
      `UPDATE question_banks 
       SET curation_status = $1,
           curation_notes = $2,
           curated_by = $3,
           curated_at = NOW(),
           cognitive_level = COALESCE($4, cognitive_level),
           competence_code = COALESCE($5, competence_code),
           weight = COALESCE($6, weight)
       WHERE id = $7
       RETURNING *;`,
      [status, notes || null, curatorName, cognitiveLevel || null, competenceCode || null, weight || null, questionId]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Butir soal tidak ditemukan.' }, { status: 404 });
    }

    const updated = updateRes.rows[0];

    // Audit log
    await queryPostgres(
      `INSERT INTO audit_logs (id, user_id, action, details_json, created_at)
       VALUES (uuid_generate_v4(), $1, $2, $3::jsonb, NOW());`,
      [
        auth.user.id,
        status === 'APPROVED_REGIONAL' ? 'APPROVE_QUESTION_REGIONAL' : 'REJECT_QUESTION_REGIONAL',
        JSON.stringify({
          questionId,
          status,
          notes,
          topic: updated.topic,
          competenceCode,
        }),
      ]
    );

    return NextResponse.json({
      success: true,
      message:
        status === 'APPROVED_REGIONAL'
          ? 'Butir soal resmi disetujui sebagai Standar Wilayah (Bank Soal Dinas).'
          : 'Butir soal ditolak dengan catatan kurasi perbaikan.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses kurasi soal.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { action, questionIds = [] } = body;

    if (!action || questionIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'action dan daftar questionIds wajib disertakan.' },
        { status: 400 }
      );
    }

    const curatorName = auth.user.fullName || auth.user.username || 'Super Admin (Dinas)';

    if (action === 'BATCH_APPROVE') {
      await queryPostgres(
        `UPDATE question_banks 
         SET curation_status = 'APPROVED_REGIONAL',
             curated_by = $1,
             curated_at = NOW()
         WHERE id = ANY($2);`,
        [curatorName, questionIds]
      );

      // Audit log
      await queryPostgres(
        `INSERT INTO audit_logs (id, user_id, action, details_json, created_at)
         VALUES (uuid_generate_v4(), $1, 'BATCH_APPROVE_REGIONAL', $2::jsonb, NOW());`,
        [auth.user.id, JSON.stringify({ count: questionIds.length, questionIds })]
      );

      return NextResponse.json({
        success: true,
        message: `Berhasil menyetujui ${questionIds.length} butir soal menjadi Standar Wilayah secara massal.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Aksi massal tidak dikenal.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses aksi massal kurasi.' },
      { status: 500 }
    );
  }
}
