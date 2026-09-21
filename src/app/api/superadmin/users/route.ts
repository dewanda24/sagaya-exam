import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import {
  listPlatformUsers,
  createPlatformUser,
  updateUserProfile,
  deletePlatformUser,
  disableUser,
  enableUser,
  resetUserPassword,
  changeUserRole,
  forceLogoutUser,
  listSchoolsSimple,
} from '@/lib/services/user.service';
import { getClientIp } from '@/lib/core/rate-limit';

export async function GET(req: Request) {
  const auth = await requireApiPermission('user.read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    if (type === 'schools') {
      const schools = await listSchoolsSimple();
      return NextResponse.json({ success: true, data: schools });
    }

    const search = searchParams.get('search') || undefined;
    const role = searchParams.get('role') || undefined;
    const schoolId = searchParams.get('schoolId') || undefined;
    const status = searchParams.get('status') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await listPlatformUsers({ search, role, schoolId, status, page, limit });

    return NextResponse.json({
      success: true,
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat daftar pengguna platform.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action, userId, reason, username, fullName, role, schoolId, nip, customPassword } = body;
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // 1. Create User Action
  if (action === 'CREATE') {
    const auth = await requireApiPermission('user.create');
    if (!auth.authorized) return auth.response;

    const actor = {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    };

    try {
      const result = await createPlatformUser(
        { username, fullName, role, schoolId, nip, customPassword },
        actor
      );
      return NextResponse.json(result, { status: 201 });
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
  }

  // 2. Reset Password Action
  if (action === 'RESET_PASSWORD') {
    const auth = await requireApiPermission('user.reset_password');
    if (!auth.authorized) return auth.response;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID wajib disertakan.' }, { status: 400 });
    }

    const actor = {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    };

    try {
      const result = await resetUserPassword(userId, actor);
      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
  }

  // 3. Force Logout Action
  if (action === 'FORCE_LOGOUT' || action === 'REVOKE_SESSIONS') {
    const auth = await requireApiPermission('user.revoke_session');
    if (!auth.authorized) return auth.response;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID wajib disertakan.' }, { status: 400 });
    }

    const actor = {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    };

    try {
      const result = await forceLogoutUser(userId, reason, actor);
      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: false, error: 'Aksi POST tidak valid.' }, { status: 400 });
}

export async function PUT(req: Request) {
  const auth = await requireApiPermission('user.update');
  if (!auth.authorized) return auth.response;

  const body = await req.json();
  const { userId, fullName, username, nip, schoolId } = body;
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  if (!userId) {
    return NextResponse.json({ success: false, error: 'User ID wajib disertakan.' }, { status: 400 });
  }

  const actor = {
    id: auth.user.id,
    role: auth.user.role,
    fullName: auth.user.fullName,
    ip: clientIp,
    userAgent,
  };

  try {
    const result = await updateUserProfile(userId, { fullName, username, nip, schoolId }, actor);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { userId, action, role: newRole, reason } = body;
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || 'unknown';

  if (!userId) {
    return NextResponse.json({ success: false, error: 'User ID wajib disertakan.' }, { status: 400 });
  }

  if (action === 'DISABLE') {
    const auth = await requireApiPermission('user.disable');
    if (!auth.authorized) return auth.response;

    const actor = {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    };

    try {
      const result = await disableUser(userId, reason, actor);
      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
  }

  if (action === 'ENABLE') {
    const auth = await requireApiPermission('user.update');
    if (!auth.authorized) return auth.response;

    const actor = {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    };

    try {
      const result = await enableUser(userId, actor);
      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
  }

  if (action === 'CHANGE_ROLE') {
    const auth = await requireApiPermission('user.update');
    if (!auth.authorized) return auth.response;

    const actor = {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    };

    try {
      const result = await changeUserRole(userId, newRole, actor);
      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: false, error: 'Aksi PATCH tidak valid.' }, { status: 400 });
}

export async function DELETE(req: Request) {
  const auth = await requireApiPermission('user.delete');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const reason = searchParams.get('reason') || 'Dihapus oleh Administrator Platform';

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID wajib disertakan.' }, { status: 400 });
    }

    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const actor = {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    };

    const result = await deletePlatformUser(userId, reason, actor);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
