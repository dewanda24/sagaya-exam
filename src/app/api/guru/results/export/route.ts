import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherGradingService } from '@/lib/services/teacher-grading.service';
import { TeacherQuestionService } from '@/lib/services/teacher-question.service';
import { AuditService } from '@/lib/services/audit.service';

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const examId = url.searchParams.get('examId');
    const classId = url.searchParams.get('classId') || undefined;

    if (!examId) {
      return NextResponse.json(
        { success: false, error: 'ID Ujian (examId) wajib disertakan.' },
        { status: 400 }
      );
    }

    const { participants } = await TeacherGradingService.getExamResults(
      schoolId,
      auth.user.id,
      examId,
      { classId, limit: 1000 },
      auth.user.role
    );

    // Format export dengan sanitasi formula injection
    const sanitizedRows = participants.map((r: any, idx: number) => ({
      No: idx + 1,
      NamaSiswa: TeacherQuestionService.sanitizeForExport(r.fullName),
      NIS: TeacherQuestionService.sanitizeForExport(r.nis),
      NISN: TeacherQuestionService.sanitizeForExport(r.nisn),
      Kelas: TeacherQuestionService.sanitizeForExport(r.className),
      NilaiAkhir: r.finalScore !== null ? r.finalScore : 'Belum Selesai',
      StatusPenilaian: r.gradedStatus,
      StatusSesi: r.sessionStatus,
      WaktuSelesai: r.submittedAt || '-',
    }));

    await AuditService.createLog({
      action: 'RESULT_EXPORTED',
      schoolId,
      actor: { id: auth.user.id, username: auth.user.username, role: auth.user.role },
      resourceType: 'EXAM_RESULT',
      resourceId: examId,
      details: { totalRows: sanitizedRows.length },
    });

    return NextResponse.json({
      success: true,
      count: sanitizedRows.length,
      data: sanitizedRows,
    });
  } catch (err: any) {
    const status = err.message?.includes('Akses ditolak') ? 403 : 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal mengekspor hasil ujian.' },
      { status }
    );
  }
}
