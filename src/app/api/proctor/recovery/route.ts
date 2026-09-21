import { NextResponse } from 'next/server';
import { db } from '@/lib/school/db-service';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'PENGAWAS']);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { action, participantId, participantIds } = body;
    const additionalMinutes = Number(body.additionalMinutes || body.extraMinutes || 10);

    const ids: string[] = Array.isArray(participantIds)
      ? participantIds.filter(Boolean)
      : participantId
      ? [participantId]
      : [];

    if (ids.length === 0 || !action) {
      return NextResponse.json(
        { success: false, error: 'Parameter action dan minimal satu participantId diperlukan.' },
        { status: 400 }
      );
    }

    let responseJson: any = null;

    switch (action) {
      case 'RESET_DEVICE': {
        const result = await db.resetSessionDevice(ids);
        if (result.count === 0) {
          return NextResponse.json(
            { success: false, error: 'Gagal mereset sesi. Peserta belum memulai ujian atau tidak ditemukan.' },
            { status: 404 }
          );
        }
        responseJson = {
          success: true,
          count: result.count,
          message:
            ids.length > 1
              ? `Berhasil mereset login untuk ${result.count} peserta.`
              : 'Sesi berhasil direset! Siswa kini dapat masuk kembali menggunakan token yang sama di perangkat pengganti.',
        };
        break;
      }

      case 'ADD_TIME': {
        const result = await db.addSessionTime(ids, additionalMinutes);
        if (result.count === 0) {
          return NextResponse.json(
            { success: false, error: 'Sesi peserta tidak ditemukan.' },
            { status: 404 }
          );
        }
        responseJson = {
          success: true,
          count: result.count,
          message:
            ids.length > 1
              ? `Berhasil menambahkan waktu ${additionalMinutes} menit untuk ${result.count} peserta.`
              : `Berhasil menambahkan waktu ${additionalMinutes} menit untuk peserta.`,
          serverExpiresAt: result.serverExpiresAt,
        };
        break;
      }

      case 'FORCE_SUBMIT': {
        const result = await db.forceSubmitSession(ids);
        if (result.count === 0) {
          return NextResponse.json(
            { success: false, error: 'Gagal menyelesaikan sesi peserta.' },
            { status: 404 }
          );
        }
        responseJson = {
          success: true,
          count: result.count,
          message:
            ids.length > 1
              ? `Berhasil menyelesaikan ujian secara paksa untuk ${result.count} peserta.`
              : 'Sesi ujian berhasil diselesaikan secara paksa oleh pengawas.',
          data: result,
        };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Aksi recovery tidak dikenali.' },
          { status: 400 }
        );
    }

    // Log to audit_logs for examination accountability
    await queryPostgres(
      `INSERT INTO audit_logs (id, user_id, role, action, details_json, school_id)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4::jsonb, $5);`,
      [
        auth.user.id,
        auth.user.role,
        `PROCTOR_${action}`,
        JSON.stringify({
          participantIds: ids,
          participantCount: ids.length,
          additionalMinutes,
          actionBy: auth.user.fullName,
        }),
        auth.tenant.schoolId || auth.user.schoolId || null,
      ]
    ).catch((err) => console.error('Failed to write proctor audit log:', err));

    return NextResponse.json(responseJson);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses aksi recovery.' },
      { status: 500 }
    );
  }
}
