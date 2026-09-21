import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ProctorService } from '@/lib/services/proctor.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('proctors.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const isActive = searchParams.has('isActive') ? searchParams.get('isActive') === 'true' : undefined;

    const proctors = await ProctorService.listProctors(schoolId, { search, isActive });
    return NextResponse.json({ success: true, data: proctors });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat pengawas.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('proctors.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const created = await ProctorService.createProctor(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: `Pengawas '${created.fullName}' berhasil ditambahkan.`,
      data: created,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menambahkan pengawas.' }, { status: 400 });
  }
}
