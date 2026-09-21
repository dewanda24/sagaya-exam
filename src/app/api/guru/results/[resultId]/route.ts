import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { ExamResultService } from '@/lib/services/exam-result.service';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const auth = await requireApiAuth(['GURU', 'ADMIN', 'SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const { resultId } = await params;

    // Scope check: If role is GURU, ensure this exam belongs to teacher's subject or created by teacher
    if (auth.user.role === 'GURU') {
      const scopeCheck = await queryPostgres(
        `SELECT er.id, e.subject_id, e.teacher_id
         FROM exam_results er
         JOIN exams e ON er.exam_id = e.id
         WHERE er.id = $1 AND er.school_id = $2
           AND (
             e.teacher_id = $3
             OR e.subject_id IN (SELECT subject_id FROM teacher_subjects WHERE teacher_id = $3 AND school_id = $2)
           );`,
        [resultId, schoolId, auth.user.id]
      );

      if (scopeCheck.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Akses ditolak: Hasil ujian ini berada di luar penugasan mengajar Anda.' },
          { status: 403 }
        );
      }
    }

    const data = await ExamResultService.getResultDetail(schoolId, resultId);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    const status = error.message?.includes('tidak ditemukan')
      ? 404
      : error.message?.includes('Akses ditolak')
      ? 403
      : 500;

    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat detail hasil ujian.' },
      { status }
    );
  }
}
