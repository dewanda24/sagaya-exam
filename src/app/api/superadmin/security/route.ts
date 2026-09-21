import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { getSecurityMetrics } from '@/lib/services/security.service';

export async function GET() {
  const auth = await requireApiPermission('security.read');
  if (!auth.authorized) return auth.response;

  try {
    const data = await getSecurityMetrics();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat metrik keamanan platform.' },
      { status: 500 }
    );
  }
}
