import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const auth = await requireApiAuth(['ADMIN', 'SUPER_ADMIN'], searchParams);
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks satuan pendidikan tidak ditemukan.' },
        { status: 400 }
      );
    }

    const actionFilter = searchParams.get('action')?.trim() || '';
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    let query = `
      SELECT al.*, u.username, u.full_name as user_full_name, s.name as school_name, s.code as school_code
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN schools s ON al.school_id = s.id
      WHERE al.school_id = $1
    `;
    const params: any[] = [schoolId];

    if (actionFilter) {
      params.push(actionFilter);
      query += ` AND al.action = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (al.action ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR al.details_json::text ILIKE $${params.length})`;
    }

    // Count total query
    const countRes = await queryPostgres(
      `SELECT COUNT(*)::int as total FROM (${query}) AS subq;`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);

    const res = await queryPostgres(query, params);

    return NextResponse.json({
      success: true,
      data: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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
          schoolName: r.school_name || 'Sekolah Terdaftar',
          schoolCode: r.school_code,
          createdAt: r.created_at,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat log audit sekolah.' },
      { status: 500 }
    );
  }
}
