import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  const auth = await requireApiAuth(['GURU', 'ADMIN', 'SUPER_ADMIN']);
  if (!auth.authorized) return auth.response;

  try {
    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const classId = url.searchParams.get('classId') || '';

    // Hanya ambil siswa dari kelas-kelas yang diampu oleh guru ini
    let sql = `
      SELECT DISTINCT s.id, s.nis, s.nisn, s.full_name, s.gender, s.status,
             c.id as class_id, c.name as class_name
      FROM students s
      JOIN class_rooms c ON s.class_room_id = c.id
      JOIN teacher_classes tc ON c.id = tc.class_room_id
      WHERE s.school_id = $1 AND s.is_active = true
    `;
    const params: any[] = [schoolId];

    if (auth.user.role !== 'SUPER_ADMIN' && auth.user.role !== 'ADMIN') {
      params.push(auth.user.id);
      sql += ` AND tc.teacher_id = $${params.length}`;
    }

    if (classId) {
      params.push(classId);
      sql += ` AND s.class_room_id = $${params.length}`;
    }

    if (search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (s.full_name ILIKE $${params.length} OR s.nis ILIKE $${params.length} OR s.nisn ILIKE $${params.length})`;
    }

    sql += ` ORDER BY c.name ASC, s.full_name ASC LIMIT 100;`;

    const res = await queryPostgres(sql, params);

    return NextResponse.json({
      success: true,
      students: res.rows.map((r) => ({
        id: r.id,
        nis: r.nis,
        nisn: r.nisn,
        fullName: r.full_name,
        gender: r.gender,
        status: r.status || 'ACTIVE',
        classId: r.class_id,
        className: r.class_name,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal mencari data siswa.' },
      { status: 500 }
    );
  }
}
