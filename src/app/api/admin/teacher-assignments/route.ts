import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { TeacherService } from '@/lib/services/teacher.service';
import { queryPostgres } from '@/lib/core/postgres';

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('teachers.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { teacherId, classAssignments } = body;

    if (!teacherId || !classAssignments || !Array.isArray(classAssignments)) {
      return NextResponse.json(
        { success: false, error: 'teacherId dan classAssignments (array) wajib diisi.' },
        { status: 400 }
      );
    }

    await TeacherService.assignTeacherClasses(schoolId, teacherId, classAssignments, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Penugasan kelas dan mata pelajaran guru berhasil disimpan.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menyimpan penugasan guru.' }, { status: 400 });
  }
}
