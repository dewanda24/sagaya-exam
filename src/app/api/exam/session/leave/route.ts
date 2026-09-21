import { NextResponse } from 'next/server';

/**
 * POST /api/exam/session/leave
 * Clears student session cookie when student rejects identity or leaves lobby
 */
export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Sesi peserta berhasil direset.',
  });

  response.cookies.delete('sagaya_student_session');

  return response;
}
