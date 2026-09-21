import { queryPostgres, withTransaction } from '../core/postgres';
import { AuditService } from './audit.service';

export class ExamParticipantService {
  /**
   * Mengambil daftar peserta untuk ujian tertentu.
   */
  static async listParticipants(
    schoolId: string,
    examId: string,
    filters?: { classId?: string; roomId?: string; search?: string }
  ) {
    let sql = `
      SELECT ep.*, 
             s.full_name as student_name, s.nisn, s.nis, s.gender,
             c.name as class_room_name,
             r.name as room_name, r.code as room_code,
             es.status as session_status, es.last_heartbeat_at, es.tab_violation_count
      FROM exam_participants ep
      JOIN students s ON ep.student_id = s.id
      JOIN exams e ON ep.exam_id = e.id
      LEFT JOIN class_rooms c ON s.class_room_id = c.id
      LEFT JOIN exam_rooms r ON ep.room_id = r.id
      LEFT JOIN exam_sessions es ON ep.id = es.participant_id
      WHERE ep.exam_id = $1 AND e.school_id = $2
    `;
    const params: any[] = [examId, schoolId];

    if (filters?.classId) {
      params.push(filters.classId);
      sql += ` AND s.class_room_id = $${params.length}`;
    }

    if (filters?.roomId) {
      params.push(filters.roomId);
      sql += ` AND ep.room_id = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (s.full_name ILIKE $${params.length} OR s.nisn ILIKE $${params.length} OR ep.token ILIKE $${params.length})`;
    }

    sql += ` ORDER BY c.name ASC, s.full_name ASC;`;

    const res = await queryPostgres(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      examId: r.exam_id,
      studentId: r.student_id,
      studentName: r.student_name,
      nisn: r.nisn,
      nis: r.nis,
      gender: r.gender,
      className: r.class_room_name || 'Belum Ada Kelas',
      token: r.token,
      tokenStatus: r.token_status,
      assignedPackage: r.assigned_package,
      roomId: r.room_id,
      roomName: r.room_name || 'Belum Diplot',
      roomCode: r.room_code || '-',
      sessionNumber: r.session_number || 1,
      seatNumber: r.seat_number || '-',
      finalScore: r.final_score !== null ? parseFloat(r.final_score) : null,
      gradedStatus: r.graded_status,
      sessionStatus: r.session_status || 'NOT_STARTED',
      lastHeartbeatAt: r.last_heartbeat_at,
      tabViolationCount: r.tab_violation_count || 0,
      createdAt: r.created_at,
    }));
  }

  /**
   * Menugaskan peserta ujian dari satu atau beberapa rombel kelas.
   * Validasi ketat: Student.school_id === Exam.school_id.
   */
  static async assignParticipantsByClass(
    schoolId: string,
    examId: string,
    classIds: string[],
    actor: { id: string; username: string; role: string }
  ): Promise<{ assignedCount: number }> {
    // Validasi kepemilikan exam
    const examCheck = await queryPostgres('SELECT id, title FROM exams WHERE id = $1 AND school_id = $2;', [
      examId,
      schoolId,
    ]);
    if (examCheck.rows.length === 0) {
      throw new Error('Ujian tidak ditemukan di sekolah ini.');
    }

    // Ambil seluruh siswa aktif di kelas-kelas tersebut yang terikat ke schoolId
    const studentsRes = await queryPostgres(
      `SELECT id, nisn FROM students 
       WHERE school_id = $1 AND class_room_id = ANY($2::uuid[]) AND is_active = true;`,
      [schoolId, classIds]
    );

    if (studentsRes.rows.length === 0) {
      throw new Error('Tidak ada siswa aktif yang ditemukan di kelas yang dipilih.');
    }

    return await withTransaction(async (client) => {
      let assignedCount = 0;
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

      for (const s of studentsRes.rows) {
        // Generate format token: e.g. A7K9-2M4P
        let token = '';
        for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
        token += '-';
        for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));

        const res = await client.query(
          `INSERT INTO exam_participants (
            id, exam_id, student_id, token, token_status, assigned_package
           ) VALUES (
            uuid_generate_v4(), $1, $2, $3, 'ACTIVE', 'A'
           )
           ON CONFLICT (exam_id, student_id) DO NOTHING
           RETURNING id;`,
          [examId, s.id, token]
        );

        if (res.rows.length > 0) {
          assignedCount++;
        }
      }

      await AuditService.createLog({
        action: 'PARTICIPANTS_ASSIGNED_BY_CLASS',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'EXAM',
        resourceId: examId,
        details: { classIdsCount: classIds.length, assignedCount },
      });

      return { assignedCount };
    });
  }

  /**
   * Menugaskan peserta secara individual / spesifik.
   * Validasi ketat: Student.school_id === Exam.school_id.
   */
  static async assignIndividualStudents(
    schoolId: string,
    examId: string,
    studentIds: string[],
    actor: { id: string; username: string; role: string }
  ): Promise<{ assignedCount: number }> {
    // Validasi kepemilikan exam
    const examCheck = await queryPostgres('SELECT id FROM exams WHERE id = $1 AND school_id = $2;', [
      examId,
      schoolId,
    ]);
    if (examCheck.rows.length === 0) {
      throw new Error('Ujian tidak ditemukan di sekolah ini.');
    }

    // Validasi bahwa seluruh studentIds memang milik schoolId
    const validStudents = await queryPostgres(
      `SELECT id FROM students WHERE school_id = $1 AND id = ANY($2::uuid[]) AND is_active = true;`,
      [schoolId, studentIds]
    );

    if (validStudents.rows.length !== studentIds.length) {
      throw new Error('Beberapa siswa yang dipilih tidak valid atau bukan berasal dari sekolah Anda.');
    }

    return await withTransaction(async (client) => {
      let assignedCount = 0;
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

      for (const s of validStudents.rows) {
        let token = '';
        for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
        token += '-';
        for (let i = 0; i < 4; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));

        const res = await client.query(
          `INSERT INTO exam_participants (
            id, exam_id, student_id, token, token_status, assigned_package
           ) VALUES (
            uuid_generate_v4(), $1, $2, $3, 'ACTIVE', 'A'
           )
           ON CONFLICT (exam_id, student_id) DO NOTHING
           RETURNING id;`,
          [examId, s.id, token]
        );

        if (res.rows.length > 0) assignedCount++;
      }

      await AuditService.createLog({
        action: 'PARTICIPANTS_ASSIGNED_INDIVIDUAL',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'EXAM',
        resourceId: examId,
        details: { selectedCount: studentIds.length, assignedCount },
      });

      return { assignedCount };
    });
  }

  /**
   * Hapus peserta dari ujian (jika belum pengerjaan).
   */
  static async removeParticipant(
    schoolId: string,
    participantId: string,
    actor: { id: string; username: string; role: string }
  ): Promise<void> {
    const partRes = await queryPostgres(
      `SELECT ep.id, ep.exam_id, s.full_name, e.title 
       FROM exam_participants ep
       JOIN exams e ON ep.exam_id = e.id
       JOIN students s ON ep.student_id = s.id
       WHERE ep.id = $1 AND e.school_id = $2;`,
      [participantId, schoolId]
    );

    if (partRes.rows.length === 0) {
      throw new Error('Peserta ujian tidak ditemukan di sekolah ini.');
    }

    await queryPostgres(`DELETE FROM exam_participants WHERE id = $1;`, [participantId]);

    await AuditService.createLog({
      action: 'PARTICIPANT_REMOVED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'EXAM',
      resourceId: partRes.rows[0].exam_id,
      details: { studentName: partRes.rows[0].full_name, examTitle: partRes.rows[0].title },
    });
  }
}
