import { queryPostgres } from '../core/postgres';
import { ProctorAuthorizationService } from './proctor-authorization.service';
import { SessionUser } from '../core/auth';

export type ViolationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export class ViolationService {
  /**
   * Mencatat kejadian / event pelanggaran peserta pada sesi ujian.
   */
  static async recordViolation(
    schoolId: string,
    examId: string,
    roomId: string | null,
    participantId: string,
    sessionId: string | null,
    eventType: string,
    severity: ViolationSeverity = 'INFO',
    description?: string,
    metadata?: any
  ) {
    const res = await queryPostgres(
      `INSERT INTO exam_violations (school_id, exam_id, room_id, participant_id, session_id, event_type, severity, description, metadata_json, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id, event_type, severity, description, created_at;`,
      [
        schoolId,
        examId,
        roomId,
        participantId,
        sessionId,
        eventType,
        severity,
        description || null,
        JSON.stringify(metadata || {}),
      ]
    );

    // Update counter pada exam_sessions jika eventnya TAB_SWITCH atau serupa
    if (sessionId && eventType === 'TAB_SWITCH') {
      await queryPostgres(
        `UPDATE exam_sessions SET tab_violation_count = tab_violation_count + 1 WHERE id = $1;`,
        [sessionId]
      );
    }

    return res.rows[0];
  }

  /**
   * Mengambil daftar pelanggaran pada ruang ujian yang diawasi oleh pengawas.
   */
  static async getRoomViolations(
    user: SessionUser,
    schoolId: string,
    examId: string,
    roomId: string
  ) {
    const authCheck = await ProctorAuthorizationService.canAccessRoom(user, examId, roomId, schoolId);
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Akses ditolak: Anda tidak memiliki penugasan pada ruang ini.');
    }

    const res = await queryPostgres(
      `SELECT ev.id, ev.event_type, ev.severity, ev.description, ev.metadata_json, ev.created_at,
              ep.id as participant_id, ep.seat_number, ep.session_number,
              s.full_name as student_name, s.nis, s.nisn,
              c.name as class_name
       FROM exam_violations ev
       JOIN exam_participants ep ON ev.participant_id = ep.id
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       WHERE ev.exam_id = $1 AND ev.room_id = $2
       ORDER BY ev.created_at DESC;`,
      [examId, roomId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      severity: r.severity,
      description: r.description,
      metadata: r.metadata_json,
      createdAt: r.created_at,
      participant: {
        id: r.participant_id,
        name: r.student_name,
        nis: r.nis,
        nisn: r.nisn,
        className: r.class_name || '-',
        seatNumber: r.seat_number || '-',
        sessionNumber: r.session_number || 1,
      },
    }));
  }
}
