import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak valid.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let sql = `
      SELECT id, report_type, format, status, file_name, file_size_bytes,
             error_message, created_at, completed_at, expires_at
      FROM export_jobs
      WHERE school_id = $1
    `;
    const params: any[] = [schoolId];

    if (auth.user.role === 'GURU') {
      params.push(auth.user.id);
      sql += ` AND requested_by = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1};`;
    params.push(limit);

    const res = await queryPostgres(sql, params);

    return NextResponse.json({
      success: true,
      data: res.rows,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat riwayat ekspor.' },
      { status: 500 }
    );
  }
}
