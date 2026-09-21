import { queryPostgres } from '../core/postgres';
import { User, UserRole } from '../core/types';
import { hashPassword } from '../core/auth';
import { assertNotSuperAdminTarget, assertNotLastSchoolAdmin } from '../core/rbac';
import { AuditService } from './audit.service';

export class SchoolUserService {
  /**
   * Mengambil daftar user dalam lingkup sekolah tertentu.
   * SUPER_ADMIN secara otomatis di-filter keluar agar tidak tampak oleh Admin Sekolah.
   */
  static async listUsers(
    schoolId: string,
    filters?: {
      role?: UserRole;
      search?: string;
      isActive?: boolean;
    }
  ): Promise<User[]> {
    let sql = `
      SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.created_at, 
             u.nip, u.nuptk, u.phone, u.school_id, u.last_login_at, u.session_version,
             s.name as school_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE u.school_id = $1 AND u.role != 'SUPER_ADMIN'
    `;
    const params: any[] = [schoolId];

    if (filters?.role) {
      params.push(filters.role);
      sql += ` AND u.role = $${params.length}`;
    }

    if (filters?.isActive !== undefined) {
      params.push(filters.isActive);
      sql += ` AND u.is_active = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.nip ILIKE $${params.length})`;
    }

    sql += ` ORDER BY u.role ASC, u.full_name ASC;`;

    const res = await queryPostgres(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      role: r.role as UserRole,
      schoolId: r.school_id,
      schoolName: r.school_name,
      nip: r.nip,
      nuptk: r.nuptk,
      phone: r.phone,
      isActive: r.is_active,
      sessionVersion: r.session_version,
      lastLoginAt: r.last_login_at,
      createdAt: r.created_at,
    }));
  }

  /**
   * Mengambil detail user berdasarkan ID dan schoolId.
   */
  static async getUserById(schoolId: string, userId: string): Promise<User | null> {
    const res = await queryPostgres(
      `SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.created_at, 
              u.nip, u.nuptk, u.phone, u.school_id, u.last_login_at, u.session_version,
              s.name as school_name
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.id = $1 AND u.school_id = $2 AND u.role != 'SUPER_ADMIN'
       LIMIT 1;`,
      [userId, schoolId]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      role: r.role as UserRole,
      schoolId: r.school_id,
      schoolName: r.school_name,
      nip: r.nip,
      nuptk: r.nuptk,
      phone: r.phone,
      isActive: r.is_active,
      sessionVersion: r.session_version,
      lastLoginAt: r.last_login_at,
      createdAt: r.created_at,
    };
  }

  /**
   * Membuat user baru di sekolah (ADMIN, GURU, PENGAWAS).
   * Dilarang membuat SUPER_ADMIN.
   */
  static async createUser(
    schoolId: string,
    data: {
      username: string;
      fullName: string;
      role: UserRole;
      password: string;
      nip?: string;
      nuptk?: string;
      phone?: string;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<User> {
    assertNotSuperAdminTarget(data.role);

    const cleanUsername = data.username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Username minimal 3 karakter.');
    }
    if (!data.fullName || data.fullName.trim().length < 2) {
      throw new Error('Nama lengkap wajib diisi.');
    }
    if (!data.password || data.password.length < 6) {
      throw new Error('Password minimal 6 karakter.');
    }

    // Cek duplikasi username
    const existing = await queryPostgres('SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1;', [cleanUsername]);
    if (existing.rows.length > 0) {
      throw new Error(`Username '${cleanUsername}' sudah digunakan. Silakan gunakan username lain.`);
    }

    const passwordHash = await hashPassword(data.password);

    const res = await queryPostgres(
      `INSERT INTO users (
        id, school_id, username, password_hash, full_name, role, is_active, nip, nuptk, phone, session_version
       ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5, true, $6, $7, $8, 0
       ) RETURNING id, username, full_name, role, is_active, school_id, nip, nuptk, phone, created_at;`,
      [
        schoolId,
        cleanUsername,
        passwordHash,
        data.fullName.trim(),
        data.role,
        data.nip?.trim() || null,
        data.nuptk?.trim() || null,
        data.phone?.trim() || null,
      ]
    );

    const created = res.rows[0];

    // Audit log
    await AuditService.createLog({
      action: 'USER_CREATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'USER',
      resourceId: created.id,
      details: { username: cleanUsername, role: data.role, fullName: data.fullName },
    });

    return {
      id: created.id,
      username: created.username,
      fullName: created.full_name,
      role: created.role as UserRole,
      schoolId: created.school_id,
      nip: created.nip,
      nuptk: created.nuptk,
      phone: created.phone,
      isActive: created.is_active,
      createdAt: created.created_at,
    };
  }

  /**
   * Mengubah data profil user sekolah.
   */
  static async updateUser(
    schoolId: string,
    userId: string,
    data: {
      fullName?: string;
      nip?: string;
      nuptk?: string;
      phone?: string;
      role?: UserRole;
    },
    actor: { id: string; username: string; role: string }
  ): Promise<User> {
    if (data.role) {
      assertNotSuperAdminTarget(data.role);
    }

    const targetUser = await this.getUserById(schoolId, userId);
    if (!targetUser) {
      throw new Error('Pengguna tidak ditemukan di sekolah ini.');
    }

    // Jika mengubah role dari ADMIN ke role lain, pastikan bukan admin terakhir
    if (targetUser.role === 'ADMIN' && data.role && data.role !== 'ADMIN') {
      await assertNotLastSchoolAdmin(schoolId, userId);
    }

    const res = await queryPostgres(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        nip = COALESCE($2, nip),
        nuptk = COALESCE($3, nuptk),
        phone = COALESCE($4, phone),
        role = COALESCE($5, role)
       WHERE id = $6 AND school_id = $7
       RETURNING *;`,
      [
        data.fullName?.trim(),
        data.nip?.trim(),
        data.nuptk?.trim(),
        data.phone?.trim(),
        data.role,
        userId,
        schoolId,
      ]
    );

    // Audit log
    await AuditService.createLog({
      action: 'USER_UPDATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'USER',
      resourceId: userId,
      details: {
        targetUsername: targetUser.username,
        updatedFields: Object.keys(data).filter((k) => (data as any)[k] !== undefined),
      },
    });

    return (await this.getUserById(schoolId, userId))!;
  }

  /**
   * Mengubah status aktif user (Toggle Active / Disable).
   * Dilengkapi proteksi Last School Admin.
   */
  static async setUserStatus(
    schoolId: string,
    userId: string,
    isActive: boolean,
    actor: { id: string; username: string; role: string }
  ): Promise<{ success: boolean; message: string }> {
    const targetUser = await this.getUserById(schoolId, userId);
    if (!targetUser) {
      throw new Error('Pengguna tidak ditemukan di sekolah ini.');
    }

    if (!isActive && targetUser.role === 'ADMIN') {
      await assertNotLastSchoolAdmin(schoolId, userId);
    }

    // Jika dinonaktifkan, inkrementasikan session_version agar seluruh token aktif hangus
    const sessionIncrement = !isActive ? 1 : 0;

    await queryPostgres(
      `UPDATE users SET 
        is_active = $1,
        session_version = session_version + $2
       WHERE id = $3 AND school_id = $4;`,
      [isActive, sessionIncrement, userId, schoolId]
    );

    await AuditService.createLog({
      action: isActive ? 'USER_ENABLED' : 'USER_DISABLED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'USER',
      resourceId: userId,
      details: { targetUsername: targetUser.username, targetRole: targetUser.role },
      severity: isActive ? 'INFO' : 'WARNING',
    });

    return {
      success: true,
      message: `Akun '${targetUser.fullName}' berhasil ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
    };
  }

  /**
   * Reset password user sekolah dan cabut sesi aktif.
   */
  static async resetPassword(
    schoolId: string,
    userId: string,
    newPassword: string,
    actor: { id: string; username: string; role: string }
  ): Promise<{ success: boolean; message: string }> {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password baru minimal 6 karakter.');
    }

    const targetUser = await this.getUserById(schoolId, userId);
    if (!targetUser) {
      throw new Error('Pengguna tidak ditemukan di sekolah ini.');
    }

    const hash = await hashPassword(newPassword);

    // Update password dan inkrementasikan session_version
    await queryPostgres(
      `UPDATE users SET 
        password_hash = $1,
        session_version = session_version + 1,
        must_change_password = true
       WHERE id = $2 AND school_id = $3;`,
      [hash, userId, schoolId]
    );

    await AuditService.createLog({
      action: 'PASSWORD_RESET',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'USER',
      resourceId: userId,
      details: { targetUsername: targetUser.username },
      severity: 'WARNING',
    });

    return {
      success: true,
      message: `Password untuk akun '${targetUser.username}' berhasil di-reset. Sesi pengguna telah dicabut.`,
    };
  }

  /**
   * Force logout / Revoke all sessions untuk user tertentu.
   */
  static async revokeUserSessions(
    schoolId: string,
    userId: string,
    actor: { id: string; username: string; role: string }
  ): Promise<{ success: boolean; message: string }> {
    const targetUser = await this.getUserById(schoolId, userId);
    if (!targetUser) {
      throw new Error('Pengguna tidak ditemukan di sekolah ini.');
    }

    await queryPostgres(
      `UPDATE users SET session_version = session_version + 1 WHERE id = $1 AND school_id = $2;`,
      [userId, schoolId]
    );

    // Revoke di user_sessions jika ada
    await queryPostgres(
      `UPDATE user_sessions SET is_revoked = true, revoked_reason = 'REVOKED_BY_SCHOOL_ADMIN' WHERE user_id = $1;`,
      [userId]
    ).catch(() => {});

    await AuditService.createLog({
      action: 'SESSION_REVOKED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'USER',
      resourceId: userId,
      details: { targetUsername: targetUser.username },
    });

    return {
      success: true,
      message: `Seluruh sesi aktif untuk '${targetUser.fullName}' berhasil dicabut.`,
    };
  }

  /**
   * Menghapus user sekolah.
   * Dilengkapi proteksi Last School Admin.
   */
  static async deleteUser(
    schoolId: string,
    userId: string,
    actor: { id: string; username: string; role: string }
  ): Promise<{ success: boolean; message: string }> {
    const targetUser = await this.getUserById(schoolId, userId);
    if (!targetUser) {
      throw new Error('Pengguna tidak ditemukan di sekolah ini.');
    }

    if (targetUser.role === 'ADMIN') {
      await assertNotLastSchoolAdmin(schoolId, userId);
    }

    await queryPostgres(`DELETE FROM users WHERE id = $1 AND school_id = $2;`, [userId, schoolId]);

    await AuditService.createLog({
      action: 'USER_DELETED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'USER',
      resourceId: userId,
      details: { targetUsername: targetUser.username, targetRole: targetUser.role },
      severity: 'WARNING',
    });

    return {
      success: true,
      message: `Akun '${targetUser.fullName}' berhasil dihapus.`,
    };
  }
}
