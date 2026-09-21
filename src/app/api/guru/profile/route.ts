import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherCoreService } from '@/lib/services/teacher-core.service';

export async function GET(req: Request) {
  const auth = await requireApiAuth(['GURU', 'ADMIN', 'SUPER_ADMIN']);
  if (!auth.authorized) return auth.response;

  try {
    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const profile = await TeacherCoreService.getProfile(schoolId, auth.user.id);
    return NextResponse.json({ success: true, data: profile });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat profil guru.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const auth = await requireApiAuth(['GURU', 'ADMIN', 'SUPER_ADMIN']);
  if (!auth.authorized) return auth.response;

  try {
    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Client parameter manipulation defense: Guru hanya boleh mengubah profil sendiri
    const updated = await TeacherCoreService.updateProfile(
      schoolId,
      auth.user.id,
      {
        phone: body.phone,
        email: body.email,
      },
      auth.user
    );

    return NextResponse.json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memperbarui profil guru.' },
      { status: 400 }
    );
  }
}
