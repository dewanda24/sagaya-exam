import { queryPostgres } from '../core/postgres';

export class SchoolReportService {
  /**
   * 1. Laporan Siswa
   */
  static async getStudentsReport(schoolId: string) {
    const res = await queryPostgres(
      `SELECT s.nis, s.nisn, s.full_name, s.gender, c.name as class_name, s.status, s.card_access_code, s.created_at
       FROM students s
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       WHERE s.school_id = $1
       ORDER BY c.name ASC, s.full_name ASC;`,
      [schoolId]
    );
    return res.rows;
  }

  /**
   * 2. Laporan Guru
   */
  static async getTeachersReport(schoolId: string) {
    const res = await queryPostgres(
      `SELECT u.username, u.full_name, u.nip, u.nuptk, u.phone, u.is_active, u.created_at,
              (SELECT STRING_AGG(sub.name, ', ') FROM teacher_subjects ts JOIN subjects sub ON ts.subject_id = sub.id WHERE ts.teacher_id = u.id) as subjects
       FROM users u
       WHERE u.school_id = $1 AND u.role = 'GURU'
       ORDER BY u.full_name ASC;`,
      [schoolId]
    );
    return res.rows;
  }

  /**
   * 3. Laporan Pengawas
   */
  static async getProctorsReport(schoolId: string) {
    const res = await queryPostgres(
      `SELECT u.username, u.full_name, u.nip, u.phone, u.is_active,
              (SELECT COUNT(*) FROM exam_room_proctors erp WHERE erp.proctor_id = u.id) as total_room_assignments
       FROM users u
       WHERE u.school_id = $1 AND u.role = 'PENGAWAS'
       ORDER BY u.full_name ASC;`,
      [schoolId]
    );
    return res.rows;
  }

  /**
   * 4. Laporan Ujian
   */
  static async getExamsReport(schoolId: string) {
    const res = await queryPostgres(
      `SELECT e.title, s.name as subject_name, e.status, e.start_time, e.end_time, e.duration_minutes,
              (SELECT COUNT(*) FROM exam_participants ep WHERE ep.exam_id = e.id) as participant_count,
              (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) as question_count
       FROM exams e
       JOIN subjects s ON e.subject_id = s.id
       WHERE e.school_id = $1
       ORDER BY e.start_time DESC;`,
      [schoolId]
    );
    return res.rows;
  }

  /**
   * 5. Laporan Nilai
   */
  static async getScoresReport(schoolId: string, examId?: string) {
    let sql = `
      SELECT e.title as exam_title, sub.name as subject_name,
             s.nisn, s.nis, s.full_name as student_name, c.name as class_name,
             ep.final_score, ep.graded_status
      FROM exam_participants ep
      JOIN exams e ON ep.exam_id = e.id
      JOIN subjects sub ON e.subject_id = sub.id
      JOIN students s ON ep.student_id = s.id
      LEFT JOIN class_rooms c ON s.class_room_id = c.id
      WHERE e.school_id = $1
    `;
    const params: any[] = [schoolId];

    if (examId) {
      params.push(examId);
      sql += ` AND ep.exam_id = $${params.length}`;
    }

    sql += ` ORDER BY e.title ASC, ep.final_score DESC NULLS LAST;`;

    const res = await queryPostgres(sql, params);
    return res.rows;
  }

  /**
   * 6. Laporan Kehadiran Ujian
   */
  static async getAttendanceReport(schoolId: string, examId?: string) {
    let sql = `
      SELECT e.title as exam_title, s.full_name as student_name, s.nisn, c.name as class_name,
             COALESCE(es.status, 'NOT_STARTED') as attendance_status,
             es.server_started_at, es.submitted_at, es.ip_address
      FROM exam_participants ep
      JOIN exams e ON ep.exam_id = e.id
      JOIN students s ON ep.student_id = s.id
      LEFT JOIN class_rooms c ON s.class_room_id = c.id
      LEFT JOIN exam_sessions es ON ep.id = es.participant_id
      WHERE e.school_id = $1
    `;
    const params: any[] = [schoolId];

    if (examId) {
      params.push(examId);
      sql += ` AND ep.exam_id = $${params.length}`;
    }

    sql += ` ORDER BY e.title ASC, s.full_name ASC;`;

    const res = await queryPostgres(sql, params);
    return res.rows;
  }

  /**
   * 7. Laporan Pelanggaran Ujian
   */
  static async getViolationsReport(schoolId: string, examId?: string) {
    let sql = `
      SELECT e.title as exam_title, s.full_name as student_name, s.nisn, c.name as class_name,
             es.tab_violation_count, es.last_heartbeat_at, es.device_fingerprint
      FROM exam_sessions es
      JOIN exam_participants ep ON es.participant_id = ep.id
      JOIN exams e ON ep.exam_id = e.id
      JOIN students s ON ep.student_id = s.id
      LEFT JOIN class_rooms c ON s.class_room_id = c.id
      WHERE e.school_id = $1 AND es.tab_violation_count > 0
    `;
    const params: any[] = [schoolId];

    if (examId) {
      params.push(examId);
      sql += ` AND ep.exam_id = $${params.length}`;
    }

    sql += ` ORDER BY es.tab_violation_count DESC;`;

    const res = await queryPostgres(sql, params);
    return res.rows;
  }

  /**
   * 8. Laporan Aktivitas Admin
   */
  static async getAdminActivityReport(schoolId: string) {
    const res = await queryPostgres(
      `SELECT al.created_at, al.action, al.role, al.resource_type, al.resource_id,
              u.full_name as actor_name, u.username as actor_username, al.ip_address, al.details_json
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.school_id = $1
       ORDER BY al.created_at DESC
       LIMIT 500;`,
      [schoolId]
    );
    return res.rows;
  }
}
