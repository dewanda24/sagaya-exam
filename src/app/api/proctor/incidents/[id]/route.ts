import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { IncidentService } from '@/lib/services/incident.service';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const { id } = await params;
    const schoolId = auth.tenant.schoolId || auth.user.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak valid.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { actionTaken } = body;

    if (!actionTaken || !actionTaken.trim()) {
      return NextResponse.json(
        { success: false, error: 'Tindakan penyelesaian (actionTaken) wajib diisi.' },
        { status: 400 }
      );
    }

    const updated = await IncidentService.resolveIncident(auth.user, schoolId, id, actionTaken.trim());

    return NextResponse.json({
      success: true,
      message: 'Status insiden berhasil diperbarui menjadi RESOLVED.',
      data: updated,
    });
  } catch (error: any) {
    const isForbidden = error.message?.includes('Akses ditolak');
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menyelesaikan insiden.' },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
