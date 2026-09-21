import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ClassService } from '@/lib/services/class.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('classes.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const academicYearId = searchParams.get('academicYearId') || undefined;
    const level = searchParams.get('level') || undefined;
    const search = searchParams.get('search') || undefined;

    if (id) {
      const detail = await ClassService.getClassById(schoolId, id);
      if (!detail) {
        return NextResponse.json({ success: false, error: 'Kelas tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: detail });
    }

    const classes = await ClassService.listClasses(schoolId, { academicYearId, level, search });
    return NextResponse.json({ success: true, data: classes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat kelas.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('classes.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const created = await ClassService.createClass(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: `Kelas '${created.name}' berhasil dibuat.`,
      data: created,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal membuat kelas.' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiPermission('classes.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Kelas diperlukan.' }, { status: 400 });
    }

    const updated = await ClassService.updateClass(schoolId, id, data, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Data kelas berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memperbarui kelas.' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireApiPermission('classes.delete');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Kelas diperlukan.' }, { status: 400 });
    }

    const res = await ClassService.deleteClass(schoolId, id, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menghapus kelas.' }, { status: 400 });
  }
}
