import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamMonitoringService } from '@/lib/services/exam-monitoring.service';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('monitoring.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');

    // Jika belum pilih exam, ambil daftar ujian aktif atau selesai hari ini
    const examsRes = await queryPostgres(
      `SELECT id, title, status, start_time, end_time FROM exams WHERE school_id = $1 ORDER BY start_time DESC;`,
      [schoolId]
    );

    const targetExamId = examId || examsRes.rows[0]?.id;
    if (!targetExamId) {
      return NextResponse.json({
        success: true,
        data: {
          exams: [],
          currentExam: null,
          metrics: {
            totalParticipants: 0,
            notStarted: 0,
            inProgress: 0,
            submitted: 0,
            disconnected: 0,
            violations: 0,
            expired: 0,
          },
          participants: [],
        },
      });
    }

    const monitoring = await ExamMonitoringService.getLiveMonitoring(schoolId, targetExamId);

    return NextResponse.json({
      success: true,
      data: {
        exams: examsRes.rows,
        ...monitoring,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat monitoring ujian.' }, { status: 500 });
  }
}
