import { queryPostgres } from '../core/postgres';
import { User } from '../core/types';
import { hashPassword } from '../core/auth';
import { AuditService } from './audit.service';

export class ProctorService {
  /**
   * Mengambil daftar pengawas di sekolah beserta riwayat dan jadwal ruang pengawasannya.
   */
  static async listProctors(
    schoolId: string,
    filters?: {
      search?: string;
      isActive?: boolean;
    }
  ): Promise<(User & { assignedRoomCount: number })[]> {
    let sql = `
      SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.created_at, 
             u.nip, u.nuptk, u.phone, u.school_id, u.last_login_at, u.session_version,
             s.name as school_name,
             (SELECT COUNT(*) FROM exam_room_proctors erp WHERE erp.proctor_id = u.id) as assigned_room_count
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE u.school_id = $1 AND u.role = 'PENGAWAS'
    `;
    const params: any[] = [schoolId];

    if (filters?.isActive !== undefined) {
      params.push(filters.isActive);
      sql += ` AND u.is_active = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.nip ILIKE $${params.length})`;
    }

    sql += ` ORDER BY u.full_name ASC;`;

    const res = await queryPostgres(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      role: r.role,
      schoolId: r.school_id,
      schoolName: r.school_name,
      nip: r.nip,
      nuptk: r.nuptk,
      phone: r.phone,
      isActive: r.is_active,
      sessionVersion: r.session_version,
      lastLoginAt: r.last_login_at,
      createdAt: r.created_at,
      assignedRoomCount: parseInt(r.assigned_room_count || '0', 10),
    }));
  }

  /**
   * Membuat akun pengawas baru.
   */
  static async createProctor(
    schoolId: string,
    data: {
      username: string;
      fullName: string;
      password: string;
      nip?: string;
      phone?: string;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<User> {
    const cleanUsername = data.username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Username pengawas minimal 3 karakter.');
    }
    if (!data.fullName || data.fullName.trim().length < 2) {
      throw new Error('Nama lengkap pengawas wajib diisi.');
    }
    if (!data.password || data.password.length < 6) {
      throw new Error('Password minimal 6 karakter.');
    }

    const check = await queryPostgres('SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1;', [cleanUsername]);
    if (check.rows.length > 0) {
      throw new Error(`Username '${cleanUsername}' sudah digunakan.`);
    }

    const passwordHash = await hashPassword(data.password);

    const res = await queryPostgres(
      `INSERT INTO users (
        id, school_id, username, password_hash, full_name, role, is_active, nip, phone, session_version
       ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, 'PENGAWAS', true, $5, $6, 0
       ) RETURNING *;`,
      [schoolId, cleanUsername, passwordHash, data.fullName.trim(), data.nip?.trim() || null, data.phone?.trim() || null]
    );

    const created = res.rows[0];

    await AuditService.createLog({
      action: 'PROCTOR_CREATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'PROCTOR',
      resourceId: created.id,
      details: { username: cleanUsername, fullName: data.fullName },
    });

    return {
      id: created.id,
      username: created.username,
      fullName: created.full_name,
      role: created.role,
      schoolId: created.school_id,
      nip: created.nip,
      phone: created.phone,
      isActive: created.is_active,
      createdAt: created.created_at,
    };
  }

  /**
   * Mengambil riwayat pengawasan ruang ujian oleh pengawas.
   */
  static async getProctorAssignments(schoolId: string, proctorId: string) {
    const res = await queryPostgres(
      `SELECT erp.*, r.name as room_name, r.code as room_code, e.title as exam_title,
              e.start_time, e.end_time, e.status as exam_status
       FROM exam_room_proctors erp
       JOIN exam_rooms r ON erp.room_id = r.id
       JOIN exams e ON erp.exam_id = e.id
       WHERE erp.proctor_id = $1 AND r.school_id = $2
       ORDER BY e.start_time DESC;`,
      [proctorId, schoolId]
    );

    return res.rows.map((r: any) => ({
      id: r.id,
      examId: r.exam_id,
      examTitle: r.exam_title,
      examStatus: r.exam_status,
      startTime: r.start_time,
      endTime: r.end_time,
      roomId: r.room_id,
      roomName: r.room_name,
      roomCode: r.room_code,
      sessionNumber: r.session_number,
      notes: r.notes,
      createdAt: r.created_at,
    }));
  }
}
