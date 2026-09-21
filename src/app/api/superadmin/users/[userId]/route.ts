import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireApiPermission('user.read');
  if (!auth.authorized) return auth.response;

  try {
    const { userId } = await params;

    // 1. Fetch User Profile
    const userRes = await queryPostgres(
      `SELECT 
         u.id, 
         u.username, 
         u.full_name, 
         u.role, 
         u.school_id, 
         s.name as school_name, 
         s.code as school_code,
         u.is_active, 
         u.nip, 
         u.session_version, 
         u.must_change_password, 
         u.failed_login_attempts, 
         u.locked_until, 
         u.last_login_at, 
         u.created_at, 
         u.updated_at
       FROM users u
       LEFT JOIN schools s ON u.school_id = s.id
       WHERE u.id = $1
       LIMIT 1;`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Pengguna tidak ditemukan.' }, { status: 404 });
    }

    const row = userRes.rows[0];

    // 2. Fetch Active Sessions
    const sessionsRes = await queryPostgres(
      `SELECT 
         id, 
         device_name, 
         browser, 
         ip_address, 
         session_version, 
         created_at, 
         last_activity_at, 
         expires_at, 
         is_revoked
       FROM user_sessions
       WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()
       ORDER BY last_activity_at DESC;`,
      [userId]
    ).catch(() => ({ rows: [] }));

    // 3. Fetch Recent Audit Activity
    const auditRes = await queryPostgres(
      `SELECT 
         id, 
         action, 
         severity, 
         created_at, 
         ip_address, 
         user_agent, 
         details_json
       FROM audit_logs
       WHERE user_id = $1 OR (details_json->>'targetUserId') = $1
       ORDER BY created_at DESC
       LIMIT 10;`,
      [userId]
    ).catch(() => ({ rows: [] }));

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: row.id,
          username: row.username,
          fullName: row.full_name,
          role: row.role,
          schoolId: row.school_id,
          schoolName: row.school_name,
          schoolCode: row.school_code,
          isActive: Boolean(row.is_active),
          nip: row.nip,
          sessionVersion: row.session_version || 1,
          mustChangePassword: Boolean(row.must_change_password),
          failedLoginAttempts: row.failed_login_attempts || 0,
          lockedUntil: row.locked_until,
          lastLoginAt: row.last_login_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        sessions: sessionsRes.rows.map((s) => ({
          id: s.id,
          deviceName: s.device_name || 'Browser Web',
          browser: s.browser || 'Unknown',
          ipAddress: s.ip_address || '127.0.0.1',
          sessionVersion: s.session_version,
          createdAt: s.created_at,
          lastActivityAt: s.last_activity_at,
          expiresAt: s.expires_at,
        })),
        auditLogs: auditRes.rows.map((a) => ({
          id: a.id,
          action: a.action,
          severity: a.severity,
          createdAt: a.created_at,
          ipAddress: a.ip_address,
          userAgent: a.user_agent,
          details: a.details_json,
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat profil pengguna.' },
      { status: 500 }
    );
  }
}
