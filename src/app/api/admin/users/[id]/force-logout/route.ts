import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';
import { revokeAllUserSessions } from '@/lib/services/security.service';
import { validateCsrfOrigin } from '@/lib/core/csrf';
import { getClientIp } from '@/lib/core/rate-limit';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = validateCsrfOrigin(req);
  if (!csrf.valid) {
    return NextResponse.json(
      { success: false, error: csrf.error || 'Akses ditolak: Validasi CSRF gagal.' },
      { status: 403 }
    );
  }

  // Authorize actor: Superadmin or Admin
  const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN']);
  if (!auth.authorized) {
    return auth.response;
  }

  const actor = auth.user;
  const { id: targetUserId } = await params;

  // Requirement #14: User target tidak boleh force logout dirinya sendiri via endpoint admin
  if (actor.id === targetUserId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Anda tidak dapat melakukan force logout terhadap akun Anda sendiri melalui panel ini. Gunakan fitur Logout atau Revoke All Sessions.',
      },
      { status: 400 }
    );
  }

  try {
    // Validate target user exists and verify tenant boundary
    const targetRes = await queryPostgres(
      `SELECT id, username, role, school_id FROM users WHERE id = $1 LIMIT 1;`,
      [targetUserId]
    );

    if (targetRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Pengguna target tidak ditemukan.' }, { status: 404 });
    }

    const targetUser = targetRes.rows[0];

    // Tenant Isolation Check: ADMIN cannot force logout users from another school or SUPER_ADMIN
    if (actor.role === 'ADMIN') {
      if (targetUser.role === 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Akses ditolak: Admin Sekolah tidak dapat me-logout Super Administrator.' },
          { status: 403 }
        );
      }
      if (targetUser.school_id !== actor.schoolId) {
        return NextResponse.json(
          { success: false, error: 'Akses ditolak: Anda hanya dapat melakukan force logout pada pengguna di sekolah Anda sendiri.' },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const reason = body.reason || `Force logout oleh ${actor.role} (${actor.fullName})`;

    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const result = await revokeAllUserSessions(targetUserId, reason, {
      id: actor.id,
      role: actor.role,
      fullName: actor.fullName,
      ip: clientIp,
      userAgent,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal melakukan force logout pengguna.' },
      { status: 500 }
    );
  }
}
