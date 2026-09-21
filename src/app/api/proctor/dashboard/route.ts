import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { ProctorCoreService } from '@/lib/services/proctor-core.service';

export async function GET() {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah (tenant) tidak valid.' },
        { status: 400 }
      );
    }

    const data = await ProctorCoreService.getDashboardMetrics(auth.user.id, schoolId, auth.user.role);

    return NextResponse.json({
      success: true,
      data,
      user: {
        id: auth.user.id,
        fullName: auth.user.fullName,
        role: auth.user.role,
        schoolName: auth.user.schoolName || 'Satuan Pendidikan',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat dasbor pengawas.' },
      { status: 500 }
    );
  }
}
