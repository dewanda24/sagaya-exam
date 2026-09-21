import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken } from '@/lib/core/auth';
import { generateExamToken } from '@/lib/school/token-generator';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { examId, classId } = await req.json();

    // Find active exam if examId not specified
    let targetExamId = examId;
    if (!targetExamId) {
      const examRes = await queryPostgres(
        `SELECT id, title, school_id FROM exams WHERE status = 'ACTIVE' ${user.role !== 'SUPER_ADMIN' ? 'AND school_id = $1' : ''} ORDER BY created_at DESC LIMIT 1;`,
        user.role !== 'SUPER_ADMIN' ? [user.schoolId] : []
      );
      if (examRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Tidak ada ujian aktif saat ini.' },
          { status: 404 }
        );
      }
      targetExamId = examRes.rows[0].id;
    } else if (user.role !== 'SUPER_ADMIN') {
      const examOwnerCheck = await queryPostgres('SELECT school_id FROM exams WHERE id = $1 LIMIT 1;', [targetExamId]);
      if (examOwnerCheck.rows.length === 0 || examOwnerCheck.rows[0].school_id !== user.schoolId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Anda tidak dapat membuat token untuk ujian sekolah lain.' },
          { status: 403 }
        );
      }
    }

    // Find students without tokens for this exam
    let studentQuery = `
      SELECT s.id, s.full_name, s.nisn 
      FROM students s
      WHERE s.id NOT IN (
        SELECT student_id FROM exam_participants WHERE exam_id = $1
      )
    `;
    const params: any[] = [targetExamId];

    if (classId) {
      params.push(classId);
      studentQuery += ` AND s.class_room_id = $2`;
    }

    const unassignedRes = await queryPostgres(studentQuery, params);
    const unassignedStudents = unassignedRes.rows;

    if (unassignedStudents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Seluruh siswa telah memiliki token untuk ujian ini.',
        data: { generatedCount: 0 },
      });
    }

    const packages = ['A', 'B', 'C', 'D'];
    let generatedCount = 0;

    for (let i = 0; i < unassignedStudents.length; i++) {
      const student = unassignedStudents[i];
      let token = generateExamToken();

      // Ensure uniqueness
      let isUnique = false;
      while (!isUnique) {
        const check = await queryPostgres(
          `SELECT id FROM exam_participants WHERE exam_id = $1 AND token = $2;`,
          [targetExamId, token]
        );
        if (check.rows.length === 0) {
          isUnique = true;
        } else {
          token = generateExamToken();
        }
      }

      const assignedPkg = packages[i % packages.length];

      await queryPostgres(
        `INSERT INTO exam_participants (id, exam_id, student_id, token, token_status, assigned_package)
         VALUES (uuid_generate_v4(), $1, $2, $3, 'ACTIVE', $4);`,
        [targetExamId, student.id, token, assignedPkg]
      );
      generatedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil men-generate ${generatedCount} token ujian baru untuk para siswa!`,
      data: { generatedCount },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal generate token massal.' },
      { status: 500 }
    );
  }
}
