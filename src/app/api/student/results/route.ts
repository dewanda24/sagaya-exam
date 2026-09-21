import { NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/core/postgres';
import { cookies } from 'next/headers';
import { validateServerSession } from '@/lib/core/auth';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;

    let studentId: string | null = null;
    let schoolId: string | null = null;

    if (token) {
      const sessionUser = await validateServerSession(token);
      if (sessionUser) {
        schoolId = sessionUser.schoolId || null;
        // Check if student record exists matching this user
        const sRes = await queryPostgres(
          `SELECT id, school_id FROM students WHERE user_id = $1 OR id = $1 LIMIT 1;`,
          [sessionUser.id]
        );
        if (sRes.rows.length > 0) {
          studentId = sRes.rows[0].id;
          schoolId = sRes.rows[0].school_id;
        }
      }
    }

    // Fallback: check student session header/cookie
    if (!studentId) {
      const studentSessionCookie = cookieStore.get('sagaya_student_session')?.value;
      if (studentSessionCookie) {
        try {
          const parsed = JSON.parse(Buffer.from(studentSessionCookie, 'base64').toString('utf-8'));
          if (parsed?.studentId) {
            studentId = parsed.studentId;
            schoolId = parsed.schoolId;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Sesi siswa tidak terdeteksi. Silakan masuk kembali.' },
        { status: 401 }
      );
    }

    // Ambil daftar hasil ujian yang statusnya PUBLISHED atau kebijakan tampil langsung
    const resultsQuery = `
      SELECT er.id as result_id, er.exam_id, er.final_score, er.percentage,
             (CAST(er.final_score AS float) >= CAST(COALESCE(e.passing_grade, 75) AS float)) as is_passed,
             er.status as result_status, er.published_at, er.graded_at,
             e.title as exam_title, e.duration_minutes, e.passing_grade,
             sub.name as subject_name, sub.code as subject_code
      FROM exam_results er
      JOIN exams e ON er.exam_id = e.id
      LEFT JOIN subjects sub ON e.subject_id = sub.id
      WHERE er.student_id = $1 AND (er.status = 'PUBLISHED' OR e.show_score_policy = 'IMMEDIATELY')
      ORDER BY er.published_at DESC NULLS LAST, er.created_at DESC;
    `;

    const res = await queryPostgres(resultsQuery, [studentId]);

    const results = res.rows.map((row) => ({
      resultId: row.result_id,
      examId: row.exam_id,
      examTitle: row.exam_title,
      subjectName: row.subject_name || 'Mata Pelajaran',
      subjectCode: row.subject_code || '-',
      durationMinutes: row.duration_minutes,
      finalScore: parseFloat(row.final_score || 0),
      percentage: parseFloat(row.percentage || 0),
      passingGrade: parseFloat(row.passing_grade || '75'),
      isPassed: Boolean(row.is_passed),
      status: row.result_status,
      publishedAt: row.published_at || row.graded_at,
    }));

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat hasil ujian siswa.' },
      { status: 500 }
    );
  }
}
