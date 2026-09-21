import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherCoreService } from '@/lib/services/teacher-core.service';

export async function GET(req: Request) {
  const auth = await requireApiAuth(['GURU', 'ADMIN', 'SUPER_ADMIN']);
  if (!auth.authorized) return auth.response;

  try {
    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const classes = await TeacherCoreService.getAssignedClasses(schoolId, auth.user.id);
    return NextResponse.json({ success: true, data: classes });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat kelas guru.' },
      { status: 500 }
    );
  }
}
