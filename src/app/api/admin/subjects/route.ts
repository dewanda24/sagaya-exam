import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { SubjectService } from '@/lib/services/subject.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('subjects.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const level = searchParams.get('level') || undefined;

    if (id) {
      const detail = await SubjectService.getSubjectById(schoolId, id);
      if (!detail) {
        return NextResponse.json({ success: false, error: 'Mata pelajaran tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: detail });
    }

    const subjects = await SubjectService.listSubjects(schoolId, { search, category, level });
    return NextResponse.json({ success: true, data: subjects });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat mata pelajaran.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('subjects.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const created = await SubjectService.createSubject(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: `Mata pelajaran '${created.name}' berhasil ditambahkan.`,
      data: created,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal membuat mata pelajaran.' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiPermission('subjects.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Mata Pelajaran diperlukan.' }, { status: 400 });
    }

    const updated = await SubjectService.updateSubject(schoolId, id, data, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Data mata pelajaran berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memperbarui mata pelajaran.' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireApiPermission('subjects.delete');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Mata Pelajaran diperlukan.' }, { status: 400 });
    }

    const res = await SubjectService.deleteSubject(schoolId, id, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menghapus mata pelajaran.' }, { status: 400 });
  }
}
