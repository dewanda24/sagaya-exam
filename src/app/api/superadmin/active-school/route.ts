import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionToken } from '@/lib/core/auth';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let activeSchoolId = cookieStore.get('sagaya_active_school_id')?.value;

    // Regular admin is always locked to their assigned school
    if (user.role !== 'SUPER_ADMIN') {
      activeSchoolId = user.schoolId || undefined;
    }

    let activeSchool = null;
    if (activeSchoolId && activeSchoolId !== 'ALL') {
      const res = await queryPostgres('SELECT * FROM schools WHERE id = $1 LIMIT 1;', [activeSchoolId]);
      if (res.rows.length > 0) {
        const r = res.rows[0];
        activeSchool = {
          id: r.id,
          code: r.code,
          name: r.name,
          level: r.level,
          logoUrl: r.logo_url,
          headerTitle1: r.header_title_1,
          headerTitle2: r.header_title_2,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        activeSchoolId: activeSchoolId || 'ALL',
        activeSchool,
        userRole: user.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat sekolah aktif.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Hanya Super Admin yang dapat mengganti konteks sekolah.' },
        { status: 403 }
      );
    }

    const { schoolId } = await req.json();

    const response = NextResponse.json({
      success: true,
      message: 'Konteks sekolah berhasil dialihkan.',
      activeSchoolId: schoolId,
    });

    if (schoolId) {
      response.cookies.set('sagaya_active_school_id', schoolId, {
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        sameSite: 'lax',
      });
    } else {
      response.cookies.delete('sagaya_active_school_id');
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengatur sekolah aktif.' },
      { status: 500 }
    );
  }
}
