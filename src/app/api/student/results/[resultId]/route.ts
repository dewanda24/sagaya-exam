import { NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/core/postgres';
import { cookies } from 'next/headers';
import { validateServerSession } from '@/lib/core/auth';
import { ExamResultService } from '@/lib/services/exam-result.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ resultId: string }> }
) {
  try {
    const { resultId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;

    let studentId: string | null = null;
    let schoolId: string | null = null;

    if (token) {
      const sessionUser = await validateServerSession(token);
      if (sessionUser) {
        schoolId = sessionUser.schoolId || null;
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

    if (!studentId || !schoolId) {
      return NextResponse.json(
        { success: false, error: 'Sesi siswa tidak terdeteksi. Silakan login kembali.' },
        { status: 401 }
      );
    }

    const data = await ExamResultService.getStudentPublishedResult(resultId, {
      studentId,
      schoolId,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    const isForbidden = error.message?.includes('Akses ditolak') || error.message?.includes('belum dipublikasikan');
    const isNotFound = error.message?.includes('tidak ditemukan');
    const status = isForbidden ? 403 : isNotFound ? 404 : 500;

    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat rincian hasil ujian.' },
      { status }
    );
  }
}
