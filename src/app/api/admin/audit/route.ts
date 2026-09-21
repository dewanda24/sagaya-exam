import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { SchoolAuditService } from '@/lib/services/school-audit.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('audit.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || undefined;
    const role = searchParams.get('role') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.has('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.has('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const result = await SchoolAuditService.listSchoolAuditLogs(schoolId, {
      action,
      role,
      search,
      limit,
      offset,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat log audit sekolah.' }, { status: 500 });
  }
}
