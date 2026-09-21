import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { AcademicYearService } from '@/lib/services/academic-year.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('academic_year.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const detail = await AcademicYearService.getAcademicYearById(schoolId, id);
      if (!detail) {
        return NextResponse.json({ success: false, error: 'Tahun ajaran tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: detail });
    }

    const years = await AcademicYearService.listAcademicYears(schoolId);
    return NextResponse.json({ success: true, data: years });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat tahun ajaran.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('academic_year.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const created = await AcademicYearService.createAcademicYear(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: `Tahun ajaran '${created.name}' berhasil dibuat.`,
      data: created,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal membuat tahun ajaran.' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiPermission('academic_year.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { id, action, semesterId, semesterStatus, ...data } = body;

    const actor = { id: auth.user.id, username: auth.user.username, role: auth.user.role };

    if (action === 'UPDATE_SEMESTER' && semesterId && semesterStatus) {
      await AcademicYearService.updateSemesterStatus(schoolId, semesterId, semesterStatus, actor);
      return NextResponse.json({ success: true, message: 'Status semester berhasil diperbarui.' });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Tahun Ajaran diperlukan.' }, { status: 400 });
    }

    const updated = await AcademicYearService.updateAcademicYear(schoolId, id, data, actor);
    return NextResponse.json({
      success: true,
      message: 'Data tahun ajaran berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memperbarui tahun ajaran.' }, { status: 400 });
  }
}
