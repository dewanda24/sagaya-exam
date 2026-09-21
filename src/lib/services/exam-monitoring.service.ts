import { queryPostgres } from '../core/postgres';

export class ExamMonitoringService {
  /**
   * Mengambil ringkasan monitoring live untuk ujian yang sedang berjalan.
   * JAMINAN KEAMANAN: Tidak mengekspos answer key maupun session token!
   */
  static async getLiveMonitoring(schoolId: string, examId: string) {
    const examRes = await queryPostgres(
      `SELECT e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes,
              s.name as subject_name
       FROM exams e
       JOIN subjects s ON e.subject_id = s.id
       WHERE e.id = $1 AND e.school_id = $2;`,
      [examId, schoolId]
    );

    if (examRes.rows.length === 0) {
      throw new Error('Ujian tidak ditemukan di sekolah ini.');
    }
    const exam = examRes.rows[0];

    // Ambil peserta & sesi pengerjaan terkini
    const participantsRes = await queryPostgres(
      `SELECT ep.id as participant_id, ep.token, ep.token_status,
              s.id as student_id, s.full_name as student_name, s.nisn, s.nis,
              c.name as class_room_name,
              r.name as room_name, r.code as room_code,
              ep.session_number, ep.seat_number,
              es.id as session_id,
              COALESCE(es.status, 'NOT_STARTED') as session_status,
              es.server_started_at, es.server_expires_at, es.submitted_at,
              es.last_heartbeat_at, es.tab_violation_count, es.current_question_index,
              (SELECT COUNT(*) FROM student_answers sa WHERE sa.session_id = es.id AND sa.answer_value_json IS NOT NULL) as answered_count
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       LEFT JOIN exam_rooms r ON ep.room_id = r.id
       LEFT JOIN exam_sessions es ON ep.id = es.participant_id
       WHERE ep.exam_id = $1
       ORDER BY c.name ASC, s.full_name ASC;`,
      [examId]
    );

    const rows = participantsRes.rows;
    const now = Date.now();

    // Hitung agregasi metrik
    let notStarted = 0;
    let inProgress = 0;
    let submitted = 0;
    let disconnected = 0;
    let violations = 0;
    let expired = 0;

    const participants = rows.map((r: any) => {
      let status = r.session_status;

      // Deteksi disconnected jika last_heartbeat > 60 detik saat IN_PROGRESS
      if (status === 'IN_PROGRESS' && r.last_heartbeat_at) {
        const lastHb = new Date(r.last_heartbeat_at).getTime();
        if (now - lastHb > 60000) {
          status = 'DISCONNECTED';
        }
      }

      if (status === 'NOT_STARTED') notStarted++;
      else if (status === 'IN_PROGRESS') inProgress++;
      else if (status === 'SUBMITTED') submitted++;
      else if (status === 'DISCONNECTED') disconnected++;
      else if (status === 'EXPIRED') expired++;

      if (parseInt(r.tab_violation_count || '0', 10) > 0) {
        violations += parseInt(r.tab_violation_count || '0', 10);
      }

      return {
        participantId: r.participant_id,
        studentId: r.student_id,
        studentName: r.student_name,
        nisn: r.nisn,
        nis: r.nis,
        className: r.class_room_name || 'Belum Ada Kelas',
        roomName: r.room_name || 'Belum Diplot',
        roomCode: r.room_code || '-',
        sessionNumber: r.session_number || 1,
        seatNumber: r.seat_number || '-',
        status,
        startedAt: r.server_started_at,
        submittedAt: r.submitted_at,
        lastHeartbeatAt: r.last_heartbeat_at,
        tabViolationCount: parseInt(r.tab_violation_count || '0', 10),
        answeredCount: parseInt(r.answered_count || '0', 10),
        currentQuestionIndex: r.current_question_index || 0,
      };
    });

    return {
      exam: {
        id: exam.id,
        title: exam.title,
        status: exam.status,
        subjectName: exam.subject_name,
        startTime: exam.start_time,
        endTime: exam.end_time,
        durationMinutes: exam.duration_minutes,
      },
      metrics: {
        totalParticipants: rows.length,
        notStarted,
        inProgress,
        submitted,
        disconnected,
        violations,
        expired,
      },
      participants,
    };
  }
}
