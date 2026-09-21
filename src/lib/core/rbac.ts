import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken, SessionUser } from './auth';
import { getTenantContext, TenantContext } from './tenant';
import { queryPostgres } from './postgres';
import { UserRole } from './types';
import { Permission, hasPermission } from './permissions';

export interface AuthResult {
  user: SessionUser;
  tenant: TenantContext;
}

export type RequireAuthReturn =
  | { authorized: true; user: SessionUser; tenant: TenantContext; response?: null }
  | { authorized: false; user?: null; tenant?: null; response: NextResponse };

/**
 * Memeriksa status tenant (sekolah) secara terpusat.
 * Jika sekolah berstatus SUSPENDED atau ARCHIVED, pengguna non-SUPER_ADMIN ditolak.
 */
export async function verifyTenantStatus(
  schoolId: string | null
): Promise<{ allowed: boolean; status?: string; error?: string }> {
  if (!schoolId) return { allowed: true };

  try {
    const res = await queryPostgres(
      `SELECT status, is_active, name FROM schools WHERE id = $1 LIMIT 1;`,
      [schoolId]
    );
    if (!res || res.rows.length === 0) {
      return { allowed: false, error: 'Satuan pendidikan tidak ditemukan di database.' };
    }
    const school = res.rows[0];
    const status = (school.status || (school.is_active ? 'ACTIVE' : 'SUSPENDED')).toUpperCase();

    if (status === 'SUSPENDED') {
      return {
        allowed: false,
        status: 'SUSPENDED',
        error: `Akses ditolak: Satuan pendidikan '${school.name}' sedang ditangguhkan (SUSPENDED). Hubungi Superadmin Platform.`,
      };
    }

    if (status === 'ARCHIVED') {
      return {
        allowed: false,
        status: 'ARCHIVED',
        error: `Akses ditolak: Satuan pendidikan '${school.name}' telah diarsipkan (ARCHIVED).`,
      };
    }

    return { allowed: true, status: 'ACTIVE' };
  } catch (err: any) {
    return { allowed: false, error: err.message || 'Gagal memverifikasi status sekolah.' };
  }
}

/**
 * Validasi otentikasi dan otorisasi role untuk API endpoints.
 * @param allowedRoles Daftar role yang diizinkan (jika kosong, semua role terotentikasi diizinkan)
 * @param searchParams URLSearchParams opsional untuk tenant switcher Super Admin
 */
export async function requireApiAuth(
  allowedRoles?: UserRole[],
  searchParams?: URLSearchParams
): Promise<RequireAuthReturn> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;

    if (!token) {
      return {
        authorized: false,
        response: NextResponse.json(
          { success: false, error: 'Unauthorized: Sesi tidak ditemukan atau telah kedaluwarsa.' },
          { status: 401 }
        ),
      };
    }

    const user = await verifySessionToken(token);

    if (!user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { success: false, error: 'Unauthorized: Sesi tidak valid atau telah berakhir.' },
          { status: 401 }
        ),
      };
    }

    // Server-Side Revocation & Active Check (session_version & is_active)
    const dbUserRes = await queryPostgres(
      `SELECT is_active, COALESCE(session_version, 0) as session_version FROM users WHERE id = $1 LIMIT 1;`,
      [user.id]
    ).catch(() => null);

    if (dbUserRes && dbUserRes.rows.length > 0) {
      const dbUser = dbUserRes.rows[0];
      if (dbUser.is_active === false) {
        return {
          authorized: false,
          response: NextResponse.json(
            { success: false, error: 'Unauthorized: Akun pengguna telah dinonaktifkan oleh administrator.' },
            { status: 401 }
          ),
        };
      }
      if (dbUser.session_version > (user.sessionVersion ?? 0)) {
        return {
          authorized: false,
          response: NextResponse.json(
            { success: false, error: 'Unauthorized: Sesi telah dicabut karena perubahan keamanan. Silakan login kembali.' },
            { status: 401 }
          ),
        };
      }
    }

    // Role-Based Authorization
    if (allowedRoles && allowedRoles.length > 0) {
      // SUPER_ADMIN has master privileges
      if (user.role !== 'SUPER_ADMIN' && !allowedRoles.includes(user.role)) {
        return {
          authorized: false,
          response: NextResponse.json(
            {
              success: false,
              error: `Forbidden: Peran '${user.role}' tidak memiliki izin untuk mengakses resource ini.`,
            },
            { status: 403 }
          ),
        };
      }
    }

    // Tenant Status Policy Check (Non-Superadmin)
    if (user.role !== 'SUPER_ADMIN' && user.schoolId) {
      const tenantStatus = await verifyTenantStatus(user.schoolId);
      if (!tenantStatus.allowed) {
        return {
          authorized: false,
          response: NextResponse.json(
            {
              success: false,
              error: tenantStatus.error || 'Akses ditolak karena status sekolah tidak aktif.',
              code: 'TENANT_SUSPENDED',
            },
            { status: 403 }
          ),
        };
      }
    }

    const tenant = await getTenantContext(user, searchParams);

    return {
      authorized: true,
      user,
      tenant,
    };
  } catch (err: any) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: err.message || 'Gagal memverifikasi otentikasi.' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Validasi otentikasi dan otorisasi permission granular untuk API endpoints.
 * @param permission Permission yang dibutuhkan (misal: 'school.create', 'user.disable')
 * @param searchParams URLSearchParams opsional
 */
export async function requireApiPermission(
  permission: Permission,
  searchParams?: URLSearchParams
): Promise<RequireAuthReturn> {
  const auth = await requireApiAuth(undefined, searchParams);
  if (!auth.authorized) return auth;

  if (!hasPermission(auth.user.role, permission)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: `Forbidden: Peran '${auth.user.role}' tidak memiliki izin '${permission}'.`,
        },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/**
 * Memastikan akses strictly berlingkup tenant pengguna.
 * SUPER_ADMIN diizinkan mengakses semua sekolah.
 */
export function assertTenantOwnership(user: SessionUser, targetSchoolId: string | null | undefined): void {
  if (user.role === 'SUPER_ADMIN') return;
  if (!user.schoolId || !targetSchoolId || user.schoolId !== targetSchoolId) {
    throw new Error('Akses ditolak: Anda tidak memiliki izin untuk mengakses resource sekolah lain.');
  }
}

/**
 * Memastikan Admin Sekolah tidak dapat memanipulasi atau membuat SUPER_ADMIN.
 */
export function assertNotSuperAdminTarget(targetRole: UserRole | string | undefined): void {
  if (targetRole === 'SUPER_ADMIN') {
    throw new Error('Akses ditolak: Administrator Sekolah tidak diizinkan membuat, mengelola, atau mengubah role menjadi SUPER_ADMIN.');
  }
}

/**
 * Memastikan tidak dapat menghapus atau menonaktifkan akun Admin Sekolah terakhir.
 */
export async function assertNotLastSchoolAdmin(schoolId: string, targetUserId: string): Promise<void> {
  const check = await queryPostgres(
    `SELECT COUNT(*) as count FROM users WHERE school_id = $1 AND role = 'ADMIN' AND is_active = true AND id != $2;`,
    [schoolId, targetUserId]
  );
  const remaining = parseInt(check.rows[0]?.count || '0', 10);
  if (remaining < 1) {
    throw new Error('Akses ditolak: Tindakan dicegah karena sekolah harus memiliki minimal satu Administrator aktif.');
  }
}

