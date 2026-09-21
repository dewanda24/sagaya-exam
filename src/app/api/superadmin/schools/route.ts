import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { listSchools, createSchoolWithAdmin } from '@/lib/services/school.service';
import { getClientIp } from '@/lib/core/rate-limit';

export async function GET(req: Request) {
  const auth = await requireApiPermission('school.read');
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const level = searchParams.get('level') || undefined;
    const status = searchParams.get('status') || undefined;
    const rayon = searchParams.get('rayon') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await listSchools({ search, level, status, rayon, page, limit });

    return NextResponse.json({
      success: true,
      data: result.schools,
      schools: result.schools, // Backward-compatibility
      pagination: result.pagination,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat daftar sekolah.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireApiPermission('school.create');
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const result = await createSchoolWithAdmin(body, {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Satuan pendidikan dan akun Admin Sekolah berhasil dibuat.',
      data: result,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal membuat satuan pendidikan.' },
      { status: 400 }
    );
  }
}
