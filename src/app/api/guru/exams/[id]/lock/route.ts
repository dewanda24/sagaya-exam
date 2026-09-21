import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';
import { AuditService } from '@/lib/services/audit.service';

export async function POST(
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

    const { id } = await params;

    const res = await queryPostgres(
      `UPDATE exams SET status = 'COMPLETED' WHERE id = $1 AND school_id = $2 RETURNING id, title;`,
      [id, schoolId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan.' }, { status: 404 });
    }

    await AuditService.createLog({
      action: 'EXAM_LOCKED',
      schoolId,
      actor: { id: auth.user.id, username: auth.user.username, role: auth.user.role },
      resourceType: 'EXAM',
      resourceId: id,
      details: { title: res.rows[0].title },
    });

    return NextResponse.json({
      success: true,
      message: 'Ujian telah dikunci dan diselesaikan.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal mengunci ujian.' },
      { status: 500 }
    );
  }
}
