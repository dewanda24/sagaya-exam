import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken, hashPassword } from '@/lib/core/auth';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden: Khusus Super Admin' }, { status: 403 });
    }

    const res = await queryPostgres(`
      SELECT 
        id, username, full_name, role, is_active, created_at
      FROM users
      WHERE role = 'SUPER_ADMIN'
      ORDER BY created_at ASC;
    `);

    const team = res.rows.map((r: any) => ({
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      role: r.role,
      isActive: r.is_active,
      isCurrentUser: r.id === user.id,
      createdAt: r.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: team,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat daftar tim platform.' },
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
    const { username, fullName } = body;

    if (!username || !fullName) {
      return NextResponse.json(
        { success: false, error: 'Username dan Nama Lengkap staf wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');

    // Cek duplikasi username
    const checkRes = await queryPostgres('SELECT id FROM users WHERE LOWER(username) = $1 LIMIT 1;', [cleanUsername]);
    if (checkRes.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `Username "${cleanUsername}" sudah digunakan oleh akun lain.` },
        { status: 400 }
      );
    }

    // Generate password sementara 1x tampil
    const randomChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomSuffix = '';
    for (let i = 0; i < 6; i++) {
      randomSuffix += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    const tempPassword = `MASTER-${randomSuffix}`;
    const passwordHash = await hashPassword(tempPassword);

    const insertRes = await queryPostgres(
      `INSERT INTO users (username, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, 'SUPER_ADMIN', true)
       RETURNING id, username, full_name, role, is_active, created_at;`,
      [cleanUsername, passwordHash, fullName.trim()]
    );

    return NextResponse.json({
      success: true,
      message: `Akun personel Super Admin "${fullName}" berhasil dibuat.`,
      data: insertRes.rows[0],
      credential: {
        username: cleanUsername,
        tempPassword,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan personel tim.' },
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
    const { id, action, fullName, isActive } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID personel wajib disertakan.' }, { status: 400 });
    }

    // ACTION: Reset Password Tim
    if (action === 'RESET_PASSWORD') {
      const targetRes = await queryPostgres('SELECT id, username, full_name FROM users WHERE id = $1 AND role = $2 LIMIT 1;', [id, 'SUPER_ADMIN']);
      if (targetRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Personel tidak ditemukan.' }, { status: 404 });
      }
      const target = targetRes.rows[0];

      const randomChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let randomSuffix = '';
      for (let i = 0; i < 6; i++) {
        randomSuffix += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
      }
      const tempPassword = `MASTER-${randomSuffix}`;
      const passwordHash = await hashPassword(tempPassword);

      await queryPostgres('UPDATE users SET password_hash = $1, is_active = true WHERE id = $2;', [passwordHash, id]);

      return NextResponse.json({
        success: true,
        message: `Kata sandi "${target.full_name}" berhasil direset.`,
        credential: {
          username: target.username,
          tempPassword,
        },
      });
    }

    // Standard Update
    await queryPostgres(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        is_active = COALESCE($2, is_active)
       WHERE id = $3 AND role = 'SUPER_ADMIN';`,
      [
        fullName ? fullName.trim() : null,
        typeof isActive === 'boolean' ? isActive : null,
        id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Data personel tim berhasil diperbarui.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui personel tim.' },
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
      return NextResponse.json({ success: false, error: 'ID personel wajib disertakan.' }, { status: 400 });
    }

    if (id === user.id) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.' },
        { status: 400 }
      );
    }

    await queryPostgres('DELETE FROM users WHERE id = $1 AND role = $2;', [id, 'SUPER_ADMIN']);

    return NextResponse.json({
      success: true,
      message: 'Akun personel Super Admin berhasil dihapus.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus personel.' },
      { status: 500 }
    );
  }
}
