import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { getSuperadminDashboardStats } from '@/lib/services/dashboard.service';

export async function GET() {
  const auth = await requireApiPermission('school.read');
  if (!auth.authorized) return auth.response;

  try {
    const data = await getSuperadminDashboardStats();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat statistik dashboard.' },
      { status: 500 }
    );
  }
}
