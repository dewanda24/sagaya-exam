import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamRoomService } from '@/lib/services/exam-room.service';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('proctors.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get('examId');

    let sql = `
      SELECT erp.*, r.name as room_name, r.code as room_code,
             u.full_name as proctor_name, u.nip as proctor_nip,
             e.title as exam_title
      FROM exam_room_proctors erp
      JOIN exam_rooms r ON erp.room_id = r.id
      JOIN users u ON erp.proctor_id = u.id
      JOIN exams e ON erp.exam_id = e.id
      WHERE r.school_id = $1
    `;
    const params: any[] = [schoolId];

    if (examId) {
      params.push(examId);
      sql += ` AND erp.exam_id = $${params.length}`;
    }

    sql += ` ORDER BY erp.session_number ASC, r.code ASC;`;

    const res = await queryPostgres(sql, params);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat penugasan pengawas.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('proctors.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { examId, roomId, sessionNumber, proctorId, notes } = body;

    if (!examId || !roomId || !sessionNumber || !proctorId) {
      return NextResponse.json(
        { success: false, error: 'examId, roomId, sessionNumber, dan proctorId wajib diisi.' },
        { status: 400 }
      );
    }

    await ExamRoomService.assignRoomProctor(
      schoolId,
      examId,
      roomId,
      parseInt(sessionNumber, 10),
      proctorId,
      notes,
      {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Pengawas berhasil ditugaskan ke ruang ujian (tanpa bentrok jadwal).',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menugaskan pengawas.' }, { status: 400 });
  }
}
