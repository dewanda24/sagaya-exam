import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const detailId = searchParams.get('id');

    // If detailId is requested, return full detail with breakdown per school
    if (detailId) {
      const masterRes = await queryPostgres(
        `SELECT me.*, s.name as subject_name
         FROM exams me
         LEFT JOIN subjects s ON me.subject_id = s.id
         WHERE me.id = $1 AND me.is_regional = true;`,
        [detailId]
      );

      if (masterRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Ujian wilayah tidak ditemukan.' }, { status: 404 });
      }

      const master = masterRes.rows[0];

      // Fetch child exams per school with live participation count
      const childRes = await queryPostgres(
        `SELECT 
           ce.id,
           ce.school_id,
           sc.name as school_name,
           sc.code as school_code,
           sc.rayon,
           sc.level,
           ce.status,
           count(DISTINCT ep.id) as total_participants,
           count(DISTINCT CASE WHEN ep.final_score IS NOT NULL THEN ep.id END) as completed_participants,
           count(DISTINCT CASE WHEN s.status = 'IN_PROGRESS' THEN s.id END) as in_progress_participants,
           round(avg(ep.final_score), 2) as avg_score
         FROM exams ce
         JOIN schools sc ON ce.school_id = sc.id
         LEFT JOIN exam_participants ep ON ce.id = ep.exam_id
         LEFT JOIN sessions s ON ep.id = s.exam_participant_id
         WHERE ce.parent_exam_id = $1
         GROUP BY ce.id, ce.school_id, sc.name, sc.code, sc.rayon, sc.level, ce.status
         ORDER BY sc.name ASC;`,
        [detailId]
      );

      return NextResponse.json({
        success: true,
        data: {
          master: {
            id: master.id,
            title: master.title,
            subjectId: master.subject_id,
            subjectName: master.subject_name,
            status: master.status,
            windowMode: master.window_mode,
            startTime: master.start_time,
            endTime: master.end_time,
            durationMinutes: master.duration_minutes,
            questions: master.question_snapshot_json || [],
            createdAt: master.created_at,
          },
          distribution: childRes.rows.map((c: any) => ({
            examId: c.id,
            schoolId: c.school_id,
            schoolName: c.school_name,
            schoolCode: c.school_code,
            rayon: c.rayon || 'Rayon 1',
            level: c.level,
            status: c.status,
            totalParticipants: parseInt(c.total_participants, 10),
            completedParticipants: parseInt(c.completed_participants, 10),
            inProgressParticipants: parseInt(c.in_progress_participants, 10),
            avgScore: c.avg_score ? parseFloat(c.avg_score) : null,
          })),
        },
      });
    }

    // Fetch master regional exams with aggregated broadcast stats
    const res = await queryPostgres(`
      SELECT 
        me.id,
        me.title,
        me.subject_id,
        s.name as subject_name,
        me.status,
        me.window_mode,
        me.start_time,
        me.end_time,
        me.duration_minutes,
        me.question_snapshot_json,
        me.created_at,
        COALESCE(stat.total_schools, 0) as total_schools,
        COALESCE(stat.total_participants, 0) as total_participants,
        COALESCE(stat.completed_participants, 0) as completed_participants
      FROM exams me
      LEFT JOIN subjects s ON me.subject_id = s.id
      LEFT JOIN (
        SELECT 
          ce.parent_exam_id,
          count(DISTINCT ce.school_id) as total_schools,
          count(DISTINCT ep.id) as total_participants,
          count(DISTINCT CASE WHEN ep.final_score IS NOT NULL THEN ep.id END) as completed_participants
        FROM exams ce
        LEFT JOIN exam_participants ep ON ce.id = ep.exam_id
        WHERE ce.parent_exam_id IS NOT NULL
        GROUP BY ce.parent_exam_id
      ) stat ON me.id = stat.parent_exam_id
      WHERE me.is_regional = true AND me.parent_exam_id IS NULL
      ORDER BY me.created_at DESC;
    `);

    // Available subjects and active schools for creation form
    const subjectsRes = await queryPostgres(`SELECT id, name, code FROM subjects ORDER BY name ASC;`);
    const schoolsRes = await queryPostgres(`SELECT id, name, code, level, rayon, quota_students, is_active FROM schools WHERE is_active = true ORDER BY name ASC;`);

    return NextResponse.json({
      success: true,
      data: {
        regionalExams: res.rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          subjectId: r.subject_id,
          subjectName: r.subject_name,
          status: r.status,
          windowMode: r.window_mode,
          startTime: r.start_time,
          endTime: r.end_time,
          durationMinutes: r.duration_minutes,
          totalQuestions: (r.question_snapshot_json || []).length,
          totalSchools: parseInt(r.total_schools, 10),
          totalParticipants: parseInt(r.total_participants, 10),
          completedParticipants: parseInt(r.completed_participants, 10),
          createdAt: r.created_at,
        })),
        subjects: subjectsRes.rows,
        schools: schoolsRes.rows,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat daftar ujian standar wilayah.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const {
      title,
      subjectId,
      startTime,
      endTime,
      durationMinutes,
      windowMode = 'SIMULTANEOUS',
      targetType = 'ALL_SCHOOLS',
      targetLevel = 'SMA',
      targetRayon,
      targetSchoolIds = [],
    } = body;

    if (!title || !subjectId || !startTime || !endTime || !durationMinutes) {
      return NextResponse.json(
        { success: false, error: 'Judul, Mata Pelajaran, Waktu Mulai/Selesai, dan Durasi wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Fetch questions for snapshot: prioritize approved regional curation
    const qRes = await queryPostgres(
      `SELECT * FROM question_banks 
       WHERE subject_id = $1 
         AND (curation_status = 'APPROVED_REGIONAL' OR curation_status = 'APPROVED' OR is_shared = true)
       ORDER BY created_at ASC;`,
      [subjectId]
    );

    let questions = qRes.rows;
    if (questions.length === 0) {
      const anyQRes = await queryPostgres(
        `SELECT * FROM question_banks WHERE subject_id = $1 ORDER BY created_at ASC;`,
        [subjectId]
      );
      questions = anyQRes.rows;
    }

    if (questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Belum ada butir bank soal terkurasi untuk mata pelajaran ini. Silakan kurasi soal terlebih dahulu.',
        },
        { status: 400 }
      );
    }

    const snapshot = questions.map((r: any) => ({
      id: r.id,
      subjectId: r.subject_id,
      topic: r.topic,
      difficulty: r.difficulty,
      type: r.type,
      cognitiveLevel: r.cognitive_level || 'L2_PENERAPAN',
      competenceCode: r.competence_code || '',
      questionText: r.question_text,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      options: r.options_json || [],
      answerKey: r.answer_key_json,
      rubric: r.rubric_json?.text || '',
      weight: parseFloat(r.weight) || 10,
    }));

    // 2. Insert Master Regional Exam (parent_exam_id IS NULL, school_id IS NULL)
    const masterRes = await queryPostgres(
      `INSERT INTO exams (
         id, title, subject_id, status, window_mode, 
         start_time, end_time, duration_minutes, question_snapshot_json, 
         is_regional, parent_exam_id, school_id
       ) VALUES (
         uuid_generate_v4(), $1, $2, 'ACTIVE', $3, $4, $5, $6, $7::jsonb, true, NULL, NULL
       ) RETURNING *;`,
      [
        title,
        subjectId,
        windowMode,
        startTime,
        endTime,
        parseInt(durationMinutes, 10),
        JSON.stringify(snapshot),
      ]
    );

    const masterExam = masterRes.rows[0];

    // 3. Resolve Target Schools
    let targetSchoolsQuery = `SELECT id, name FROM schools WHERE is_active = true`;
    const targetParams: any[] = [];

    if (targetType === 'BY_LEVEL') {
      targetParams.push(targetLevel);
      targetSchoolsQuery += ` AND level = $${targetParams.length}`;
    } else if (targetType === 'BY_RAYON' && targetRayon) {
      targetParams.push(targetRayon);
      targetSchoolsQuery += ` AND rayon = $${targetParams.length}`;
    } else if (targetType === 'SPECIFIC_SCHOOLS' && targetSchoolIds.length > 0) {
      targetParams.push(targetSchoolIds);
      targetSchoolsQuery += ` AND id = ANY($${targetParams.length})`;
    }

    const targetSchoolsRes = await queryPostgres(targetSchoolsQuery, targetParams);
    const targetSchools = targetSchoolsRes.rows;

    if (targetSchools.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada sekolah aktif yang cocok dengan kriteria sasaran broadcast.' },
        { status: 400 }
      );
    }

    // 4. Lightweight Broadcast to each target school
    let broadcastCount = 0;
    for (const school of targetSchools) {
      await queryPostgres(
        `INSERT INTO exams (
           id, title, subject_id, status, window_mode, 
           start_time, end_time, duration_minutes, question_snapshot_json, 
           school_id, is_regional, parent_exam_id
         ) VALUES (
           uuid_generate_v4(), $1, $2, 'ACTIVE', $3, $4, $5, $6, $7::jsonb, $8, true, $9
         );`,
        [
          `[Wilayah] ${title}`,
          subjectId,
          windowMode,
          startTime,
          endTime,
          parseInt(durationMinutes, 10),
          JSON.stringify(snapshot),
          school.id,
          masterExam.id,
        ]
      );
      broadcastCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Ujian Standar Wilayah berhasil diterbitkan! Didistribusikan serentak ke ${broadcastCount} satuan pendidikan (${snapshot.length} butir soal beku terkurasi).`,
      data: {
        masterExamId: masterExam.id,
        broadcastCount,
        schoolsTargeted: targetSchools.map((s: any) => s.name),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyelenggarakan ujian standar daerah.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { masterExamId, action, newStatus, additionalMinutes } = body;

    if (!masterExamId || !action) {
      return NextResponse.json(
        { success: false, error: 'masterExamId dan action wajib disertakan.' },
        { status: 400 }
      );
    }

    if (action === 'STATUS_CASCADE') {
      if (!newStatus) {
        return NextResponse.json({ success: false, error: 'newStatus wajib diisi.' }, { status: 400 });
      }

      await queryPostgres(
        `UPDATE exams 
         SET status = $1 
         WHERE id = $2 OR parent_exam_id = $2;`,
        [newStatus, masterExamId]
      );

      return NextResponse.json({
        success: true,
        message: `Status seluruh pelaksanaan ujian wilayah berhasil diselaraskan menjadi ${newStatus}.`,
      });
    }

    if (action === 'EXTEND_TIME') {
      const minutes = parseInt(additionalMinutes, 10);
      if (isNaN(minutes) || minutes <= 0) {
        return NextResponse.json({ success: false, error: 'additionalMinutes harus berupa angka positif.' }, { status: 400 });
      }

      await queryPostgres(
        `UPDATE exams 
         SET duration_minutes = duration_minutes + $1,
             end_time = end_time + ($1 || ' minutes')::interval
         WHERE id = $2 OR parent_exam_id = $2;`,
        [minutes, masterExamId]
      );

      return NextResponse.json({
        success: true,
        message: `Waktu ujian wilayah berhasil diperpanjang +${minutes} menit untuk seluruh satuan pendidikan terkait.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Action tidak dikenal.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengontrol ujian wilayah.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID ujian wilayah wajib disertakan.' }, { status: 400 });
    }

    await queryPostgres(`DELETE FROM exams WHERE id = $1 AND is_regional = true AND parent_exam_id IS NULL;`, [id]);

    return NextResponse.json({
      success: true,
      message: 'Ujian standar wilayah beserta distribusinya berhasil ditarik/dihapus.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus ujian standar wilayah.' },
      { status: 500 }
    );
  }
}
