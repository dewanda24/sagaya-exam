import { queryPostgres } from '../core/postgres';

export class ProctorCoreService {
  /**
   * Mengambil metrik ringkasan untuk Dasbor Pengawas.
   */
  static async getDashboardMetrics(userId: string, schoolId: string, role: string) {
    const isMaster = role === 'SUPER_ADMIN' || role === 'ADMIN';

    // 1. Ambil daftar ujian yang ditugaskan ke pengawas ini (atau semua ujian sekolah jika admin)
    const assignedExamsQuery = isMaster
      ? `SELECT DISTINCT e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes,
                sub.name as subject_name, er.id as room_id, er.code as room_code, er.name as room_name,
                er.capacity as room_capacity, erp.session_number
         FROM exams e
         LEFT JOIN subjects sub ON e.subject_id = sub.id
         LEFT JOIN exam_room_proctors erp ON e.id = erp.exam_id
         LEFT JOIN exam_rooms er ON erp.room_id = er.id
         WHERE e.school_id = $1
         ORDER BY e.start_time ASC;`
      : `SELECT DISTINCT e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes,
                sub.name as subject_name, er.id as room_id, er.code as room_code, er.name as room_name,
                er.capacity as room_capacity, erp.session_number
         FROM exam_room_proctors erp
         JOIN exams e ON erp.exam_id = e.id
         LEFT JOIN subjects sub ON e.subject_id = sub.id
         JOIN exam_rooms er ON erp.room_id = er.id
         WHERE erp.proctor_id = $1 AND e.school_id = $2
         ORDER BY e.start_time ASC;`;

    const assignedExamsParams = isMaster ? [schoolId] : [userId, schoolId];
    const assignedRes = await queryPostgres(assignedExamsQuery, assignedExamsParams);
    const assignedRows = assignedRes.rows;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const todaySchedules: any[] = [];
    const upcomingExams: any[] = [];
    const ongoingExams: any[] = [];
    const completedExams: any[] = [];
    const roomSet = new Set<string>();
    const examSet = new Set<string>();

    for (const row of assignedRows) {
      if (row.room_id) roomSet.add(row.room_id);
      if (row.id) examSet.add(row.id);

      const startDateStr = new Date(row.start_time).toISOString().split('T')[0];
      const isToday = startDateStr === todayStr;

      const scheduleItem = {
        examId: row.id,
        examTitle: row.title,
        subjectName: row.subject_name || 'Umum',
        roomId: row.room_id,
        roomCode: row.room_code,
        roomName: row.room_name,
        sessionNumber: row.session_number || 1,
        startTime: row.start_time,
        endTime: row.end_time,
        durationMinutes: row.duration_minutes,
        status: row.status,
      };

      if (isToday) {
        todaySchedules.push(scheduleItem);
      }

      if (row.status === 'ACTIVE') {
        if (!ongoingExams.some((e) => e.examId === row.id)) ongoingExams.push(scheduleItem);
      } else if (row.status === 'SCHEDULED' || row.status === 'PUBLISHED') {
        if (!upcomingExams.some((e) => e.examId === row.id)) upcomingExams.push(scheduleItem);
      } else if (row.status === 'COMPLETED' || row.status === 'ARCHIVED') {
        if (!completedExams.some((e) => e.examId === row.id)) completedExams.push(scheduleItem);
      }
    }

    // 2. Agregasi data peserta pada ruang-ruang yang ditugaskan
    let totalParticipants = 0;
    let activeParticipants = 0;
    let disconnectedParticipants = 0;
    let problematicParticipants = 0;

    if (roomSet.size > 0 && examSet.size > 0) {
      const roomIds = Array.from(roomSet);
      const examIds = Array.from(examSet);

      const partQuery = `
        SELECT ep.id, es.status as session_status, es.last_heartbeat_at, es.server_expires_at,
               COALESCE(es.tab_violation_count, 0) as tab_violation_count
        FROM exam_participants ep
        LEFT JOIN exam_sessions es ON ep.id = es.participant_id
        WHERE ep.exam_id = ANY($1::uuid[]) AND ep.room_id = ANY($2::uuid[]);
      `;
      const partRes = await queryPostgres(partQuery, [examIds, roomIds]);

      totalParticipants = partRes.rows.length;

      for (const p of partRes.rows) {
        const lastPing = p.last_heartbeat_at ? new Date(p.last_heartbeat_at).getTime() : 0;
        const nowMs = Date.now();
        const isOffline = p.session_status === 'IN_PROGRESS' && nowMs - lastPing > 30000;
        const hasViolations = p.tab_violation_count > 0;

        if (p.session_status === 'IN_PROGRESS') {
          activeParticipants++;
        }
        if (isOffline || p.session_status === 'DISCONNECTED') {
          disconnectedParticipants++;
        }
        if (hasViolations || isOffline || p.session_status === 'LOCKED') {
          problematicParticipants++;
        }
      }
    }

    // 3. Pelanggaran terbaru di ruang yang diawasi
    const violationsQuery = isMaster
      ? `SELECT ev.id, ev.event_type, ev.severity, ev.description, ev.created_at,
                s.full_name as student_name, er.name as room_name, e.title as exam_title
         FROM exam_violations ev
         JOIN exam_participants ep ON ev.participant_id = ep.id
         JOIN students s ON ep.student_id = s.id
         JOIN exams e ON ev.exam_id = e.id
         LEFT JOIN exam_rooms er ON ev.room_id = er.id
         WHERE ev.school_id = $1
         ORDER BY ev.created_at DESC
         LIMIT 10;`
      : `SELECT ev.id, ev.event_type, ev.severity, ev.description, ev.created_at,
                s.full_name as student_name, er.name as room_name, e.title as exam_title
         FROM exam_violations ev
         JOIN exam_participants ep ON ev.participant_id = ep.id
         JOIN students s ON ep.student_id = s.id
         JOIN exams e ON ev.exam_id = e.id
         LEFT JOIN exam_rooms er ON ev.room_id = er.id
         JOIN exam_room_proctors erp ON erp.exam_id = ev.exam_id AND erp.room_id = ev.room_id
         WHERE erp.proctor_id = $1 AND ev.school_id = $2
         ORDER BY ev.created_at DESC
         LIMIT 10;`;

    const violationsRes = await queryPostgres(violationsQuery, isMaster ? [schoolId] : [userId, schoolId]);

    // 4. Insiden terbuka
    const incidentsQuery = isMaster
      ? `SELECT ei.id, ei.category, ei.severity, ei.description, ei.status, ei.created_at,
                er.name as room_name, e.title as exam_title
         FROM exam_incidents ei
         JOIN exams e ON ei.exam_id = e.id
         LEFT JOIN exam_rooms er ON ei.room_id = er.id
         WHERE ei.school_id = $1 AND ei.status = 'OPEN'
         ORDER BY ei.created_at DESC
         LIMIT 5;`
      : `SELECT ei.id, ei.category, ei.severity, ei.description, ei.status, ei.created_at,
                er.name as room_name, e.title as exam_title
         FROM exam_incidents ei
         JOIN exams e ON ei.exam_id = e.id
         LEFT JOIN exam_rooms er ON ei.room_id = er.id
         JOIN exam_room_proctors erp ON erp.exam_id = ei.exam_id AND (erp.room_id = ei.room_id OR ei.room_id IS NULL)
         WHERE erp.proctor_id = $1 AND ei.school_id = $2 AND ei.status = 'OPEN'
         ORDER BY ei.created_at DESC
         LIMIT 5;`;

    const incidentsRes = await queryPostgres(incidentsQuery, isMaster ? [schoolId] : [userId, schoolId]);

    return {
      stats: {
        assignedRoomsCount: roomSet.size,
        totalParticipants,
        activeParticipants,
        problematicParticipants,
        disconnectedParticipants,
        todaySchedulesCount: todaySchedules.length,
        ongoingCount: ongoingExams.length,
        upcomingCount: upcomingExams.length,
        completedCount: completedExams.length,
      },
      todaySchedules,
      ongoingExams,
      upcomingExams,
      completedExams,
      recentViolations: violationsRes.rows.map((r) => ({
        id: r.id,
        eventType: r.event_type,
        severity: r.severity,
        description: r.description,
        createdAt: r.created_at,
        studentName: r.student_name,
        roomName: r.room_name || 'Ruang Umum',
        examTitle: r.exam_title,
      })),
      openIncidents: incidentsRes.rows.map((r) => ({
        id: r.id,
        category: r.category,
        severity: r.severity,
        description: r.description,
        status: r.status,
        createdAt: r.created_at,
        roomName: r.room_name || 'Ruang Umum',
        examTitle: r.exam_title,
      })),
    };
  }

  /**
   * Mengambil jadwal pengawasan dengan filter fleksibel.
   */
  static async getProctorSchedule(
    userId: string,
    schoolId: string,
    role: string,
    filters: { date?: string; status?: string; roomId?: string; examId?: string }
  ) {
    const isMaster = role === 'SUPER_ADMIN' || role === 'ADMIN';

    let query = isMaster
      ? `SELECT e.id as exam_id, e.title as exam_title, e.status as exam_status,
                e.start_time, e.end_time, e.duration_minutes,
                sub.name as subject_name, sub.code as subject_code,
                er.id as room_id, er.code as room_code, er.name as room_name, er.capacity,
                erp.session_number, erp.notes as proctor_notes,
                COUNT(ep.id) as student_count
         FROM exams e
         LEFT JOIN subjects sub ON e.subject_id = sub.id
         LEFT JOIN exam_room_proctors erp ON e.id = erp.exam_id
         LEFT JOIN exam_rooms er ON erp.room_id = er.id
         LEFT JOIN exam_participants ep ON ep.exam_id = e.id AND ep.room_id = er.id AND ep.session_number = erp.session_number
         WHERE e.school_id = $1`
      : `SELECT e.id as exam_id, e.title as exam_title, e.status as exam_status,
                e.start_time, e.end_time, e.duration_minutes,
                sub.name as subject_name, sub.code as subject_code,
                er.id as room_id, er.code as room_code, er.name as room_name, er.capacity,
                erp.session_number, erp.notes as proctor_notes,
                COUNT(ep.id) as student_count
         FROM exam_room_proctors erp
         JOIN exams e ON erp.exam_id = e.id
         LEFT JOIN subjects sub ON e.subject_id = sub.id
         JOIN exam_rooms er ON erp.room_id = er.id
         LEFT JOIN exam_participants ep ON ep.exam_id = e.id AND ep.room_id = er.id AND ep.session_number = erp.session_number
         WHERE erp.proctor_id = $1 AND e.school_id = $2`;

    const params: any[] = isMaster ? [schoolId] : [userId, schoolId];
    let pIdx = params.length + 1;

    if (filters.date) {
      query += ` AND DATE(e.start_time) = $${pIdx++}`;
      params.push(filters.date);
    }
    if (filters.status) {
      query += ` AND e.status = $${pIdx++}`;
      params.push(filters.status);
    }
    if (filters.roomId) {
      query += ` AND er.id = $${pIdx++}`;
      params.push(filters.roomId);
    }
    if (filters.examId) {
      query += ` AND e.id = $${pIdx++}`;
      params.push(filters.examId);
    }

    query += ` GROUP BY e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes,
                        sub.name, sub.code, er.id, er.code, er.name, er.capacity, erp.session_number, erp.notes
               ORDER BY e.start_time ASC, er.code ASC;`;

    const res = await queryPostgres(query, params);

    return res.rows.map((r) => ({
      examId: r.exam_id,
      examTitle: r.exam_title,
      examStatus: r.exam_status,
      startTime: r.start_time,
      endTime: r.end_time,
      durationMinutes: r.duration_minutes,
      subjectName: r.subject_name || 'Umum',
      subjectCode: r.subject_code || '-',
      roomId: r.room_id,
      roomCode: r.room_code,
      roomName: r.room_name,
      roomCapacity: r.capacity,
      sessionNumber: r.session_number || 1,
      studentCount: parseInt(r.student_count || '0', 10),
      proctorNotes: r.proctor_notes,
    }));
  }

  /**
   * Mengambil data checklist pra-ujian (Pre-Exam Check).
   */
  static async getPreExamCheck(userId: string, schoolId: string, examId: string, roomId: string) {
    const examRes = await queryPostgres(
      `SELECT e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes,
              sub.name as subject_name, er.id as room_id, er.code as room_code, er.name as room_name,
              er.capacity, e.school_id
       FROM exams e
       LEFT JOIN subjects sub ON e.subject_id = sub.id
       JOIN exam_rooms er ON er.id = $2
       WHERE e.id = $1 AND e.school_id = $3
       LIMIT 1;`,
      [examId, roomId, schoolId]
    );

    if (examRes.rows.length === 0) {
      throw new Error('Ujian atau ruang tidak ditemukan pada sekolah Anda.');
    }

    const exam = examRes.rows[0];

    // Ambil jumlah peserta terdaftar di ruang ini
    const partCountRes = await queryPostgres(
      `SELECT COUNT(*) as total FROM exam_participants WHERE exam_id = $1 AND room_id = $2;`,
      [examId, roomId]
    );
    const participantCount = parseInt(partCountRes.rows[0]?.total || '0', 10);

    // Ambil status sesi monitoring pengawas jika sudah pernah dimulai
    const sessionRes = await queryPostgres(
      `SELECT id, status, checklist_json, started_at, ended_at
       FROM proctor_monitoring_sessions
       WHERE exam_id = $1 AND room_id = $2 AND proctor_id = $3
       ORDER BY created_at DESC
       LIMIT 1;`,
      [examId, roomId, userId]
    );

    const monitoringSession = sessionRes.rows[0] || null;

    // Hitung validasi kelayakan mulai pengawasan
    const now = new Date().getTime();
    const startTime = new Date(exam.start_time).getTime();
    const endTime = new Date(exam.end_time).getTime();

    // Grace period: boleh mulai check 30 menit sebelum ujian dimulai
    const gracePeriodMs = 30 * 60 * 1000;
    const isWithinWindow = now >= startTime - gracePeriodMs && now <= endTime;
    const isExamFinished = exam.status === 'COMPLETED' || exam.status === 'ARCHIVED' || now > endTime;

    let canStartMonitoring = true;
    let reasonBlocked: string | undefined;

    if (isExamFinished) {
      canStartMonitoring = false;
      reasonBlocked = 'Ujian telah berakhir atau berstatus COMPLETED.';
    } else if (exam.status === 'DRAFT') {
      canStartMonitoring = false;
      reasonBlocked = 'Ujian masih berstatus DRAFT dan belum dijadwalkan.';
    } else if (!isWithinWindow) {
      canStartMonitoring = false;
      reasonBlocked = 'Waktu pelaksanaan ujian belum masuk dalam jendela pengawasan (maksimal 30 menit sebelum mulai).';
    }

    return {
      exam: {
        id: exam.id,
        title: exam.title,
        status: exam.status,
        startTime: exam.start_time,
        endTime: exam.end_time,
        durationMinutes: exam.duration_minutes,
        subjectName: exam.subject_name || 'Umum',
      },
      room: {
        id: exam.room_id,
        code: exam.room_code,
        name: exam.room_name,
        capacity: exam.capacity,
        participantCount,
      },
      monitoringSession: monitoringSession
        ? {
            id: monitoringSession.id,
            status: monitoringSession.status,
            checklist: monitoringSession.checklist_json,
            startedAt: monitoringSession.started_at,
            endedAt: monitoringSession.ended_at,
          }
        : null,
      readiness: {
        canStartMonitoring,
        reasonBlocked,
        isWithinWindow,
        isExamFinished,
      },
    };
  }

  /**
   * Memulai pengawasan ruang (Start Exam Monitoring).
   */
  static async startMonitoring(
    userId: string,
    schoolId: string,
    examId: string,
    roomId: string,
    checklist: {
      roomReady?: boolean;
      participantsReady?: boolean;
      devicesReady?: boolean;
      networkReady?: boolean;
      instructionsGiven?: boolean;
    }
  ) {
    // Validasi kelayakan pra-ujian terlebih dahulu
    const preCheck = await this.getPreExamCheck(userId, schoolId, examId, roomId);
    if (!preCheck.readiness.canStartMonitoring) {
      throw new Error(`Tidak dapat memulai pengawasan: ${preCheck.readiness.reasonBlocked}`);
    }

    // Insert atau update session pengawasan
    const res = await queryPostgres(
      `INSERT INTO proctor_monitoring_sessions (school_id, exam_id, room_id, proctor_id, status, checklist_json, started_at)
       VALUES ($1, $2, $3, $4, 'MONITORING', $5, NOW())
       RETURNING id, status, started_at;`,
      [schoolId, examId, roomId, userId, JSON.stringify(checklist || {})]
    );

    // Audit log aksi mulai pengawasan
    await queryPostgres(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, 'PENGAWAS', 'PROCTOR_STARTED_MONITORING', $3);`,
      [
        schoolId,
        userId,
        JSON.stringify({
          examId,
          roomId,
          checklist,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    return res.rows[0];
  }

  /**
   * Mengakhiri pengawasan ruang (End Exam Monitoring).
   */
  static async endMonitoring(userId: string, schoolId: string, examId: string, roomId: string) {
    const res = await queryPostgres(
      `UPDATE proctor_monitoring_sessions
       SET status = 'ENDED', ended_at = NOW()
       WHERE exam_id = $1 AND room_id = $2 AND proctor_id = $3 AND status = 'MONITORING'
       RETURNING id, status, ended_at;`,
      [examId, roomId, userId]
    );

    // Audit log aksi pengakhiran pengawasan
    await queryPostgres(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, 'PENGAWAS', 'PROCTOR_ENDED_MONITORING', $3);`,
      [
        schoolId,
        userId,
        JSON.stringify({
          examId,
          roomId,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    return res.rows[0] || { status: 'ENDED' };
  }
}
