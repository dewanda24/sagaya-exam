import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';
import { ProctorAuthorizationService } from '@/lib/services/proctor-authorization.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const { examId } = await params;
    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak valid.' },
        { status: 400 }
      );
    }

    // Otorisasi hak akses ujian
    const accessCheck = await ProctorAuthorizationService.canAccessExam(auth.user, examId, schoolId);
    if (!accessCheck.allowed) {
      return NextResponse.json(
        { success: false, error: accessCheck.reason || 'Akses ditolak: Anda tidak ditugaskan pada ujian ini.' },
        { status: 403 }
      );
    }

    // Ambil info ujian
    const examRes = await queryPostgres(
      `SELECT e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes,
              sub.name as subject_name, sub.code as subject_code
       FROM exams e
       LEFT JOIN subjects sub ON e.subject_id = sub.id
       WHERE e.id = $1 AND e.school_id = $2
       LIMIT 1;`,
      [examId, schoolId]
    );

    if (examRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ujian tidak ditemukan.' },
        { status: 404 }
      );
    }

    const exam = examRes.rows[0];
    const isMaster = auth.user.role === 'SUPER_ADMIN' || auth.user.role === 'ADMIN';

    // Ambil ruang-ruang yang ditugaskan kepada pengawas ini untuk ujian ini
    const roomsQuery = isMaster
      ? `SELECT er.id, er.code, er.name, er.capacity, erp.session_number,
                COUNT(ep.id) as participant_count
         FROM exam_rooms er
         LEFT JOIN exam_room_proctors erp ON er.id = erp.room_id AND erp.exam_id = $1
         LEFT JOIN exam_participants ep ON ep.exam_id = $1 AND ep.room_id = er.id
         WHERE er.school_id = $2
         GROUP BY er.id, er.code, er.name, er.capacity, erp.session_number
         ORDER BY er.code ASC;`
      : `SELECT er.id, er.code, er.name, er.capacity, erp.session_number,
                COUNT(ep.id) as participant_count
         FROM exam_room_proctors erp
         JOIN exam_rooms er ON erp.room_id = er.id
         LEFT JOIN exam_participants ep ON ep.exam_id = erp.exam_id AND ep.room_id = er.id AND ep.session_number = erp.session_number
         WHERE erp.proctor_id = $1 AND erp.exam_id = $2 AND er.school_id = $3
         GROUP BY er.id, er.code, er.name, er.capacity, erp.session_number
         ORDER BY er.code ASC;`;

    const roomsParams = isMaster ? [examId, schoolId] : [auth.user.id, examId, schoolId];
    const roomsRes = await queryPostgres(roomsQuery, roomsParams);

    // Ambil daftar rekan pengawas yang ditugaskan pada ujian ini
    const proctorsRes = await queryPostgres(
      `SELECT erp.room_id, u.id as proctor_id, u.name as proctor_name, u.username as proctor_username
       FROM exam_room_proctors erp
       JOIN users u ON erp.proctor_id = u.id
       WHERE erp.exam_id = $1;`,
      [examId]
    );

    const proctorsByRoom: Record<string, any[]> = {};
    for (const p of proctorsRes.rows) {
      if (!proctorsByRoom[p.room_id]) proctorsByRoom[p.room_id] = [];
      proctorsByRoom[p.room_id].push({
        id: p.proctor_id,
        name: p.proctor_name || p.proctor_username,
        username: p.proctor_username,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          status: exam.status,
          startTime: exam.start_time,
          endTime: exam.end_time,
          durationMinutes: exam.duration_minutes,
          subjectName: exam.subject_name || 'Umum',
          subjectCode: exam.subject_code || '-',
        },
        assignedRooms: roomsRes.rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          capacity: r.capacity,
          sessionNumber: r.session_number || 1,
          participantCount: parseInt(r.participant_count || '0', 10),
          proctors: proctorsByRoom[r.id] || [],
        })),
        allProctors: proctorsRes.rows.map((p) => ({
          id: p.proctor_id,
          name: p.proctor_name || p.proctor_username,
          username: p.proctor_username,
          roomId: p.room_id,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat detail ujian pengawas.' },
      { status: 500 }
    );
  }
}
