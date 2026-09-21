import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { TeacherCoreService } from '@/lib/services/teacher-core.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: classId } = await params;
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || undefined;
    const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
    const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!, 10) : undefined;

    const data = await TeacherCoreService.getClassStudents(
      schoolId,
      auth.user.id,
      classId,
      { search, limit, offset },
      auth.user.role
    );

    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    const status = err.message?.includes('Akses ditolak') ? 403 : 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat daftar siswa kelas.' },
      { status }
    );
  }
}
