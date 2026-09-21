import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { getAllSystemSettings, updateCategorySettings } from '@/lib/services/system-settings.service';
import { getClientIp } from '@/lib/core/rate-limit';

export async function GET() {
  const auth = await requireApiPermission('system.read');
  if (!auth.authorized) return auth.response;

  try {
    const settings = await getAllSystemSettings();
    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat pengaturan sistem.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requireApiPermission('system.configure');
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const { category, values } = body;
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (!category || !values) {
      return NextResponse.json(
        { success: false, error: 'Kategori dan nilai konfigurasi wajib disertakan.' },
        { status: 400 }
      );
    }

    const updated = await updateCategorySettings(category, values, {
      id: auth.user.id,
      role: auth.user.role,
      fullName: auth.user.fullName,
      ip: clientIp,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `Pengaturan untuk kategori ${category} berhasil disimpan.`,
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyimpan pengaturan sistem.' },
      { status: 400 }
    );
  }
}

export const PUT = PATCH;
