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
    const examId = searchParams.get('examId') || '';
    const roomId = searchParams.get('roomId') || '';
    const sessionNumber = searchParams.get('sessionNumber') || '';

    // 1. Fetch available exams for the school
    let examsQuery = `
      SELECT id, title, start_time, end_time, status 
      FROM exams 
      WHERE 1=1
    `;
    const examParams: any[] = [];
    if (tenant.schoolId) {
      examParams.push(tenant.schoolId);
      examsQuery += ` AND school_id = $${examParams.length}`;
    }
    examsQuery += ` ORDER BY created_at DESC;`;
    const examsRes = await queryPostgres(examsQuery, examParams);

    // 2. Fetch available rooms for the school
    let roomsQuery = `SELECT id, code, name, capacity FROM exam_rooms WHERE is_active = true`;
    const roomParams: any[] = [];
    if (tenant.schoolId) {
      roomParams.push(tenant.schoolId);
      roomsQuery += ` AND school_id = $${roomParams.length}`;
    }
    roomsQuery += ` ORDER BY code ASC;`;
    const roomsRes = await queryPostgres(roomsQuery, roomParams);

    const targetExamId = examId || (examsRes.rows[0]?.id ?? '');

    if (!targetExamId) {
      return NextResponse.json({
        success: true,
        data: {
          participants: [],
          stats: { total: 0, allocated: 0, unallocated: 0 },
          exams: examsRes.rows,
          rooms: roomsRes.rows,
          selectedExam: null,
        },
      });
    }

    // 3. Fetch participants for the target exam
    let partQuery = `
      SELECT 
        ep.id,
        ep.exam_id,
        ep.student_id,
        ep.token,
        ep.assigned_package,
        ep.room_id,
        ep.session_number,
        ep.seat_number,
        s.full_name as student_name,
        s.nisn,
        s.nis,
        c.name as class_name,
        r.name as room_name,
        r.code as room_code
      FROM exam_participants ep
      JOIN students s ON ep.student_id = s.id
      LEFT JOIN class_rooms c ON s.class_room_id = c.id
      LEFT JOIN exam_rooms r ON ep.room_id = r.id
      WHERE ep.exam_id = $1
    `;
    const partParams: any[] = [targetExamId];

    if (roomId) {
      partParams.push(roomId);
      partQuery += ` AND ep.room_id = $${partParams.length}`;
    }

    if (sessionNumber) {
      partParams.push(parseInt(sessionNumber, 10));
      partQuery += ` AND ep.session_number = $${partParams.length}`;
    }

    partQuery += ` ORDER BY ep.session_number ASC NULLS LAST, r.code ASC NULLS LAST, ep.seat_number ASC NULLS LAST, c.name ASC, s.full_name ASC;`;

    const partRes = await queryPostgres(partQuery, partParams);

    // Global stats for this exam without room/session filter
    const statsRes = await queryPostgres(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN room_id IS NOT NULL THEN 1 END) as allocated,
        COUNT(CASE WHEN room_id IS NULL THEN 1 END) as unallocated
       FROM exam_participants 
       WHERE exam_id = $1;`,
      [targetExamId]
    );

    const selectedExam = examsRes.rows.find((e: any) => e.id === targetExamId);

    return NextResponse.json({
      success: true,
      data: {
        participants: partRes.rows.map((r: any) => ({
          id: r.id,
          examId: r.exam_id,
          studentId: r.student_id,
          studentName: r.student_name,
          nisn: r.nisn,
          nis: r.nis,
          className: r.class_name || '-',
          token: r.token,
          assignedPackage: r.assigned_package,
          roomId: r.room_id,
          roomName: r.room_name || 'Belum Diatur',
          roomCode: r.room_code || '-',
          sessionNumber: r.session_number || 1,
          seatNumber: r.seat_number || '-',
        })),
        stats: {
          total: parseInt(statsRes.rows[0]?.total || '0', 10),
          allocated: parseInt(statsRes.rows[0]?.allocated || '0', 10),
          unallocated: parseInt(statsRes.rows[0]?.unallocated || '0', 10),
        },
        exams: examsRes.rows,
        rooms: roomsRes.rows,
        selectedExam,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat alokasi ruang ujian.' },
      { status: 500 }
    );
  }
}

// Auto-Distribute Participants Algorithm
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      examId,
      roomIds = [],
      sessionCount = 1,
      resetPrevious = true,
    } = body;

    if (!examId) {
      return NextResponse.json({ success: false, error: 'ID Ujian wajib disertakan.' }, { status: 400 });
    }

    if (!roomIds || roomIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pilih minimal satu ruang ujian/lab komputer untuk distribusi.' },
        { status: 400 }
      );
    }

    const sessions = Math.max(1, parseInt(sessionCount, 10) || 1);

    // 1. Fetch rooms ordered by code
    const roomsRes = await queryPostgres(
      `SELECT id, code, name, capacity FROM exam_rooms WHERE id = ANY($1::uuid[]) ORDER BY code ASC;`,
      [roomIds]
    );

    if (roomsRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ruangan yang dipilih tidak ditemukan.' },
        { status: 400 }
      );
    }

    const selectedRooms = roomsRes.rows;
    const totalCapacityPerSession = selectedRooms.reduce(
      (acc: number, r: any) => acc + parseInt(r.capacity, 10),
      0
    );
    const maxCapacity = totalCapacityPerSession * sessions;

    // 2. Fetch all participants for the exam ordered by class and name
    const partRes = await queryPostgres(
      `SELECT ep.id, s.full_name, c.name as class_name
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       WHERE ep.exam_id = $1
       ORDER BY c.name ASC, s.full_name ASC;`,
      [examId]
    );

    const participants = partRes.rows;

    if (participants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada peserta pada ujian ini untuk dialokasikan.' },
        { status: 400 }
      );
    }

    if (participants.length > maxCapacity) {
      return NextResponse.json(
        {
          success: false,
          error: `Kapasitas tidak mencukupi! Total peserta (${participants.length}) melebihi total kapasitas ${selectedRooms.length} ruang x ${sessions} sesi (${maxCapacity} kursi). Silakan tambah ruang ujian atau tambah jumlah sesi.`,
        },
        { status: 400 }
      );
    }

    // 3. Execution Algorithm: Fill sequentially across Sessions -> Rooms -> Seats
    let currentParticipantIndex = 0;

    await queryPostgres('BEGIN;');

    for (let s = 1; s <= sessions; s++) {
      for (const room of selectedRooms) {
        const roomCap = parseInt(room.capacity, 10);
        for (let seat = 1; seat <= roomCap; seat++) {
          if (currentParticipantIndex >= participants.length) break;

          const partId = participants[currentParticipantIndex].id;
          const seatStr = String(seat).padStart(2, '0');

          await queryPostgres(
            `UPDATE exam_participants 
             SET room_id = $1, session_number = $2, seat_number = $3 
             WHERE id = $4;`,
            [room.id, s, seatStr, partId]
          );

          currentParticipantIndex++;
        }
        if (currentParticipantIndex >= participants.length) break;
      }
      if (currentParticipantIndex >= participants.length) break;
    }

    await queryPostgres('COMMIT;');

    return NextResponse.json({
      success: true,
      message: `Berhasil mengalokasikan ${currentParticipantIndex} peserta ke dalam ${selectedRooms.length} ruang dan ${sessions} sesi.`,
      data: {
        allocatedCount: currentParticipantIndex,
        totalParticipants: participants.length,
        roomsCount: selectedRooms.length,
        sessionsCount: sessions,
      },
    });
  } catch (error: any) {
    await queryPostgres('ROLLBACK;').catch(() => {});
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menjalankan auto-distribusi peserta.' },
      { status: 500 }
    );
  }
}

// Manual Update for Single Participant
export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { participantId, roomId, sessionNumber, seatNumber } = body;

    if (!participantId) {
      return NextResponse.json(
        { success: false, error: 'ID peserta wajib disertakan.' },
        { status: 400 }
      );
    }

    await queryPostgres(
      `UPDATE exam_participants 
       SET room_id = COALESCE($1, room_id),
           session_number = COALESCE($2, session_number),
           seat_number = COALESCE($3, seat_number)
       WHERE id = $4;`,
      [
        roomId || null,
        sessionNumber ? parseInt(sessionNumber, 10) : undefined,
        seatNumber ? String(seatNumber).padStart(2, '0') : undefined,
        participantId,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Alokasi peserta berhasil diperbarui.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui alokasi peserta.' },
      { status: 500 }
    );
  }
}
