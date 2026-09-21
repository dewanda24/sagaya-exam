import { queryPostgres } from '../core/postgres';
import { ProctorAuthorizationService } from './proctor-authorization.service';
import { SessionUser } from '../core/auth';
import { hasUserPermission } from '../core/permissions';

export type IncidentCategory = 'NETWORK_ISSUE' | 'DEVICE_ISSUE' | 'PARTICIPANT_ISSUE' | 'ROOM_ISSUE' | 'OTHER';
export type IncidentSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'RESOLVED';

export class IncidentService {
  /**
   * Melaporkan kendala / insiden operasional ruang ujian baru.
   */
  static async createIncident(
    user: SessionUser,
    schoolId: string,
    examId: string,
    data: {
      roomId?: string;
      participantId?: string;
      category: IncidentCategory;
      severity: IncidentSeverity;
      description: string;
      actionTaken?: string;
    }
  ) {
    if (!hasUserPermission(user, 'proctor.incident.create')) {
      throw new Error('Akses ditolak: Akun Anda tidak memiliki izin membuat laporan insiden.');
    }

    // Jika roomId disertakan, validasi hak pengawas atas ruang tersebut
    if (data.roomId) {
      const roomCheck = await ProctorAuthorizationService.canAccessRoom(user, examId, data.roomId, schoolId);
      if (!roomCheck.allowed) {
        throw new Error(roomCheck.reason || 'Akses ditolak: Anda tidak ditugaskan pada ruang ini.');
      }
    }

    // Jika participantId disertakan, pastikan peserta berada pada ruang tersebut
    if (data.participantId && data.roomId) {
      const partCheck = await ProctorAuthorizationService.canAccessParticipant(
        user,
        examId,
        data.roomId,
        data.participantId,
        schoolId
      );
      if (!partCheck.allowed) {
        throw new Error(partCheck.reason || 'Akses ditolak: Peserta tidak terdaftar pada ruang penugasan Anda.');
      }
    }

    const res = await queryPostgres(
      `INSERT INTO exam_incidents (school_id, exam_id, room_id, participant_id, reported_by, category, severity, description, action_taken, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN', NOW())
       RETURNING id, category, severity, description, action_taken, status, created_at;`,
      [
        schoolId,
        examId,
        data.roomId || null,
        data.participantId || null,
        user.id,
        data.category,
        data.severity,
        data.description,
        data.actionTaken || null,
      ]
    );

    const incident = res.rows[0];

    // Audit log
    await queryPostgres(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, $3, 'INCIDENT_CREATED', $4);`,
      [
        schoolId,
        user.id,
        user.role,
        JSON.stringify({
          incidentId: incident.id,
          examId,
          roomId: data.roomId,
          category: data.category,
          severity: data.severity,
          description: data.description,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    return incident;
  }

  /**
   * Menyelesaikan / memperbarui insiden ruang ujian.
   */
  static async resolveIncident(
    user: SessionUser,
    schoolId: string,
    incidentId: string,
    actionTaken: string
  ) {
    if (!hasUserPermission(user, 'proctor.incident.update')) {
      throw new Error('Akses ditolak: Akun Anda tidak memiliki izin memperbarui status insiden.');
    }

    // Ambil detail insiden
    const checkRes = await queryPostgres(
      `SELECT id, exam_id, room_id, school_id, status FROM exam_incidents WHERE id = $1 AND school_id = $2 LIMIT 1;`,
      [incidentId, schoolId]
    );

    if (checkRes.rows.length === 0) {
      throw new Error('Insiden tidak ditemukan.');
    }

    const inc = checkRes.rows[0];

    // Validasi penugasan pengawas jika ada room_id
    if (inc.room_id && user.role === 'PENGAWAS') {
      const roomCheck = await ProctorAuthorizationService.canAccessRoom(user, inc.exam_id, inc.room_id, schoolId);
      if (!roomCheck.allowed) {
        throw new Error('Akses ditolak: Anda tidak memiliki wewenang pada ruang insiden ini.');
      }
    }

    const updateRes = await queryPostgres(
      `UPDATE exam_incidents
       SET status = 'RESOLVED',
           action_taken = COALESCE($1, action_taken),
           resolved_by = $2,
           resolved_at = NOW()
       WHERE id = $3 AND school_id = $4
       RETURNING id, status, action_taken, resolved_at;`,
      [actionTaken, user.id, incidentId, schoolId]
    );

    const updated = updateRes.rows[0];

    // Audit log
    await queryPostgres(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, $3, 'INCIDENT_RESOLVED', $4);`,
      [
        schoolId,
        user.id,
        user.role,
        JSON.stringify({
          incidentId,
          actionTaken,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    return updated;
  }

  /**
   * Mengambil daftar insiden untuk pengawas / admin.
   */
  static async getIncidents(
    user: SessionUser,
    schoolId: string,
    filters?: { examId?: string; roomId?: string; status?: string }
  ) {
    const isMaster = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

    let query = isMaster
      ? `SELECT ei.id, ei.category, ei.severity, ei.description, ei.action_taken, ei.status, ei.created_at, ei.resolved_at,
                e.title as exam_title, er.name as room_name, er.code as room_code,
                s.full_name as student_name,
                u_rep.full_name as reported_by_name,
                u_res.full_name as resolved_by_name
         FROM exam_incidents ei
         JOIN exams e ON ei.exam_id = e.id
         LEFT JOIN exam_rooms er ON ei.room_id = er.id
         LEFT JOIN exam_participants ep ON ei.participant_id = ep.id
         LEFT JOIN students s ON ep.student_id = s.id
         JOIN users u_rep ON ei.reported_by = u_rep.id
         LEFT JOIN users u_res ON ei.resolved_by = u_res.id
         WHERE ei.school_id = $1`
      : `SELECT ei.id, ei.category, ei.severity, ei.description, ei.action_taken, ei.status, ei.created_at, ei.resolved_at,
                e.title as exam_title, er.name as room_name, er.code as room_code,
                s.full_name as student_name,
                u_rep.full_name as reported_by_name,
                u_res.full_name as resolved_by_name
         FROM exam_incidents ei
         JOIN exams e ON ei.exam_id = e.id
         LEFT JOIN exam_rooms er ON ei.room_id = er.id
         LEFT JOIN exam_participants ep ON ei.participant_id = ep.id
         LEFT JOIN students s ON ep.student_id = s.id
         JOIN users u_rep ON ei.reported_by = u_rep.id
         LEFT JOIN users u_res ON ei.resolved_by = u_res.id
         JOIN exam_room_proctors erp ON erp.exam_id = ei.exam_id AND (erp.room_id = ei.room_id OR ei.room_id IS NULL)
         WHERE erp.proctor_id = $1 AND ei.school_id = $2`;

    const params: any[] = isMaster ? [schoolId] : [user.id, schoolId];
    let pIdx = params.length + 1;

    if (filters?.examId) {
      query += ` AND ei.exam_id = $${pIdx++}`;
      params.push(filters.examId);
    }
    if (filters?.roomId) {
      query += ` AND ei.room_id = $${pIdx++}`;
      params.push(filters.roomId);
    }
    if (filters?.status && filters.status !== 'ALL') {
      query += ` AND ei.status = $${pIdx++}`;
      params.push(filters.status);
    }

    query += ` ORDER BY ei.created_at DESC;`;

    const res = await queryPostgres(query, params);

    return res.rows.map((r) => ({
      id: r.id,
      category: r.category,
      severity: r.severity,
      description: r.description,
      actionTaken: r.action_taken,
      status: r.status,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      examTitle: r.exam_title,
      roomName: r.room_name || 'Umum',
      roomCode: r.room_code || '-',
      studentName: r.student_name,
      reportedByName: r.reported_by_name,
      resolvedByName: r.resolved_by_name,
    }));
  }
}
