import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { TeacherService } from '@/lib/services/teacher.service';

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('teachers.import');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { action, teachers } = body;

    if (!teachers || !Array.isArray(teachers)) {
      return NextResponse.json({ success: false, error: 'Data guru wajib berupa array.' }, { status: 400 });
    }

    if (action === 'PREVIEW') {
      const preview = await TeacherService.previewImport(schoolId, teachers);
      return NextResponse.json({ success: true, data: preview });
    }

    if (action === 'COMMIT') {
      const result = await TeacherService.commitImport(schoolId, teachers, {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
      });

      return NextResponse.json({
        success: true,
        message: `Import guru berhasil! ${result.insertedCount} guru baru ditambahkan.`,
        data: result,
      });
    }

    return NextResponse.json({ success: false, error: 'Action harus PREVIEW atau COMMIT.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memproses import guru.' }, { status: 400 });
  }
}
