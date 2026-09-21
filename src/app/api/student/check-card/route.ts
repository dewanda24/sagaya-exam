import { NextResponse } from 'next/server';
import { db } from '@/lib/school/db-service';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/core/rate-limit';
import { verifySessionToken } from '@/lib/core/auth';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);

    // Rate Limiting: max 20 attempts per minute per IP (prevents NISN enumeration)
    const rl = checkRateLimit(`check-card:ip:${clientIp}`, RATE_LIMITS.CHECK_CARD);
    if (!rl.success) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak permintaan cek kartu. Silakan coba lagi dalam ${Math.ceil((rl.retryAfterMs || 60000) / 1000)} detik.`,
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

    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Masukkan NISN atau Kode Akses Kartu yang valid.' },
        { status: 400 }
      );
    }

    const cleanQuery = query.trim().toUpperCase();
    const student = await db.getStudentByNisnOrCode(cleanQuery);
    if (!student) {
      return NextResponse.json(
        {
          success: false,
          error: 'Data siswa tidak ditemukan. Pastikan NISN atau Kode Akses Kartu sesuai dengan data sekolah.',
        },
        { status: 404 }
      );
    }

    const cardData = await db.getStudentCardData(student.id);
    if (!cardData) {
      return NextResponse.json(
        { success: false, error: 'Data kartu tidak ditemukan.' },
        { status: 404 }
      );
    }

    // Check authorization to view active exam tokens:
    // 1. Authorized if query matches student's private cardAccessCode
    const isAccessCodeMatch =
      !!student.cardAccessCode &&
      cleanQuery === student.cardAccessCode.trim().toUpperCase();

    // 2. Authorized if request comes from authenticated staff (PENGAWAS, ADMIN, SUPER_ADMIN)
    let isStaff = false;
    const cookieHeader = req.headers.get('cookie') || '';
    const staffMatch = cookieHeader.match(/sagaya_session=([^;]+)/);
    if (staffMatch) {
      const staffUser = await verifySessionToken(decodeURIComponent(staffMatch[1].trim()));
      if (staffUser && ['SUPER_ADMIN', 'ADMIN', 'PENGAWAS'].includes(staffUser.role)) {
        isStaff = true;
      }
    }

    const canViewRawTokens = isAccessCodeMatch || isStaff;

    // Mask active tokens and access code if only public identifier (NISN/NIS) was provided
    const safeStudent = {
      ...cardData.student,
      cardAccessCode: canViewRawTokens ? cardData.student.cardAccessCode : '••••••••',
    };

    const safeExams = cardData.exams.map((exam) => {
      if (!canViewRawTokens) {
        return {
          ...exam,
          token: '••••••••',
          isTokenMasked: true,
          tokenNote: 'Masukkan Kode Akses Kartu fisik untuk melihat token aktif.',
        };
      }
      return {
        ...exam,
        isTokenMasked: false,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        student: safeStudent,
        exams: safeExams,
        authenticatedViaCode: canViewRawTokens,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan sistem.' },
      { status: 500 }
    );
  }
}
