import { queryPostgres } from '../core/postgres';
import { ProctorAuthorizationService } from './proctor-authorization.service';
import { SessionUser } from '../core/auth';
import { hasUserPermission } from '../core/permissions';

export class ProctorSessionControlService {
  /**
   * Melakukan Force Logout / Revoke Session siswa yang bermasalah.
   */
  static async revokeStudentSession(
    user: SessionUser,
    schoolId: string,
    examId: string,
    roomId: string,
    participantId: string,
    reason: string
  ) {
    // 1. Verifikasi permission proctor.session.revoke
    if (!hasUserPermission(user, 'proctor.session.revoke')) {
      throw new Error('Akses ditolak: Akun Anda tidak memiliki izin mencabut sesi siswa.');
    }

    if (!reason || !reason.trim()) {
      throw new Error('Alasan pencabutan sesi wajib diisi.');
    }

    // 2. IDOR check: Verifikasi penugasan pengawas pada ruang dan peserta
    const authCheck = await ProctorAuthorizationService.canAccessParticipant(
      user,
      examId,
      roomId,
      participantId,
      schoolId
    );
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Akses ditolak: Peserta tidak berada pada ruang pengawasan Anda.');
    }

    // 3. Putus sesi peserta pada database (ubah status menjadi DISCONNECTED dan reset device binding jika diperlukan)
    const updateRes = await queryPostgres(
      `UPDATE exam_sessions
       SET status = 'DISCONNECTED',
           device_fingerprint = 'REVOKED_BY_PROCTOR',
           last_heartbeat_at = NOW()
       WHERE participant_id = $1
       RETURNING id, status;`,
      [participantId]
    );

    // Catat pelanggaran / event pemutusan
    await queryPostgres(
      `INSERT INTO exam_violations (school_id, exam_id, room_id, participant_id, event_type, severity, description)
       VALUES ($1, $2, $3, $4, 'FORCED_TERMINATION', 'WARNING', $5);`,
      [schoolId, examId, roomId, participantId, `Sesi dicabut oleh pengawas. Alasan: ${reason.trim()}`]
    );

    // 4. Audit log immutable
    await queryPostgres(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, $3, 'STUDENT_SESSION_REVOKED', $4);`,
      [
        schoolId,
        user.id,
        user.role,
        JSON.stringify({
          examId,
          roomId,
          participantId,
          reason: reason.trim(),
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    return {
      success: true,
      participantId,
      sessionStatus: 'DISCONNECTED',
      message: 'Sesi siswa berhasil dicabut.',
    };
  }

  /**
   * Mengakhiri sesi siswa secara permanen (LOCKED/EXPIRED).
   * Penting: Tindakan ini BERBEDA dengan submit jawaban otomatis (SUBMITTED).
   */
  static async endStudentSession(
    user: SessionUser,
    schoolId: string,
    examId: string,
    roomId: string,
    participantId: string,
    reason: string
  ) {
    if (!hasUserPermission(user, 'proctor.session.revoke')) {
      throw new Error('Akses ditolak: Akun Anda tidak memiliki izin mengakhiri sesi siswa.');
    }

    if (!reason || !reason.trim()) {
      throw new Error('Alasan pengakhiran sesi siswa wajib diisi.');
    }

    const authCheck = await ProctorAuthorizationService.canAccessParticipant(
      user,
      examId,
      roomId,
      participantId,
      schoolId
    );
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Akses ditolak: Peserta tidak berada pada ruang pengawasan Anda.');
    }

    // Kunci sesi siswa
    const updateRes = await queryPostgres(
      `UPDATE exam_sessions
       SET status = 'LOCKED',
           last_heartbeat_at = NOW()
       WHERE participant_id = $1
       RETURNING id, status;`,
      [participantId]
    );

    // Audit log
    await queryPostgres(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, $3, 'STUDENT_SESSION_ENDED', $4);`,
      [
        schoolId,
        user.id,
        user.role,
        JSON.stringify({
          examId,
          roomId,
          participantId,
          reason: reason.trim(),
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    return {
      success: true,
      participantId,
      sessionStatus: 'LOCKED',
      message: 'Akses pengerjaan peserta telah berhasil dihentikan (LOCKED).',
    };
  }

  /**
   * Permohonan & Eksekusi Perpanjangan Waktu Darurat (Emergency Time Extension).
   */
  static async requestEmergencyExtension(
    user: SessionUser,
    schoolId: string,
    examId: string,
    roomId: string,
    durationMinutes: number,
    reason: string
  ) {
    // 1. Validasi permission
    if (!hasUserPermission(user, 'proctor.emergency.request')) {
      throw new Error('Akses ditolak: Akun Anda tidak memiliki hak akses tindakan darurat perpanjangan waktu.');
    }

    if (!durationMinutes || durationMinutes < 1 || durationMinutes > 60) {
      throw new Error('Durasi perpanjangan darurat harus antara 1 sampai 60 menit.');
    }

    if (!reason || !reason.trim()) {
      throw new Error('Alasan tindakan perpanjangan darurat wajib diisi secara rinci.');
    }

    // 2. Validasi penugasan pengawas pada ruang
    const authCheck = await ProctorAuthorizationService.canAccessRoom(user, examId, roomId, schoolId);
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Akses ditolak: Anda tidak ditugaskan pada ruang ini.');
    }

    // 3. Perpanjang waktu sesi aktif peserta di ruang tersebut
    const extInterval = `${durationMinutes} minutes`;
    const updateSessionsRes = await queryPostgres(
      `UPDATE exam_sessions es
       SET server_expires_at = server_expires_at + ($1::interval)
       FROM exam_participants ep
       WHERE es.participant_id = ep.id
         AND ep.exam_id = $2
         AND ep.room_id = $3
         AND es.status = 'IN_PROGRESS'
       RETURNING es.id;`,
      [extInterval, examId, roomId]
    );

    const affectedSessionsCount = updateSessionsRes.rows.length;

    // 4. Audit log immutable
    await queryPostgres(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, $3, 'EMERGENCY_ACTION_REQUESTED', $4);`,
      [
        schoolId,
        user.id,
        user.role,
        JSON.stringify({
          examId,
          roomId,
          durationMinutes,
          reason: reason.trim(),
          affectedSessionsCount,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    return {
      success: true,
      durationMinutes,
      affectedSessionsCount,
      message: `Waktu pengerjaan untuk ${affectedSessionsCount} peserta aktif di ruang ini berhasil diperpanjang sebanyak ${durationMinutes} menit.`,
    };
  }
}
