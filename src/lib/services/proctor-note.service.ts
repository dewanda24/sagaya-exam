import { queryPostgres } from '../core/postgres';
import { ProctorAuthorizationService } from './proctor-authorization.service';
import { SessionUser } from '../core/auth';
import { hasUserPermission } from '../core/permissions';

export class ProctorNoteService {
  /**
   * Membuat catatan pengawas kontekstual untuk siswa atau ruang tertentu.
   */
  static async createNote(
    user: SessionUser,
    schoolId: string,
    examId: string,
    data: {
      roomId?: string;
      participantId?: string;
      content: string;
    }
  ) {
    if (!hasUserPermission(user, 'proctor.note.create')) {
      throw new Error('Akses ditolak: Akun Anda tidak memiliki izin membuat catatan pengawas.');
    }

    if (!data.content || !data.content.trim()) {
      throw new Error('Isi catatan pengawas tidak boleh kosong.');
    }

    // Validasi wewenang ruang jika ada
    if (data.roomId) {
      const roomCheck = await ProctorAuthorizationService.canAccessRoom(user, examId, data.roomId, schoolId);
      if (!roomCheck.allowed) {
        throw new Error(roomCheck.reason || 'Akses ditolak: Anda tidak memiliki penugasan pada ruang ini.');
      }
    }

    // Validasi kepemilikan peserta jika ada
    if (data.participantId && data.roomId) {
      const partCheck = await ProctorAuthorizationService.canAccessParticipant(
        user,
        examId,
        data.roomId,
        data.participantId,
        schoolId
      );
      if (!partCheck.allowed) {
        throw new Error(partCheck.reason || 'Akses ditolak: Peserta tidak berada pada ruang ujian Anda.');
      }
    }

    const res = await queryPostgres(
      `INSERT INTO proctor_notes (school_id, exam_id, room_id, participant_id, proctor_id, content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, content, created_at;`,
      [
        schoolId,
        examId,
        data.roomId || null,
        data.participantId || null,
        user.id,
        data.content.trim(),
      ]
    );

    const note = res.rows[0];

    // Audit log
    await queryPostgres(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, $3, 'PROCTOR_NOTE_CREATED', $4);`,
      [
        schoolId,
        user.id,
        user.role,
        JSON.stringify({
          noteId: note.id,
          examId,
          roomId: data.roomId,
          participantId: data.participantId,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    return note;
  }

  /**
   * Mengambil catatan pengawas pada ujian / ruang / peserta tertentu.
   */
  static async getNotes(
    user: SessionUser,
    schoolId: string,
    examId: string,
    participantId?: string
  ) {
    let query = `
      SELECT pn.id, pn.content, pn.created_at,
             u.full_name as proctor_name,
             er.name as room_name,
             s.full_name as student_name
      FROM proctor_notes pn
      JOIN users u ON pn.proctor_id = u.id
      LEFT JOIN exam_rooms er ON pn.room_id = er.id
      LEFT JOIN exam_participants ep ON pn.participant_id = ep.id
      LEFT JOIN students s ON ep.student_id = s.id
      WHERE pn.exam_id = $1 AND pn.school_id = $2
    `;

    const params: any[] = [examId, schoolId];
    if (participantId) {
      query += ` AND pn.participant_id = $3`;
      params.push(participantId);
    }

    query += ` ORDER BY pn.created_at DESC;`;

    const res = await queryPostgres(query, params);
    return res.rows.map((r) => ({
      id: r.id,
      content: r.content,
      createdAt: r.created_at,
      proctorName: r.proctor_name,
      roomName: r.room_name,
      studentName: r.student_name,
    }));
  }
}
