import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { StudentService } from '@/lib/services/student.service';

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('classes.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { studentIds, targetClassId } = body;

    if (!studentIds || !Array.isArray(studentIds) || !targetClassId) {
      return NextResponse.json(
        { success: false, error: 'studentIds (array) dan targetClassId wajib diisi.' },
        { status: 400 }
      );
    }

    const res = await StudentService.bulkAssignClass(schoolId, studentIds, targetClassId, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: `${res.affectedCount} siswa berhasil dipindahkan ke kelas tujuan.`,
      data: res,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memindahkan siswa.' }, { status: 400 });
  }
}
