import { NextResponse } from 'next/server';
import { db } from '@/lib/school/db-service';
import { formatTokenInput } from '@/lib/school/token-generator';
import { createStudentSessionToken } from '@/lib/core/auth';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/core/rate-limit';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);

    // Rate Limiting: max 10 attempts per minute per IP
    const rl = checkRateLimit(`validate-token:ip:${clientIp}`, RATE_LIMITS.VALIDATE_TOKEN);
    if (!rl.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan validasi token. Coba lagi dalam ${Math.ceil((rl.retryAfterMs || 60000) / 1000)} detik.`,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rl.retryAfterMs || 60000) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const { token, deviceFingerprint } = await req.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token ujian wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanedToken = formatTokenInput(token);
    const fingerprint = deviceFingerprint || 'generic-browser-device';

    const result = await db.validateTokenAndGetExam(cleanedToken, fingerprint);

    if (!result.success || !result.session || !result.exam || !result.participant || !result.participant.student) {
      const statusCode = result.code === 'DEVICE_CONFLICT' ? 409 : 400;
      return NextResponse.json(
        { success: false, error: result.error || 'Data peserta tidak valid.', code: result.code },
        { status: statusCode }
      );
    }

    // Generate cryptographically signed student session token (HMAC-SHA256)
    const durationHours = Math.ceil((result.exam.durationMinutes || 90) / 60) + 3;
    const studentSessionToken = await createStudentSessionToken({
      sessionId: result.session.id,
      examId: result.exam.id,
      participantId: result.participant.id,
      studentId: result.participant.student.id,
      studentName: result.participant.student.fullName,
      deviceFingerprint: fingerprint,
      durationHours,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        sessionId: result.session.id,
        studentSessionToken,
        participant: {
          studentName: result.participant.student.fullName,
          nisn: result.participant.student.nisn,
          className: result.participant.student.classRoomName,
          package: result.participant.assignedPackage,
        },
        exam: {
          id: result.exam.id,
          title: result.exam.title,
          subject: result.exam.subjectName,
          durationMinutes: result.exam.durationMinutes,
          totalQuestions: result.exam.questionSnapshotJson?.length || 0,
          serverStartedAt: result.session.serverStartedAt,
          serverExpiresAt: result.session.serverExpiresAt,
          requiresProctorToken: !!result.exam.releaseToken,
        },
      },
    });

    // Set secure HttpOnly cookie for automatic student session authorization
    response.cookies.set('sagaya_student_session', studentSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: durationHours * 3600,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan sistem.' },
      { status: 500 }
    );
  }
}
