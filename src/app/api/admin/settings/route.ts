import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { SchoolSettingsService } from '@/lib/services/school-settings.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('settings.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const settings = await SchoolSettingsService.getSettings(schoolId);
    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat pengaturan sekolah.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireApiPermission('settings.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const updated = await SchoolSettingsService.updateSettings(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Pengaturan sekolah berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memperbarui pengaturan sekolah.' }, { status: 400 });
  }
}
