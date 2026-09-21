import { NextResponse } from 'next/server';
import { ExamSessionStateService } from '@/lib/services/exam-session-state.service';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/core/rate-limit';
import { formatTokenInput } from '@/lib/school/token-generator';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json().catch(() => ({}));
    const { token, deviceId } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token ujian wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanedToken = formatTokenInput(token);
    const safeDeviceId = (deviceId && typeof deviceId === 'string' ? deviceId.trim() : '') || 'web-client-' + clientIp;

    // Rate Limiting: IP + Token Attempt Context
    const rateLimitKey = `exam-auth:${clientIp}:${cleanedToken.slice(0, 4)}`;
    const rl = checkRateLimit(rateLimitKey, RATE_LIMITS.EXAM_TOKEN_ATTEMPT);
    if (!rl.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan autentikasi. Coba lagi dalam ${Math.ceil((rl.retryAfterMs || 60000) / 1000)} detik.`,
          code: 'RATE_LIMITED',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)),
          },
        }
      );
    }

    const userAgent = req.headers.get('user-agent') || '';
    const result = await ExamSessionStateService.authenticateAndCreateSession({
      token: cleanedToken,
      deviceId: safeDeviceId,
      userAgent,
      ipAddress: clientIp,
    });

    if (!result.success || !result.token) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Autentikasi ujian gagal.',
          code: result.code,
        },
        { status: result.status || 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Autentikasi ujian berhasil.',
      data: {
        session: result.session,
        participant: result.participant,
        exam: result.exam,
      },
    });

    // Set secure HttpOnly cookie for student session
    response.cookies.set('sagaya_student_session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: (result.durationHours || 4) * 3600,
    });

    // Set device identifier cookie for continuity
    response.cookies.set('sagaya_device_id', safeDeviceId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 3600,
    });

    return response;
  } catch (error: any) {
    console.error('Error in /api/exam/authenticate:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan sistem internal.' },
      { status: 500 }
    );
  }
}
