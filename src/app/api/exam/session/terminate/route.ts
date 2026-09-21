import { NextResponse } from 'next/server';
import { verifySessionToken } from '@/lib/core/tokens';
import { ExamSessionStateService } from '@/lib/services/exam-session-state.service';
import { queryPostgres } from '@/lib/core/postgres';

export async function POST(req: Request) {
  try {
    // 1. Authenticate Staff Actor (Pengawas / Admin / Superadmin)
    const cookieHeader = req.headers.get('cookie') || '';
    const staffMatch = cookieHeader.match(/sagaya_session=([^;]+)/);
    const authHeader = req.headers.get('authorization') || '';

    let staffToken: string | null = null;
    if (staffMatch) {
      staffToken = decodeURIComponent(staffMatch[1].trim());
    } else if (authHeader.startsWith('Bearer ')) {
      staffToken = authHeader.substring(7).trim();
    }

    if (!staffToken) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Diperlukan otorisasi pengawas atau administrator.' },
        { status: 401 }
      );
    }

    const staffUser = await verifySessionToken(staffToken);
    if (!staffUser || !['SUPER_ADMIN', 'ADMIN', 'PENGAWAS'].includes(staffUser.role)) {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Peran Anda tidak memiliki izin untuk menghentikan sesi ujian.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { sessionId, reason = 'Terminasi administratif oleh pengawas' } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID Sesi ujian wajib disertakan.' },
        { status: 400 }
      );
    }

    // Tenant authorization check
    if (staffUser.role !== 'SUPER_ADMIN') {
      const sessRes = await queryPostgres(
        `SELECT school_id FROM exam_sessions WHERE id = $1 LIMIT 1;`,
        [sessionId]
      );
      if (sessRes.rows.length === 0 || sessRes.rows[0].school_id !== staffUser.schoolId) {
        return NextResponse.json(
          { success: false, error: 'Akses ditolak: Batas sekolah tenant tidak sesuai.' },
          { status: 403 }
        );
      }
    }

    await ExamSessionStateService.terminate(sessionId, {
      userId: staffUser.id,
      role: staffUser.role,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: 'Sesi ujian berhasil dihentikan secara administratif.',
      data: {
        sessionId,
        status: 'TERMINATED',
        terminatedBy: staffUser.fullName,
        reason,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/exam/session/terminate:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal menghentikan sesi ujian.' },
      { status: 500 }
    );
  }
}
