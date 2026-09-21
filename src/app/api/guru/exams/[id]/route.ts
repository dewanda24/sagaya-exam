import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherExamService } from '@/lib/services/teacher-exam.service';
import { queryPostgres, withTransaction } from '@/lib/core/postgres';
import { AuditService } from '@/lib/services/audit.service';
import { TeacherAuthorizationService } from '@/lib/services/teacher-authorization.service';

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

    const { id } = await params;
    const exam = await TeacherExamService.getExamDetail(
      schoolId,
      auth.user.id,
      id,
      auth.user.role
    );

    return NextResponse.json({ success: true, data: exam });
  } catch (err: any) {
    const status = err.message?.includes('Akses ditolak') ? 403 : 404;
    return NextResponse.json(
      { success: false, error: err.message || 'Ujian tidak ditemukan.' },
      { status }
    );
  }
}

export async function PUT(
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

    const { id } = await params;
    const body = await req.json();

    const existingRes = await queryPostgres(
      `SELECT * FROM exams WHERE id = $1 AND school_id = $2;`,
      [id, schoolId]
    );

    if (existingRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    const existing = existingRes.rows[0];

    // Otorisasi edit
    if (auth.user.role !== 'SUPER_ADMIN' && auth.user.role !== 'ADMIN') {
      const canEdit = await TeacherAuthorizationService.canEditExam(auth.user, existing, schoolId);
      if (!canEdit.allowed) {
        return NextResponse.json({ success: false, error: canEdit.reason }, { status: 403 });
      }
    }

    const updated = await withTransaction(async (client) => {
      const uRes = await client.query(
        `UPDATE exams SET
          title = COALESCE($1, title),
          duration_minutes = COALESCE($2, duration_minutes),
          start_time = COALESCE($3, start_time),
          end_time = COALESCE($4, end_time),
          randomize_questions = COALESCE($5, randomize_questions),
          randomize_options = COALESCE($6, randomize_options),
          show_score_policy = COALESCE($7, show_score_policy),
          target_class_ids = COALESCE($8, target_class_ids),
          passing_grade = COALESCE($9, passing_grade)
         WHERE id = $10 AND school_id = $11
         RETURNING *;`,
        [
          body.title?.trim(),
          body.durationMinutes ? Number(body.durationMinutes) : undefined,
          body.startTime,
          body.endTime,
          body.randomizeQuestions,
          body.randomizeOptions,
          body.showScorePolicy,
          body.targetClassIds,
          body.passingGrade ? Number(body.passingGrade) : undefined,
          id,
          schoolId,
        ]
      );

      // Perbarui daftar soal jika disediakan
      if (Array.isArray(body.questionIds)) {
        await client.query(`DELETE FROM exam_questions WHERE exam_id = $1;`, [id]);
        for (let i = 0; i < body.questionIds.length; i++) {
          await client.query(
            `INSERT INTO exam_questions (id, exam_id, question_id, revision_number, order_index, weight)
             VALUES (uuid_generate_v4(), $1, $2, 1, $3, 1.0)
             ON CONFLICT (exam_id, question_id) DO NOTHING;`,
            [id, body.questionIds[i], i + 1]
          );
        }
      }

      await AuditService.createLog({
        action: 'EXAM_UPDATED',
        schoolId,
        actor: { id: auth.user.id, username: auth.user.username, role: auth.user.role },
        resourceType: 'EXAM',
        resourceId: id,
        details: { title: uRes.rows[0].title },
      });

      return uRes.rows[0];
    });

    return NextResponse.json({
      success: true,
      message: 'Konfigurasi ujian berhasil diperbarui.',
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memperbarui ujian.' },
      { status: 400 }
    );
  }
}
