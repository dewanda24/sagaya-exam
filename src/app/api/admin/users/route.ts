import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { SchoolUserService } from '@/lib/services/school-user.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('users.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const role = (searchParams.get('role') as any) || undefined;
    const search = searchParams.get('search') || undefined;
    const isActive = searchParams.has('isActive') ? searchParams.get('isActive') === 'true' : undefined;

    if (id) {
      const user = await SchoolUserService.getUserById(schoolId, id);
      if (!user) {
        return NextResponse.json({ success: false, error: 'Pengguna tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: user });
    }

    const users = await SchoolUserService.listUsers(schoolId, { role, search, isActive });
    return NextResponse.json({ success: true, data: users });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat pengguna sekolah.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('users.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const newUser = await SchoolUserService.createUser(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: `Akun '${newUser.username}' berhasil dibuat.`,
      data: newUser,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal membuat pengguna.' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiPermission('users.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { id, action, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Pengguna diperlukan.' }, { status: 400 });
    }

    const actor = { id: auth.user.id, username: auth.user.username, role: auth.user.role };

    if (action === 'TOGGLE_STATUS') {
      const res = await SchoolUserService.setUserStatus(schoolId, id, data.isActive, actor);
      return NextResponse.json(res);
    }

    if (action === 'RESET_PASSWORD') {
      const res = await SchoolUserService.resetPassword(schoolId, id, data.newPassword, actor);
      return NextResponse.json(res);
    }

    if (action === 'REVOKE_SESSIONS') {
      const res = await SchoolUserService.revokeUserSessions(schoolId, id, actor);
      return NextResponse.json(res);
    }

    const updated = await SchoolUserService.updateUser(schoolId, id, data, actor);
    return NextResponse.json({
      success: true,
      message: 'Data pengguna berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memperbarui pengguna.' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireApiPermission('users.disable');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'ID Pengguna diperlukan.' }, { status: 400 });
    }

    const res = await SchoolUserService.deleteUser(schoolId, userId, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menghapus pengguna.' }, { status: 400 });
  }
}
