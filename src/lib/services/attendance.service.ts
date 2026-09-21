import { queryPostgres } from '../core/postgres';
import { ProctorAuthorizationService } from './proctor-authorization.service';
import { SessionUser } from '../core/auth';
import { hasUserPermission } from '../core/permissions';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export class AttendanceService {
  /**
   * Mengambil daftar presensi peserta pada ruang ujian tertentu.
   */
  static async getAttendanceList(
    user: SessionUser,
    schoolId: string,
    examId: string,
    roomId: string
  ) {
    // 1. Otorisasi akses ruang
    const authCheck = await ProctorAuthorizationService.canAccessRoom(user, examId, roomId, schoolId);
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Akses ditolak: Anda tidak memiliki penugasan pada ruang ini.');
    }

    // 2. Query data peserta dan presensi
    const res = await queryPostgres(
      `SELECT ep.id as participant_id, ep.seat_number, ep.session_number,
              s.id as student_id, s.full_name as student_name, s.nis, s.nisn,
              c.name as class_name,
              COALESCE(ar.status, 'PRESENT') as attendance_status,
              ar.notes as attendance_notes,
              ar.marked_at,
              u.full_name as marked_by_name,
              es.status as session_status
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       LEFT JOIN attendance_records ar ON ep.id = ar.participant_id AND ar.exam_id = ep.exam_id
       LEFT JOIN users u ON ar.marked_by = u.id
       LEFT JOIN exam_sessions es ON ep.id = es.participant_id
       WHERE ep.exam_id = $1 AND ep.room_id = $2
       ORDER BY ep.session_number ASC, ep.seat_number ASC, s.full_name ASC;`,
      [examId, roomId]
    );

    return res.rows.map((r, idx) => ({
      no: idx + 1,
      participantId: r.participant_id,
      studentId: r.student_id,
      studentName: r.student_name,
      nis: r.nis,
      nisn: r.nisn,
      className: r.class_name || '-',
      seatNumber: r.seat_number || '-',
      sessionNumber: r.session_number || 1,
      attendanceStatus: r.attendance_status as AttendanceStatus,
      attendanceNotes: r.attendance_notes,
      markedAt: r.marked_at,
      markedByName: r.marked_by_name,
      sessionStatus: r.session_status || 'NOT_STARTED',
    }));
  }

  /**
   * Memperbarui status presensi seorang peserta dalam ruang ujian yang diawasi.
   */
  static async updateAttendance(
    user: SessionUser,
    schoolId: string,
    examId: string,
    roomId: string,
    participantId: string,
    status: AttendanceStatus,
    notes?: string
  ) {
    // 1. Validasi permission pengawas
    if (!hasUserPermission(user, 'proctor.attendance.update')) {
      throw new Error('Akses ditolak: Akun Anda tidak memiliki izin memperbarui presensi peserta.');
    }

    // 2. Validasi IDOR kepemilikan peserta pada ruang ujian
    const authCheck = await ProctorAuthorizationService.canAccessParticipant(
      user,
      examId,
      roomId,
      participantId,
      schoolId
    );
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Akses ditolak: Peserta tidak berada pada ruang ujian yang Anda awasi.');
    }

    // 3. Simpan perubahan presensi ke tabel attendance_records (UPSERT)
    const upsertRes = await queryPostgres(
      `INSERT INTO attendance_records (school_id, exam_id, room_id, participant_id, status, marked_by, notes, marked_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (exam_id, participant_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         marked_by = EXCLUDED.marked_by,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING id, participant_id, status, notes, updated_at;`,
      [schoolId, examId, roomId, participantId, status, user.id, notes || null]
    );

    const record = upsertRes.rows[0];

    // 4. Audit log immutable
    await queryPostgres(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, $3, 'ATTENDANCE_UPDATED', $4);`,
      [
        schoolId,
        user.id,
        user.role,
        JSON.stringify({
          examId,
          roomId,
          participantId,
          newStatus: status,
          notes: notes || null,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    return record;
  }
}
