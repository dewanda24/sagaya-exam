import { queryPostgres } from '../core/postgres';
import { ProctorAuthorizationService } from './proctor-authorization.service';
import { SessionUser } from '../core/auth';

export class ProctorMonitoringService {
  /**
   * Mengambil data pemantauan ruang ujian secara real-time.
   * Sumber kebenaran mutlak berasal dari server (heartbeat, countdown, progress).
   */
  static async getRoomMonitoringData(
    user: SessionUser,
    schoolId: string,
    examId: string,
    roomId: string,
    filters?: { search?: string; status?: string; connection?: string }
  ) {
    // 1. Otorisasi kepemilikan dan penugasan ruang
    const authCheck = await ProctorAuthorizationService.canAccessRoom(user, examId, roomId, schoolId);
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Akses ditolak: Anda tidak memiliki penugasan pada ruang ini.');
    }

    // 2. Ambil informasi ujian dan ruang
    const headerRes = await queryPostgres(
      `SELECT e.id as exam_id, e.title as exam_title, e.status as exam_status,
              e.start_time, e.end_time, e.duration_minutes,
              sub.name as subject_name, sub.code as subject_code,
              er.id as room_id, er.code as room_code, er.name as room_name, er.capacity,
              jsonb_array_length(COALESCE(e.question_snapshot_json, '[]'::jsonb)) as total_questions
       FROM exams e
       LEFT JOIN subjects sub ON e.subject_id = sub.id
       JOIN exam_rooms er ON er.id = $2
       WHERE e.id = $1 AND e.school_id = $3
       LIMIT 1;`,
      [examId, roomId, schoolId]
    );

    if (headerRes.rows.length === 0) {
      throw new Error('Data ujian atau ruang tidak ditemukan.');
    }

    const header = headerRes.rows[0];
    const totalQuestions = parseInt(header.total_questions || '0', 10);

    // Hitung sisa waktu ujian di server
    const nowMs = Date.now();
    const endMs = new Date(header.end_time).getTime();
    const remainingSeconds = Math.max(0, Math.floor((endMs - nowMs) / 1000));

    // 3. Query peserta HANYA untuk exam_id dan room_id ini (IDOR defense)
    let partQuery = `
      SELECT ep.id as participant_id,
             s.full_name as student_name, s.nis, s.nisn,
             c.name as class_name,
             ep.seat_number, ep.session_number,
             ar.status as attendance_status,
             es.id as session_id,
             es.status as session_status,
             es.device_fingerprint,
             es.ip_address,
             es.user_agent,
             es.server_started_at,
             es.server_expires_at,
             es.last_heartbeat_at,
             COALESCE(es.tab_violation_count, 0) as tab_violation_count,
             COALESCE(ans_stat.answered_count, 0) as answered_count,
             COALESCE(viol_stat.violation_count, 0) as total_violations
      FROM exam_participants ep
      JOIN students s ON ep.student_id = s.id
      LEFT JOIN class_rooms c ON s.class_room_id = c.id
      LEFT JOIN attendance_records ar ON ep.id = ar.participant_id AND ar.exam_id = ep.exam_id
      LEFT JOIN exam_sessions es ON ep.id = es.participant_id
      LEFT JOIN (
        SELECT session_id, count(*) as answered_count
        FROM student_answers
        WHERE answer_value_json IS NOT NULL AND answer_value_json::text NOT IN ('""', 'null', '[]', '{}')
        GROUP BY session_id
      ) ans_stat ON es.id = ans_stat.session_id
      LEFT JOIN (
        SELECT participant_id, count(*) as violation_count
        FROM exam_violations
        WHERE exam_id = $1
        GROUP BY participant_id
      ) viol_stat ON ep.id = viol_stat.participant_id
      WHERE ep.exam_id = $1 AND ep.room_id = $2
    `;

    const params: any[] = [examId, roomId];
    let pIdx = 3;

    if (filters?.search) {
      partQuery += ` AND (s.full_name ILIKE $${pIdx} OR s.nis ILIKE $${pIdx} OR s.nisn ILIKE $${pIdx})`;
      params.push(`%${filters.search}%`);
      pIdx++;
    }

    partQuery += ` ORDER BY ep.session_number ASC, ep.seat_number ASC, s.full_name ASC;`;

    const partRes = await queryPostgres(partQuery, params);

    let countOnline = 0;
    let countRecentlyDisconnected = 0;
    let countOffline = 0;
    let countSubmitted = 0;
    let countWarning = 0;
    let countCritical = 0;

    const participants = partRes.rows.map((r: any) => {
      // Hitung connection status di server
      let connectionStatus: 'ONLINE' | 'RECENTLY_DISCONNECTED' | 'OFFLINE' = 'OFFLINE';
      const lastPing = r.last_heartbeat_at ? new Date(r.last_heartbeat_at).getTime() : 0;
      const diffPingMs = nowMs - lastPing;

      if (r.session_status === 'IN_PROGRESS') {
        if (diffPingMs < 30000) {
          connectionStatus = 'ONLINE';
          countOnline++;
        } else if (diffPingMs < 90000) {
          connectionStatus = 'RECENTLY_DISCONNECTED';
          countRecentlyDisconnected++;
        } else {
          connectionStatus = 'OFFLINE';
          countOffline++;
        }
      } else {
        connectionStatus = 'OFFLINE';
      }

      // Hitung participant status di server
      let computedStatus = r.session_status || 'NOT_STARTED';
      if (r.session_status === 'IN_PROGRESS') {
        const expireMs = r.server_expires_at ? new Date(r.server_expires_at).getTime() : 0;
        if (expireMs > 0 && nowMs > expireMs) {
          computedStatus = 'TIMEOUT';
        } else if (connectionStatus === 'OFFLINE') {
          computedStatus = 'DISCONNECTED';
        }
      } else if (r.session_status === 'SUBMITTED') {
        countSubmitted++;
      }

      // Evaluasi tingkat peringatan pelanggaran
      const vCount = parseInt(r.total_violations || '0', 10) + parseInt(r.tab_violation_count || '0', 10);
      let violationSeverity: 'NONE' | 'WARNING' | 'CRITICAL' = 'NONE';
      if (vCount >= 3) {
        violationSeverity = 'CRITICAL';
        countCritical++;
      } else if (vCount > 0) {
        violationSeverity = 'WARNING';
        countWarning++;
      }

      // Hitung sisa waktu sesi peserta
      let sessionRemainingSeconds = 0;
      if (r.server_expires_at) {
        const sessExpire = new Date(r.server_expires_at).getTime();
        sessionRemainingSeconds = Math.max(0, Math.floor((sessExpire - nowMs) / 1000));
      }

      return {
        participantId: r.participant_id,
        studentName: r.student_name,
        nis: r.nis,
        nisn: r.nisn,
        className: r.class_name || '-',
        seatNumber: r.seat_number || '-',
        sessionNumber: r.session_number || 1,
        attendanceStatus: r.attendance_status || 'PRESENT',
        status: computedStatus,
        connectionStatus,
        progress: {
          answered: parseInt(r.answered_count, 10),
          total: totalQuestions,
          percentage: totalQuestions > 0 ? Math.round((parseInt(r.answered_count, 10) / totalQuestions) * 100) : 0,
        },
        timeRemainingSeconds: sessionRemainingSeconds,
        violationCount: vCount,
        violationSeverity,
        lastHeartbeatAt: r.last_heartbeat_at,
        deviceSummary: r.user_agent ? summarizeUserAgent(r.user_agent) : 'Browser',
        // CATATAN KEAMANAN: token, password, raw answers, dan answer keys TIDAK PERNAH dikembalikan!
      };
    });

    // Filter tambahan client-requested jika ada
    let filteredList = participants;
    if (filters?.status && filters.status !== 'ALL') {
      filteredList = filteredList.filter((p) => p.status === filters.status);
    }
    if (filters?.connection && filters.connection !== 'ALL') {
      filteredList = filteredList.filter((p) => p.connectionStatus === filters.connection);
    }

    return {
      exam: {
        id: header.exam_id,
        title: header.exam_title,
        subjectName: header.subject_name || 'Umum',
        subjectCode: header.subject_code || '-',
        status: header.exam_status,
        startTime: header.start_time,
        endTime: header.end_time,
        durationMinutes: header.duration_minutes,
        remainingSeconds,
        totalQuestions,
      },
      room: {
        id: header.room_id,
        code: header.room_code,
        name: header.room_name,
        capacity: header.capacity,
      },
      stats: {
        totalParticipants: participants.length,
        online: countOnline,
        recentlyDisconnected: countRecentlyDisconnected,
        offline: countOffline,
        submitted: countSubmitted,
        warning: countWarning,
        critical: countCritical,
      },
      participants: filteredList,
      serverTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Mengambil detail operasional seorang peserta secara aman tanpa kebocoran kunci jawaban atau token.
   */
  static async getParticipantDetail(
    user: SessionUser,
    schoolId: string,
    examId: string,
    roomId: string,
    participantId: string
  ) {
    // Verifikasi kepemilikan peserta di ruang yang diawasi
    const authCheck = await ProctorAuthorizationService.canAccessParticipant(user, examId, roomId, participantId, schoolId);
    if (!authCheck.allowed) {
      throw new Error(authCheck.reason || 'Akses ditolak: Peserta tidak berada pada ruang yang Anda awasi.');
    }

    // Ambil detail identitas & sesi peserta
    const partRes = await queryPostgres(
      `SELECT ep.id as participant_id, ep.seat_number, ep.session_number,
              s.full_name as student_name, s.nis, s.nisn, s.gender,
              c.name as class_name,
              ar.status as attendance_status, ar.notes as attendance_notes,
              es.id as session_id, es.status as session_status,
              es.device_fingerprint, es.ip_address, es.user_agent,
              es.server_started_at, es.server_expires_at, es.last_heartbeat_at,
              COALESCE(es.tab_violation_count, 0) as tab_violation_count,
              COALESCE(ans_stat.answered_count, 0) as answered_count,
              jsonb_array_length(COALESCE(e.question_snapshot_json, '[]'::jsonb)) as total_questions
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       JOIN exams e ON ep.exam_id = e.id
       LEFT JOIN attendance_records ar ON ep.id = ar.participant_id AND ar.exam_id = ep.exam_id
       LEFT JOIN exam_sessions es ON ep.id = es.participant_id
       LEFT JOIN (
         SELECT session_id, count(*) as answered_count
         FROM student_answers
         WHERE answer_value_json IS NOT NULL AND answer_value_json::text NOT IN ('""', 'null', '[]', '{}')
         GROUP BY session_id
       ) ans_stat ON es.id = ans_stat.session_id
       WHERE ep.id = $1 AND ep.exam_id = $2 AND ep.room_id = $3
       LIMIT 1;`,
      [participantId, examId, roomId]
    );

    if (partRes.rows.length === 0) {
      throw new Error('Peserta tidak ditemukan.');
    }

    const p = partRes.rows[0];

    // Ambil riwayat pelanggaran peserta
    const violRes = await queryPostgres(
      `SELECT id, event_type, severity, description, metadata_json, created_at
       FROM exam_violations
       WHERE exam_id = $1 AND participant_id = $2
       ORDER BY created_at DESC;`,
      [examId, participantId]
    );

    // Ambil catatan pengawas untuk peserta ini
    const notesRes = await queryPostgres(
      `SELECT pn.id, pn.content, pn.created_at, u.full_name as proctor_name
       FROM proctor_notes pn
       JOIN users u ON pn.proctor_id = u.id
       WHERE pn.exam_id = $1 AND pn.participant_id = $2
       ORDER BY pn.created_at DESC;`,
      [examId, participantId]
    );

    // Ambil insiden terkait peserta ini
    const incRes = await queryPostgres(
      `SELECT id, category, severity, description, action_taken, status, created_at
       FROM exam_incidents
       WHERE exam_id = $1 AND participant_id = $2
       ORDER BY created_at DESC;`,
      [examId, participantId]
    );

    return {
      identity: {
        participantId: p.participant_id,
        studentName: p.student_name,
        nis: p.nis,
        nisn: p.nisn,
        gender: p.gender,
        className: p.class_name || '-',
        seatNumber: p.seat_number || '-',
        sessionNumber: p.session_number || 1,
      },
      attendance: {
        status: p.attendance_status || 'PRESENT',
        notes: p.attendance_notes,
      },
      session: {
        status: p.session_status || 'NOT_STARTED',
        serverStartedAt: p.server_started_at,
        serverExpiresAt: p.server_expires_at,
        lastHeartbeatAt: p.last_heartbeat_at,
        ipAddress: p.ip_address || '-',
        deviceFingerprint: p.device_fingerprint ? `${p.device_fingerprint.substring(0, 12)}...` : '-',
        userAgent: p.user_agent,
      },
      progress: {
        answered: parseInt(p.answered_count, 10),
        total: parseInt(p.total_questions, 10),
      },
      violations: violRes.rows.map((v) => ({
        id: v.id,
        eventType: v.event_type,
        severity: v.severity,
        description: v.description,
        createdAt: v.created_at,
      })),
      proctorNotes: notesRes.rows.map((n) => ({
        id: n.id,
        content: n.content,
        createdAt: n.created_at,
        proctorName: n.proctor_name,
      })),
      incidents: incRes.rows.map((i) => ({
        id: i.id,
        category: i.category,
        severity: i.severity,
        description: i.description,
        actionTaken: i.action_taken,
        status: i.status,
        createdAt: i.created_at,
      })),
    };
  }
}

function summarizeUserAgent(ua: string): string {
  if (ua.includes('Chrome')) return 'Chrome Browser';
  if (ua.includes('Firefox')) return 'Firefox Browser';
  if (ua.includes('Safari')) return 'Safari Browser';
  if (ua.includes('Edge')) return 'Edge Browser';
  return 'Web Browser';
}
