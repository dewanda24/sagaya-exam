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
        { success: false, error: 'Konteks sekolah (tenant) tidak ditemukan.' },
        { status: 400 }
      );
    }

    const stats = await TeacherCoreService.getDashboardStats(schoolId, auth.user.id);
    return NextResponse.json({ success: true, data: stats });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat statistik dashboard guru.' },
      { status: 500 }
    );
  }
}
