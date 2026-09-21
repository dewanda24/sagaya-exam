import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET() {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah (tenant) tidak valid.' },
        { status: 400 }
      );
    }

    const isMaster = auth.user.role === 'SUPER_ADMIN' || auth.user.role === 'ADMIN';

    const query = isMaster
      ? `SELECT DISTINCT e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes,
                sub.name as subject_name, sub.code as subject_code,
                COUNT(DISTINCT erp.room_id) as room_count
         FROM exams e
         LEFT JOIN subjects sub ON e.subject_id = sub.id
         LEFT JOIN exam_room_proctors erp ON e.id = erp.exam_id
         WHERE e.school_id = $1
         GROUP BY e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes, sub.name, sub.code
         ORDER BY e.start_time DESC;`
      : `SELECT DISTINCT e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes,
                sub.name as subject_name, sub.code as subject_code,
                COUNT(DISTINCT erp.room_id) as room_count
         FROM exam_room_proctors erp
         JOIN exams e ON erp.exam_id = e.id
         LEFT JOIN subjects sub ON e.subject_id = sub.id
         WHERE erp.proctor_id = $1 AND e.school_id = $2
         GROUP BY e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes, sub.name, sub.code
         ORDER BY e.start_time DESC;`;

    const params = isMaster ? [schoolId] : [auth.user.id, schoolId];
    const res = await queryPostgres(query, params);

    return NextResponse.json({
      success: true,
      data: res.rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        startTime: r.start_time,
        endTime: r.end_time,
        durationMinutes: r.duration_minutes,
        subjectName: r.subject_name || 'Umum',
        subjectCode: r.subject_code || '-',
        roomCount: parseInt(r.room_count || '0', 10),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat daftar ujian pengawas.' },
      { status: 500 }
    );
  }
}
