import { NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/core/postgres';
import { verifyStudentSessionAccess } from '@/lib/core/auth';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/core/rate-limit';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`confirm-session:ip:${clientIp}`, RATE_LIMITS.VALIDATE_TOKEN);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan. Silakan coba lagi sebentar lagi.' },
        { status: 429 }
      );
    }

    const { sessionId, examId, proctorToken } = await req.json();

    if (!sessionId || !examId) {
      return NextResponse.json(
        { success: false, error: 'Data sesi atau ujian tidak lengkap.' },
        { status: 400 }
      );
    }

    // Verify session access / ownership (IDOR protection)
    const authCheck = await verifyStudentSessionAccess(req, sessionId);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error || 'Akses ditolak.' },
        { status: authCheck.status || 401 }
      );
    }

    const examRes = await queryPostgres(
      `SELECT id, title, release_token, token_released_at, token_expires_at, status 
       FROM exams 
       WHERE id = $1;`,
      [examId]
    );

    if (examRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ujian tidak ditemukan.' },
        { status: 404 }
      );
    }

    const exam = examRes.rows[0];

    // Check if exam requires proctor session token
    if (exam.release_token) {
      if (!proctorToken || !proctorToken.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: 'Token Sesi Proktor wajib dimasukkan untuk memulai ujian ini.',
            code: 'PROCTOR_TOKEN_REQUIRED',
          },
          { status: 400 }
        );
      }

      const cleanInput = proctorToken.trim().toUpperCase();
      const serverToken = exam.release_token.trim().toUpperCase();

      if (cleanInput !== serverToken) {
        return NextResponse.json(
          {
            success: false,
            error: 'Token Sesi Proktor salah. Silakan periksa kembali token yang tertera di proyektor lab.',
            code: 'INVALID_PROCTOR_TOKEN',
          },
          { status: 400 }
        );
      }

      if (exam.token_expires_at) {
        const now = new Date();
        const expiresAt = new Date(exam.token_expires_at);
        if (now > expiresAt) {
          return NextResponse.json(
            {
              success: false,
              error: 'Token Sesi Proktor telah kedaluwarsa. Silakan minta Proktor di ruangan untuk merilis token baru.',
              code: 'PROCTOR_TOKEN_EXPIRED',
            },
            { status: 400 }
          );
        }
      }
    }

    // Verify session exists and is active
    const sessRes = await queryPostgres(
      `SELECT id, status FROM exam_sessions WHERE id = $1;`,
      [sessionId]
    );

    if (sessRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sesi ujian tidak valid.' },
        { status: 404 }
      );
    }

    if (sessRes.rows[0].status === 'SUBMITTED') {
      return NextResponse.json(
        { success: false, error: 'Ujian ini sudah diselesaikan sebelumnya.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Token sesi proktor valid. Mengalihkan ke bilik ujian...',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memverifikasi token sesi.' },
      { status: 500 }
    );
  }
}
