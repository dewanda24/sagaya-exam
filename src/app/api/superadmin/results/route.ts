import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  const auth = await requireApiAuth(['SUPER_ADMIN']);
  if (!auth.authorized) return auth.response;

  try {
    const url = new URL(req.url);
    const schoolId = url.searchParams.get('schoolId') || undefined;
    const examId = url.searchParams.get('examId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    const conditions: string[] = [];
    const params: any[] = [];

    if (schoolId) {
      params.push(schoolId);
      conditions.push(`er.school_id = $${params.length}`);
    }
    if (examId) {
      params.push(examId);
      conditions.push(`er.exam_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`er.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`(LOWER(st.full_name) LIKE $${params.length} OR LOWER(st.nisn) LIKE $${params.length} OR LOWER(sch.name) LIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await queryPostgres(
      `SELECT COUNT(*)::int as total
       FROM exam_results er
       JOIN students st ON er.student_id = st.id
       JOIN schools sch ON er.school_id = sch.id
       JOIN exams e ON er.exam_id = e.id
       ${whereClause};`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const dataQuery = `
      SELECT er.id as result_id, er.exam_id, er.final_score, er.percentage,
             (CAST(er.final_score AS float) >= CAST(COALESCE(e.passing_grade, 75) AS float)) as is_passed,
             er.status as result_status, er.published_at, er.graded_at,
             st.id as student_id, st.full_name as student_name, st.nisn, st.nis,
             c.name as class_name,
             sch.id as school_id, sch.name as school_name, sch.code as school_code,
             e.title as exam_title, e.passing_grade,
             sub.name as subject_name
      FROM exam_results er
      JOIN students st ON er.student_id = st.id
      JOIN schools sch ON er.school_id = sch.id
      JOIN exams e ON er.exam_id = e.id
      LEFT JOIN class_rooms c ON st.class_room_id = c.id
      LEFT JOIN subjects sub ON e.subject_id = sub.id
      ${whereClause}
      ORDER BY er.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const dataRes = await queryPostgres(dataQuery, [...params, limit, offset]);

    // Also fetch schools list for filtering
    const schoolsRes = await queryPostgres(
      `SELECT id, name, code FROM schools ORDER BY name ASC LIMIT 100;`
    );

    return NextResponse.json({
      success: true,
      data: {
        results: dataRes.rows.map((r) => ({
          resultId: r.result_id,
          examId: r.exam_id,
          examTitle: r.exam_title,
          subjectName: r.subject_name || '-',
          schoolId: r.school_id,
          schoolName: r.school_name,
          schoolCode: r.school_code,
          studentId: r.student_id,
          studentName: r.student_name,
          nisn: r.nisn,
          nis: r.nis,
          className: r.class_name || '-',
          finalScore: parseFloat(r.final_score || 0),
          percentage: parseFloat(r.percentage || 0),
          passingGrade: parseFloat(r.passing_grade || '75'),
          isPassed: Boolean(r.is_passed),
          status: r.result_status,
          publishedAt: r.published_at,
          gradedAt: r.graded_at,
        })),
        total,
        limit,
        offset,
        schools: schoolsRes.rows,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat rekap hasil platform.' },
      { status: 500 }
    );
  }
}
