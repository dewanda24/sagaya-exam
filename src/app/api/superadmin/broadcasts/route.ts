import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken } from '@/lib/core/auth';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden: Khusus Super Admin' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';

    let query = `
      SELECT 
        b.*,
        s.name as target_school_name,
        s.code as target_school_code,
        u.full_name as author_name
      FROM broadcast_announcements b
      LEFT JOIN schools s ON b.target_school_id = s.id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (LOWER(b.title) LIKE $${params.length} OR LOWER(b.message) LIKE $${params.length})`;
    }

    query += ` ORDER BY b.created_at DESC;`;

    const res = await queryPostgres(query, params);

    const broadcasts = res.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      priority: r.priority, // INFO, WARNING, URGENT
      targetAudience: r.target_audience, // ALL, ADMIN_ONLY, STUDENT_ONLY, SPECIFIC_SCHOOL
      targetSchoolId: r.target_school_id,
      targetSchoolName: r.target_school_name || null,
      targetSchoolCode: r.target_school_code || null,
      isActive: r.is_active,
      startAt: r.start_at,
      expiresAt: r.expires_at,
      authorName: r.author_name || 'Super Admin',
      createdAt: r.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: broadcasts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat daftar pengumuman.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Khusus Super Admin' }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      message,
      priority = 'INFO',
      targetAudience = 'ALL',
      targetSchoolId = null,
      expiresAt = null,
    } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: 'Judul dan isi pengumuman wajib diisi.' },
        { status: 400 }
      );
    }

    const res = await queryPostgres(
      `INSERT INTO broadcast_announcements (
        title, message, priority, target_audience, 
        target_school_id, is_active, expires_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, true, $6, $7)
      RETURNING *;`,
      [
        title.trim(),
        message.trim(),
        priority,
        targetAudience,
        targetSchoolId || null,
        expiresAt ? new Date(expiresAt).toISOString() : null,
        user.id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Pengumuman broadcast berhasil diterbitkan.',
      data: res.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menerbitkan pengumuman.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Khusus Super Admin' }, { status: 403 });
    }

    const body = await req.json();
    const {
      id,
      title,
      message,
      priority,
      targetAudience,
      targetSchoolId,
      isActive,
      expiresAt,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID pengumuman wajib disertakan.' }, { status: 400 });
    }

    await queryPostgres(
      `UPDATE broadcast_announcements SET
        title = COALESCE($1, title),
        message = COALESCE($2, message),
        priority = COALESCE($3, priority),
        target_audience = COALESCE($4, target_audience),
        target_school_id = COALESCE($5, target_school_id),
        is_active = COALESCE($6, is_active),
        expires_at = COALESCE($7, expires_at)
       WHERE id = $8;`,
      [
        title ? title.trim() : null,
        message ? message.trim() : null,
        priority || null,
        targetAudience || null,
        targetSchoolId !== undefined ? targetSchoolId : null,
        typeof isActive === 'boolean' ? isActive : null,
        expiresAt ? new Date(expiresAt).toISOString() : null,
        id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Pengumuman berhasil diperbarui.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui pengumuman.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Khusus Super Admin' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID pengumuman wajib disertakan.' }, { status: 400 });
    }

    await queryPostgres('DELETE FROM broadcast_announcements WHERE id = $1;', [id]);

    return NextResponse.json({
      success: true,
      message: 'Pengumuman broadcast berhasil dihapus.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus pengumuman.' },
      { status: 500 }
    );
  }
}
