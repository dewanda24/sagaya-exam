import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { TeacherService } from '@/lib/services/teacher.service';
import { SubjectService } from '@/lib/services/subject.service';
import { ClassService } from '@/lib/services/class.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('teachers.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search') || undefined;
    const isActive = searchParams.has('isActive') ? searchParams.get('isActive') === 'true' : undefined;

    if (id) {
      const teacher = await TeacherService.getTeacherById(schoolId, id);
      if (!teacher) {
        return NextResponse.json({ success: false, error: 'Guru tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: teacher });
    }

    const [teachers, subjects, classes] = await Promise.all([
      TeacherService.listTeachers(schoolId, { search, isActive }),
      SubjectService.listSubjects(schoolId),
      ClassService.listClasses(schoolId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        teachers,
        subjects,
        classes,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat data guru.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('teachers.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const created = await TeacherService.createTeacher(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: `Guru '${created.fullName}' berhasil ditambahkan.`,
      data: created,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menambahkan guru.' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiPermission('teachers.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Guru diperlukan.' }, { status: 400 });
    }

    const updated = await TeacherService.updateTeacher(schoolId, id, data, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Data guru berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memperbarui guru.' }, { status: 400 });
  }
}
