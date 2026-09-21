import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN'], searchParams);
    if (!auth.authorized) return auth.response;

    const actionFilter = searchParams.get('action')?.trim() || '';
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));

    let query = `
      SELECT al.*, u.username, u.full_name as user_full_name, s.name as school_name, s.code as school_code
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN schools s ON al.school_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Tenant boundary
    if (auth.tenant.schoolId) {
      params.push(auth.tenant.schoolId);
      query += ` AND al.school_id = $${params.length}`;
    }

    if (actionFilter) {
      params.push(actionFilter);
      query += ` AND al.action = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (al.action ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR al.details_json::text ILIKE $${params.length})`;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1};`;
    params.push(limit);

    const res = await queryPostgres(query, params);

    const schoolsRes = await queryPostgres(`SELECT id, name, code FROM schools WHERE is_active = true ORDER BY name ASC;`);

    return NextResponse.json({
      success: true,
      data: {
        logs: res.rows.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          userFullName: r.user_full_name || 'Sistem / Pengguna Terhapus',
          username: r.username,
          role: r.role,
          action: r.action,
          details: r.details_json || {},
          ipAddress: r.ip_address,
          schoolId: r.school_id,
          schoolName: r.school_name || 'Semua Satuan Pendidikan (Global)',
          schoolCode: r.school_code,
          createdAt: r.created_at,
        })),
        schools: schoolsRes.rows,
        total: res.rows.length,
        isSuperAdmin: auth.tenant.isSuperAdmin,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat riwayat audit forensik.' },
      { status: 500 }
    );
  }
}
