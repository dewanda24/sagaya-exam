import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken } from '@/lib/core/auth';
import { getTenantContext } from '@/lib/core/tenant';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenant = await getTenantContext(user, searchParams);

    let query = `
      SELECT 
        r.*,
        COALESCE(part.participant_count, 0) as active_allocated_count
      FROM exam_rooms r
      LEFT JOIN (
        SELECT room_id, COUNT(*) as participant_count 
        FROM exam_participants 
        GROUP BY room_id
      ) part ON r.id = part.room_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tenant.schoolId) {
      params.push(tenant.schoolId);
      query += ` AND r.school_id = $${params.length}`;
    }

    query += ` ORDER BY r.code ASC;`;

    const res = await queryPostgres(query, params);

    return NextResponse.json({
      success: true,
      data: {
        rooms: res.rows.map((r: any) => ({
          id: r.id,
          schoolId: r.school_id,
          code: r.code,
          name: r.name,
          capacity: parseInt(r.capacity, 10),
          proctorName: r.proctor_name || '-',
          location: r.location || '-',
          isActive: r.is_active,
          allocatedCount: parseInt(r.active_allocated_count, 10),
          createdAt: r.created_at,
        })),
        totalCapacity: res.rows.reduce((acc: number, r: any) => acc + parseInt(r.capacity, 10), 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat daftar ruang ujian.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { code, name, capacity = 30, proctorName, location, schoolId } = body;

    if (!code || !name) {
      return NextResponse.json(
        { success: false, error: 'Kode Ruang dan Nama Ruangan wajib diisi.' },
        { status: 400 }
      );
    }

    const targetSchoolId = user.role === 'SUPER_ADMIN' ? schoolId || user.schoolId : user.schoolId;

    if (!targetSchoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks ID sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();

    // Check duplicate code
    const checkRes = await queryPostgres(
      `SELECT id FROM exam_rooms WHERE school_id = $1 AND code = $2 LIMIT 1;`,
      [targetSchoolId, cleanCode]
    );
    if (checkRes.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `Ruang dengan kode ${cleanCode} sudah terdaftar di sekolah ini.` },
        { status: 400 }
      );
    }

    const insertRes = await queryPostgres(
      `INSERT INTO exam_rooms (school_id, code, name, capacity, proctor_name, location, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *;`,
      [
        targetSchoolId,
        cleanCode,
        name.trim(),
        parseInt(capacity, 10) || 30,
        proctorName?.trim() || '-',
        location?.trim() || '-',
      ]
    );

    return NextResponse.json({
      success: true,
      message: `Ruang ujian ${name} berhasil ditambahkan.`,
      data: insertRes.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan ruang ujian.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, code, name, capacity, proctorName, location, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID ruang wajib diisi.' }, { status: 400 });
    }

    await queryPostgres(
      `UPDATE exam_rooms SET
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        capacity = COALESCE($3, capacity),
        proctor_name = COALESCE($4, proctor_name),
        location = COALESCE($5, location),
        is_active = COALESCE($6, is_active)
       WHERE id = $7;`,
      [
        code ? code.trim().toUpperCase() : undefined,
        name ? name.trim() : undefined,
        capacity ? parseInt(capacity, 10) : undefined,
        proctorName,
        location,
        isActive,
        id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Data ruang ujian berhasil diperbarui.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui ruang ujian.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID ruang wajib diisi.' }, { status: 400 });
    }

    // Check if room is actively being used by exam participants
    const usedRes = await queryPostgres(
      `SELECT COUNT(*) as count FROM exam_participants WHERE room_id = $1;`,
      [id]
    );
    const count = parseInt(usedRes.rows[0]?.count || '0', 10);
    if (count > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Ruangan ini sedang digunakan oleh ${count} alokasi peserta ujian. Hapus alokasi terlebih dahulu atau nonaktifkan ruangan.`,
        },
        { status: 400 }
      );
    }

    await queryPostgres(`DELETE FROM exam_rooms WHERE id = $1;`, [id]);

    return NextResponse.json({
      success: true,
      message: 'Ruang ujian berhasil dihapus.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus ruang ujian.' },
      { status: 500 }
    );
  }
}
