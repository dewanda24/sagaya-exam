import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateServerSession } from '@/lib/core/auth';

/**
 * Backwards-compatible alias for /api/auth/session
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;

    if (!token) {
      return NextResponse.json({ success: true, user: null });
    }

    const sessionUser = await validateServerSession(token);
    if (!sessionUser) {
      const res = NextResponse.json({ success: true, user: null });
      res.cookies.delete('sagaya_session');
      return res;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: sessionUser.id,
        name: sessionUser.fullName,
        fullName: sessionUser.fullName,
        username: sessionUser.username,
        role: sessionUser.role,
        schoolId: sessionUser.schoolId,
        schoolName: sessionUser.schoolName,
      },
    });
  } catch {
    return NextResponse.json({ success: true, user: null });
  }
}
