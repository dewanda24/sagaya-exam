import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { SchoolProfileService } from '@/lib/services/school-profile.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('school.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const school = await SchoolProfileService.getProfile(schoolId);
    if (!school) {
      return NextResponse.json({ success: false, error: 'Sekolah tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: school });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat profil sekolah.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireApiPermission('school.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const updated = await SchoolProfileService.updateProfile(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Profil sekolah berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memperbarui profil sekolah.' }, { status: 400 });
  }
}
