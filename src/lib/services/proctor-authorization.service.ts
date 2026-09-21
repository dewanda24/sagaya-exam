import { queryPostgres } from '../core/postgres';
import { SessionUser } from '../core/auth';
import { hasUserPermission } from '../core/permissions';

export class ProctorAuthorizationService {
  /**
   * Memeriksa apakah Pengawas secara eksplisit ditugaskan pada ujian dan ruang tertentu.
   */
  static async isProctorAssignedToRoom(
    proctorId: string,
    examId: string,
    roomId: string,
    schoolId: string
  ): Promise<boolean> {
    const res = await queryPostgres(
      `SELECT 1 
       FROM exam_room_proctors erp
       JOIN exams e ON erp.exam_id = e.id
       WHERE erp.proctor_id = $1 
         AND erp.exam_id = $2 
         AND erp.room_id = $3
         AND e.school_id = $4
       LIMIT 1;`,
      [proctorId, examId, roomId, schoolId]
    );
    return res.rows.length > 0;
  }

  /**
   * Memeriksa apakah Pengawas memiliki setidaknya satu penugasan ruang pada ujian tertentu.
   */
  static async isProctorAssignedToExam(
    proctorId: string,
    examId: string,
    schoolId: string
  ): Promise<boolean> {
    const res = await queryPostgres(
      `SELECT 1 
       FROM exam_room_proctors erp
       JOIN exams e ON erp.exam_id = e.id
       WHERE erp.proctor_id = $1 
         AND erp.exam_id = $2 
         AND e.school_id = $3
       LIMIT 1;`,
      [proctorId, examId, schoolId]
    );
    return res.rows.length > 0;
  }

  /**
   * Memverifikasi hak akses Pengawas untuk membaca detail dan jadwal ujian.
   */
  static async canAccessExam(
    user: SessionUser,
    examId: string,
    schoolId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (user.role === 'SUPER_ADMIN') return { allowed: true };

    if (user.schoolId !== schoolId) {
      return { allowed: false, reason: 'Ujian ini berada di sekolah yang berbeda dari tenant Anda.' };
    }

    if (user.role === 'ADMIN') {
      return { allowed: true };
    }

    if (user.role !== 'PENGAWAS') {
      return { allowed: false, reason: 'Hanya Pengawas atau Administrator yang memiliki izin ini.' };
    }

    if (!hasUserPermission(user, 'proctor.exam.read')) {
      return { allowed: false, reason: 'Akun Anda tidak memiliki hak akses membaca ujian.' };
    }

    const assigned = await this.isProctorAssignedToExam(user.id, examId, schoolId);
    if (!assigned) {
      return { allowed: false, reason: 'Anda tidak ditugaskan sebagai pengawas pada ujian ini.' };
    }

    return { allowed: true };
  }

  /**
   * Memverifikasi hak akses Pengawas untuk memantau ruang ujian tertentu.
   */
  static async canAccessRoom(
    user: SessionUser,
    examId: string,
    roomId: string,
    schoolId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (user.role === 'SUPER_ADMIN') return { allowed: true };

    if (user.schoolId !== schoolId) {
      return { allowed: false, reason: 'Ruang ujian ini berada di sekolah yang berbeda dari tenant Anda.' };
    }

    if (user.role === 'ADMIN') {
      return { allowed: true };
    }

    if (user.role !== 'PENGAWAS') {
      return { allowed: false, reason: 'Hanya Pengawas atau Administrator yang memiliki izin pengawasan ruang.' };
    }

    if (!hasUserPermission(user, 'proctor.room.read')) {
      return { allowed: false, reason: 'Akun Anda tidak memiliki hak akses membaca ruang ujian.' };
    }

    const assigned = await this.isProctorAssignedToRoom(user.id, examId, roomId, schoolId);
    if (!assigned) {
      return { allowed: false, reason: 'Anda tidak ditugaskan untuk mengawasi ruang ujian ini.' };
    }

    return { allowed: true };
  }

  /**
   * Memverifikasi apakah peserta tertentu berada di ruang dan ujian yang sah diawasi oleh pengawas.
   */
  static async canAccessParticipant(
    user: SessionUser,
    examId: string,
    roomId: string,
    participantId: string,
    schoolId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const roomCheck = await this.canAccessRoom(user, examId, roomId, schoolId);
    if (!roomCheck.allowed) return roomCheck;

    const res = await queryPostgres(
      `SELECT ep.id, ep.room_id, ep.exam_id, s.school_id
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       WHERE ep.id = $1 AND ep.exam_id = $2 AND ep.room_id = $3 AND s.school_id = $4
       LIMIT 1;`,
      [participantId, examId, roomId, schoolId]
    );

    if (res.rows.length === 0) {
      return {
        allowed: false,
        reason: 'Peserta tidak terdaftar pada ruang ujian yang Anda awasi.',
      };
    }

    return { allowed: true };
  }

  /**
   * Mendeteksi konflik jadwal pengawas:
   * Memastikan seorang pengawas tidak dijadwalkan pada 2 ruang atau 2 ujian berbeda pada rentang waktu yang tumpang-tindih.
   */
  static async checkRoomScheduleConflict(
    proctorId: string,
    examId: string,
    roomId: string,
    sessionNumber: number = 1
  ): Promise<{ hasConflict: boolean; details?: string }> {
    // Ambil start_time dan end_time dari ujian target
    const targetExamRes = await queryPostgres(
      `SELECT title, start_time, end_time FROM exams WHERE id = $1 LIMIT 1;`,
      [examId]
    );

    if (targetExamRes.rows.length === 0) {
      return { hasConflict: false };
    }

    const targetExam = targetExamRes.rows[0];

    // Cari penugasan lain dari proctor ini pada waktu yang bertabrakan
    const conflictRes = await queryPostgres(
      `SELECT erp.id, e.title as conflict_exam_title, er.name as conflict_room_name,
              e.start_time, e.end_time, erp.session_number
       FROM exam_room_proctors erp
       JOIN exams e ON erp.exam_id = e.id
       JOIN exam_rooms er ON erp.room_id = er.id
       WHERE erp.proctor_id = $1
         AND (erp.exam_id != $2 OR erp.room_id != $3 OR erp.session_number != $4)
         AND e.status NOT IN ('COMPLETED', 'ARCHIVED')
         AND (
           (e.start_time, e.end_time) OVERLAPS ($5::timestamptz, $6::timestamptz)
         )
       LIMIT 1;`,
      [
        proctorId,
        examId,
        roomId,
        sessionNumber,
        targetExam.start_time,
        targetExam.end_time,
      ]
    );

    if (conflictRes.rows.length > 0) {
      const c = conflictRes.rows[0];
      return {
        hasConflict: true,
        details: `Pengawas telah ditugaskan pada ujian '${c.conflict_exam_title}' di ruang '${c.conflict_room_name}' (Sesi ${c.session_number}) pada jam yang bertabrakan.`,
      };
    }

    return { hasConflict: false };
  }
}
