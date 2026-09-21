import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { getAuditLogs } from '@/lib/services/audit.service';

export async function GET(req: Request) {
  const auth = await requireApiPermission('audit.read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const actorId = searchParams.get('actorId') || undefined;
    const role = searchParams.get('role') || undefined;
    const schoolId = searchParams.get('schoolId') || undefined;
    const action = searchParams.get('action') || undefined;
    const resourceType = searchParams.get('resourceType') || undefined;
    const severity = searchParams.get('severity') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    const result = await getAuditLogs({
      startDate,
      endDate,
      actorId,
      role,
      schoolId,
      action,
      resourceType,
      severity,
      search,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat log audit.' },
      { status: 500 }
    );
  }
}
