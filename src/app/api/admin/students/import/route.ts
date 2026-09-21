import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { StudentService } from '@/lib/services/student.service';

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('students.import');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { action, students } = body;

    if (!students || !Array.isArray(students)) {
      return NextResponse.json({ success: false, error: 'Data siswa wajib berupa array.' }, { status: 400 });
    }

    if (action === 'PREVIEW') {
      const preview = await StudentService.previewImport(schoolId, students);
      return NextResponse.json({
        success: true,
        data: preview,
      });
    }

    if (action === 'COMMIT') {
      const result = await StudentService.commitImport(schoolId, students, {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
      });

      return NextResponse.json({
        success: true,
        message: `Import berhasil! ${result.insertedCount} data baru ditambahkan, ${result.updatedCount} data diperbarui.`,
        data: result,
      });
    }

    return NextResponse.json({ success: false, error: 'Action harus PREVIEW atau COMMIT.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memproses import siswa.' }, { status: 400 });
  }
}
