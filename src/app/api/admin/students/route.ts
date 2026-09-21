import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { StudentService } from '@/lib/services/student.service';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('students.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search') || undefined;
    const classRoomId = searchParams.get('classId') || undefined;
    const gender = (searchParams.get('gender') as any) || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.has('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const offset = searchParams.has('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined;

    if (id) {
      const student = await StudentService.getStudentById(schoolId, id);
      if (!student) {
        return NextResponse.json({ success: false, error: 'Siswa tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: student });
    }

    const { students, total } = await StudentService.listStudents(schoolId, {
      search,
      classRoomId,
      gender,
      status,
      limit,
      offset,
    });

    const classesRes = await queryPostgres(
      `SELECT id, name, level FROM class_rooms WHERE school_id = $1 ORDER BY level ASC, name ASC;`,
      [schoolId]
    );

    return NextResponse.json({
      success: true,
      data: {
        students,
        classes: classesRes.rows,
        total,
        currentSchoolId: schoolId,
        isSuperAdmin: auth.tenant.isSuperAdmin,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat data siswa.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('students.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const created = await StudentService.createStudent(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Siswa berhasil ditambahkan.',
      data: created,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menambahkan siswa.' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiPermission('students.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { id, action, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Siswa diperlukan.' }, { status: 400 });
    }

    const actor = { id: auth.user.id, username: auth.user.username, role: auth.user.role };

    if (action === 'RESET_PIN') {
      const res = await StudentService.resetPin(schoolId, id, actor);
      return NextResponse.json({
        success: true,
        message: `PIN siswa berhasil di-reset menjadi ${res.newPin}.`,
        newPin: res.newPin,
      });
    }

    const updated = await StudentService.updateStudent(schoolId, id, data, actor);
    return NextResponse.json({
      success: true,
      message: 'Data siswa berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memperbarui siswa.' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireApiPermission('students.delete');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Siswa diperlukan.' }, { status: 400 });
    }

    const res = await StudentService.deleteStudent(schoolId, id, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menghapus siswa.' }, { status: 400 });
  }
}
