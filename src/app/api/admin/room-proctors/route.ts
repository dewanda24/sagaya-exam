import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken } from '@/lib/core/auth';
import { getTenantContext } from '@/lib/core/tenant';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenant = await getTenantContext(user, searchParams);
    const examId = searchParams.get('examId');

    if (!examId) {
      return NextResponse.json(
        { success: false, error: 'Parameter examId wajib disertakan.' },
        { status: 400 }
      );
    }

    // 1. Fetch assigned proctors for this exam
    const proctorsQuery = `
      SELECT 
        erp.id,
        erp.exam_id,
        erp.room_id,
        erp.session_number,
        erp.proctor_id,
        erp.notes,
        r.name as room_name,
        r.code as room_code,
        u.full_name as proctor_name,
        u.username as proctor_username
      FROM exam_room_proctors erp
      JOIN exam_rooms r ON erp.room_id = r.id
      JOIN users u ON erp.proctor_id = u.id
      WHERE erp.exam_id = $1
      ORDER BY erp.session_number ASC, r.code ASC;
    `;
    const proctorsRes = await queryPostgres(proctorsQuery, [examId]);

    // 2. Fetch available proctors/teachers in this school
    let availableUsersQuery = `
      SELECT id, full_name, username, role 
      FROM users 
      WHERE is_active = true AND role IN ('GURU', 'PENGAWAS')
    `;
    const userParams: any[] = [];
    if (tenant.schoolId) {
      userParams.push(tenant.schoolId);
      availableUsersQuery += ` AND school_id = $1`;
    }
    availableUsersQuery += ` ORDER BY full_name ASC;`;
    const availableUsersRes = await queryPostgres(availableUsersQuery, userParams);

    return NextResponse.json({
      success: true,
      data: {
        assignments: proctorsRes.rows.map((r: any) => ({
          id: r.id,
          examId: r.exam_id,
          roomId: r.room_id,
          roomName: r.room_name,
          roomCode: r.room_code,
          sessionNumber: r.session_number,
          proctorId: r.proctor_id,
          proctorName: r.proctor_name,
          proctorUsername: r.proctor_username,
          notes: r.notes || '-',
        })),
        availableProctors: availableUsersRes.rows,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat plotting pengawas.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { examId, roomId, sessionNumber = 1, proctorId, notes } = body;

    if (!examId || !roomId || !proctorId) {
      return NextResponse.json(
        { success: false, error: 'ID Ujian, Ruangan, dan Pengawas wajib diisi.' },
        { status: 400 }
      );
    }

    const upsertRes = await queryPostgres(
      `INSERT INTO exam_room_proctors (exam_id, room_id, session_number, proctor_id, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (exam_id, room_id, session_number) 
       DO UPDATE SET proctor_id = EXCLUDED.proctor_id, notes = EXCLUDED.notes
       RETURNING *;`,
      [examId, roomId, parseInt(sessionNumber, 10) || 1, proctorId, notes || '-']
    );

    return NextResponse.json({
      success: true,
      message: 'Penugasan pengawas ruang berhasil disimpan.',
      data: upsertRes.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyimpan penugasan pengawas.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID penugasan wajib diisi.' },
        { status: 400 }
      );
    }

    await queryPostgres(`DELETE FROM exam_room_proctors WHERE id = $1;`, [id]);

    return NextResponse.json({
      success: true,
      message: 'Penugasan pengawas ruang berhasil dihapus.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus penugasan pengawas.' },
      { status: 500 }
    );
  }
}
