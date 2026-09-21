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
    const classId = searchParams.get('classId');
    const roomId = searchParams.get('roomId');
    const sessionNumber = searchParams.get('sessionNumber');

    // 1. Find target exam
    let examSql = `
      SELECT e.*, sc.name as school_name, sc.logo_url as school_logo,
             sc.header_title_1, sc.header_title_2, sc.principal_name, sc.principal_nip, sc.address as school_address
      FROM exams e
      LEFT JOIN schools sc ON e.school_id = sc.id
      WHERE 1=1
    `;
    const examParams: any[] = [];

    if (tenant.schoolId) {
      examParams.push(tenant.schoolId);
      examSql += ` AND e.school_id = $${examParams.length}`;
    }

    if (examId) {
      examParams.push(examId);
      examSql += ` AND e.id = $${examParams.length}`;
    } else {
      examSql += ` ORDER BY (e.status = 'ACTIVE') DESC, e.created_at DESC LIMIT 1;`;
    }

    const examRes = await queryPostgres(examSql, examParams);

    if (examRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada jadwal ujian yang ditemukan.' },
        { status: 404 }
      );
    }
    const exam = examRes.rows[0];

    // 2. Query participants & students with room and seat data
    let cardsSql = `
      SELECT ep.id as participant_id, ep.token, ep.assigned_package,
             ep.session_number, ep.seat_number,
             s.id as student_id, s.full_name, s.nis, s.nisn, s.card_access_code,
             c.id as class_id, c.name as class_name, sub.name as subject_name,
             r.id as room_id, r.name as room_name, r.code as room_code
      FROM exam_participants ep
      JOIN students s ON ep.student_id = s.id
      LEFT JOIN class_rooms c ON s.class_room_id = c.id
      LEFT JOIN exam_rooms r ON ep.room_id = r.id
      JOIN exams e ON ep.exam_id = e.id
      JOIN subjects sub ON e.subject_id = sub.id
      WHERE ep.exam_id = $1
    `;
    const cardParams: any[] = [exam.id];

    if (classId) {
      cardParams.push(classId);
      cardsSql += ` AND s.class_room_id = $${cardParams.length}`;
    }

    if (roomId) {
      cardParams.push(roomId);
      cardsSql += ` AND ep.room_id = $${cardParams.length}`;
    }

    if (sessionNumber) {
      cardParams.push(parseInt(sessionNumber, 10));
      cardsSql += ` AND ep.session_number = $${cardParams.length}`;
    }

    cardsSql += ` ORDER BY ep.session_number ASC NULLS LAST, r.code ASC NULLS LAST, ep.seat_number ASC NULLS LAST, c.name ASC, s.full_name ASC;`;

    const cardsRes = await queryPostgres(cardsSql, cardParams);

    // 3. Fetch list of exams, classes, and rooms for filter toolbars
    let allExamsSql = `SELECT id, title, status FROM exams WHERE 1=1`;
    let allClassesSql = `SELECT id, name, level FROM class_rooms WHERE 1=1`;
    let allRoomsSql = `SELECT id, code, name, capacity FROM exam_rooms WHERE is_active = true`;
    const optParams: any[] = [];
    if (tenant.schoolId) {
      optParams.push(tenant.schoolId);
      allExamsSql += ` AND school_id = $1`;
      allClassesSql += ` AND school_id = $1`;
      allRoomsSql += ` AND school_id = $1`;
    }
    allExamsSql += ` ORDER BY created_at DESC;`;
    allClassesSql += ` ORDER BY name ASC;`;
    allRoomsSql += ` ORDER BY code ASC;`;

    const allExamsRes = await queryPostgres(allExamsSql, optParams);
    const allClassesRes = await queryPostgres(allClassesSql, optParams);
    const allRoomsRes = await queryPostgres(allRoomsSql, optParams);

    return NextResponse.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          date: exam.start_time
            ? new Date(exam.start_time).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
            : 'Sesuai Jadwal',
          schoolName: exam.school_name || 'SMA Negeri 1 Sagaya',
          schoolLogo: exam.school_logo || '',
          schoolAddress: exam.school_address || '',
          headerTitle1: exam.header_title_1 || '',
          headerTitle2: exam.header_title_2 || '',
          principalName: exam.principal_name || 'Kepala Sekolah',
          principalNip: exam.principal_nip || '-',
        },
        cards: cardsRes.rows.map((r: any) => ({
          id: r.student_id,
          name: r.full_name,
          nis: r.nis,
          nisn: r.nisn,
          classId: r.class_id,
          className: r.class_name || 'Kelas Terdaftar',
          cardCode: r.card_access_code,
          examTitle: exam.title,
          subject: r.subject_name,
          date: exam.start_time
            ? new Date(exam.start_time).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
            : 'Sesuai Jadwal',
          token: r.token,
          assignedPackage: r.assigned_package,
          roomId: r.room_id,
          roomName: r.room_name || 'Lab Utama',
          roomCode: r.room_code || 'LAB',
          sessionNumber: r.session_number || 1,
          seatNumber: r.seat_number || '01',
        })),
        availableExams: allExamsRes.rows,
        availableClasses: allClassesRes.rows,
        availableRooms: allRoomsRes.rows,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat kartu ujian massal.' },
      { status: 500 }
    );
  }
}
