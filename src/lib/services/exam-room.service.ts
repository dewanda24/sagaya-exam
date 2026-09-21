import { queryPostgres, withTransaction } from '../core/postgres';
import { ExamRoom } from '../core/types';
import { AuditService } from './audit.service';

export class ExamRoomService {
  /**
   * Mengambil daftar ruang ujian di sekolah.
   */
  static async listRooms(schoolId: string): Promise<ExamRoom[]> {
    const res = await queryPostgres(
      `SELECT r.*,
              (SELECT COUNT(*) FROM exam_participants ep WHERE ep.room_id = r.id) as participant_count
       FROM exam_rooms r
       WHERE r.school_id = $1
       ORDER BY r.code ASC;`,
      [schoolId]
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      schoolId: r.school_id,
      code: r.code,
      name: r.name,
      capacity: r.capacity,
      proctorName: r.proctor_name || '-',
      location: r.location || '',
      isActive: r.is_active !== false,
      participantCount: parseInt(r.participant_count || '0', 10),
      createdAt: r.created_at,
    }));
  }

  /**
   * Mengambil detail satu ruang ujian.
   */
  static async getRoomById(schoolId: string, roomId: string): Promise<ExamRoom | null> {
    const list = await this.listRooms(schoolId);
    return list.find((r) => r.id === roomId) || null;
  }

  /**
   * Membuat ruang ujian baru.
   */
  static async createRoom(
    schoolId: string,
    data: {
      code: string;
      name: string;
      capacity: number;
      location?: string;
      proctorName?: string;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<ExamRoom> {
    const cleanCode = data.code.trim().toUpperCase();
    const cleanName = data.name.trim();

    if (!cleanCode || !cleanName) {
      throw new Error('Kode ruang dan nama ruang ujian wajib diisi.');
    }
    if (!data.capacity || data.capacity <= 0) {
      throw new Error('Kapasitas ruang harus lebih dari 0.');
    }

    const check = await queryPostgres(
      `SELECT id FROM exam_rooms WHERE school_id = $1 AND UPPER(code) = $2 LIMIT 1;`,
      [schoolId, cleanCode]
    );
    if (check.rows.length > 0) {
      throw new Error(`Kode ruang '${cleanCode}' sudah digunakan.`);
    }

    const res = await queryPostgres(
      `INSERT INTO exam_rooms (id, school_id, code, name, capacity, location, proctor_name, is_active)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, true)
       RETURNING *;`,
      [schoolId, cleanCode, cleanName, data.capacity, data.location?.trim() || null, data.proctorName?.trim() || '-']
    );

    const created = res.rows[0];

    await AuditService.createLog({
      action: 'EXAM_ROOM_CREATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'EXAM_ROOM',
      resourceId: created.id,
      details: { code: cleanCode, name: cleanName, capacity: data.capacity },
    });

    return {
      id: created.id,
      schoolId: created.school_id,
      code: created.code,
      name: created.name,
      capacity: created.capacity,
      location: created.location,
      proctorName: created.proctor_name,
      isActive: created.is_active,
      participantCount: 0,
      createdAt: created.created_at,
    };
  }

  /**
   * Update ruang ujian.
   */
  static async updateRoom(
    schoolId: string,
    roomId: string,
    data: {
      code?: string;
      name?: string;
      capacity?: number;
      location?: string;
      proctorName?: string;
      isActive?: boolean;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<ExamRoom> {
    const existing = await this.getRoomById(schoolId, roomId);
    if (!existing) {
      throw new Error('Ruang ujian tidak ditemukan.');
    }

    await queryPostgres(
      `UPDATE exam_rooms SET
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        capacity = COALESCE($3, capacity),
        location = COALESCE($4, location),
        proctor_name = COALESCE($5, proctor_name),
        is_active = COALESCE($6, is_active)
       WHERE id = $7 AND school_id = $8;`,
      [
        data.code?.trim().toUpperCase(),
        data.name?.trim(),
        data.capacity,
        data.location?.trim(),
        data.proctorName?.trim(),
        data.isActive,
        roomId,
        schoolId,
      ]
    );

    await AuditService.createLog({
      action: 'EXAM_ROOM_UPDATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'EXAM_ROOM',
      resourceId: roomId,
      details: { code: data.code, name: data.name, capacity: data.capacity },
    });

    return (await this.getRoomById(schoolId, roomId))!;
  }

  /**
   * Plotting peserta ujian ke ruang dan nomor meja.
   * Validasi kapasitas: jumlah peserta <= kapasitas ruang!
   */
  static async allocateParticipantsToRoom(
    schoolId: string,
    examId: string,
    roomId: string,
    sessionNumber: number,
    participantIds: string[],
    actor: { id: string; username: string; role: string }
  ): Promise<{ allocatedCount: number }> {
    const room = await this.getRoomById(schoolId, roomId);
    if (!room) {
      throw new Error('Ruang ujian tidak ditemukan.');
    }

    if (participantIds.length > room.capacity) {
      throw new Error(
        `Kapasitas ruang terlampaui! Ruang '${room.name}' hanya memuat ${room.capacity} peserta, sedangkan Anda memilih ${participantIds.length} peserta.`
      );
    }

    return await withTransaction(async (client) => {
      let seat = 1;
      for (const pId of participantIds) {
        const seatStr = seat < 10 ? `0${seat}` : String(seat);
        await client.query(
          `UPDATE exam_participants SET
            room_id = $1,
            session_number = $2,
            seat_number = $3
           WHERE id = $4 AND exam_id = $5;`,
          [roomId, sessionNumber, seatStr, pId, examId]
        );
        seat++;
      }

      await AuditService.createLog({
        action: 'PARTICIPANTS_ALLOCATED_TO_ROOM',
        schoolId,
        actor: { id: actor.id, username: actor.username, role: actor.role },
        resourceType: 'EXAM_ROOM',
        resourceId: roomId,
        details: { roomName: room.name, sessionNumber, allocatedCount: participantIds.length },
      });

      return { allocatedCount: participantIds.length };
    });
  }

  /**
   * Menugaskan pengawas ruang dengan deteksi konflik jadwal (Conflict Detection).
   * Mencegah pengawas bertugas ganda pada rentang waktu ujian yang sama!
   */
  static async assignRoomProctor(
    schoolId: string,
    examId: string,
    roomId: string,
    sessionNumber: number,
    proctorId: string,
    notes: string | undefined,
    actor: { id: string; username: string; role: string }
  ): Promise<void> {
    // Validasi bahwa pengawas berasal dari sekolah yang sama dan berstatus aktif
    const proctorRes = await queryPostgres(
      `SELECT id, full_name FROM users WHERE id = $1 AND school_id = $2 AND role = 'PENGAWAS' AND is_active = true;`,
      [proctorId, schoolId]
    );
    if (proctorRes.rows.length === 0) {
      throw new Error('Pengawas tidak ditemukan atau tidak aktif di sekolah ini.');
    }
    const proctorName = proctorRes.rows[0].full_name;

    // Ambil rentang waktu ujian target
    const targetExamRes = await queryPostgres(
      `SELECT id, title, start_time, end_time FROM exams WHERE id = $1 AND school_id = $2;`,
      [examId, schoolId]
    );
    if (targetExamRes.rows.length === 0) {
      throw new Error('Ujian tidak ditemukan.');
    }
    const targetExam = targetExamRes.rows[0];

    // Deteksi bentrok jadwal pengawas pada ujian lain di sekolah yang sama
    const conflictRes = await queryPostgres(
      `SELECT erp.id, e.title as conflicting_exam, r.name as conflicting_room
       FROM exam_room_proctors erp
       JOIN exams e ON erp.exam_id = e.id
       JOIN exam_rooms r ON erp.room_id = r.id
       WHERE erp.proctor_id = $1 
         AND erp.session_number = $2
         AND e.school_id = $3
         AND e.id != $4
         AND (
           (e.start_time <= $5 AND e.end_time >= $5) OR
           (e.start_time <= $6 AND e.end_time >= $6) OR
           (e.start_time >= $5 AND e.end_time <= $6)
         )
       LIMIT 1;`,
      [proctorId, sessionNumber, schoolId, examId, targetExam.start_time, targetExam.end_time]
    );

    if (conflictRes.rows.length > 0) {
      const c = conflictRes.rows[0];
      throw new Error(
        `Bentrok Jadwal Pengawas: '${proctorName}' sudah ditugaskan pada ujian '${c.conflicting_exam}' di ruang '${c.conflicting_room}' pada rentang waktu yang sama!`
      );
    }

    await queryPostgres(
      `INSERT INTO exam_room_proctors (id, exam_id, room_id, session_number, proctor_id, notes)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5)
       ON CONFLICT (exam_id, room_id, session_number)
       DO UPDATE SET
        proctor_id = EXCLUDED.proctor_id,
        notes = EXCLUDED.notes;`,
      [examId, roomId, sessionNumber, proctorId, notes || null]
    );

    await AuditService.createLog({
      action: 'PROCTOR_ASSIGNED_TO_ROOM',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'EXAM_ROOM',
      resourceId: roomId,
      details: { proctorName, examTitle: targetExam.title, sessionNumber },
    });
  }
}
