import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateServerSession } from '@/lib/core/auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;

    if (!token) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const sessionUser = await validateServerSession(token);

    if (!sessionUser) {
      const res = NextResponse.json({
        authenticated: false,
        user: null,
      });
      // Invalidate invalid/expired cookie
      res.cookies.delete('sagaya_session');
      return res;
    }

    // Only return safe user fields per specification #29
    return NextResponse.json({
      authenticated: true,
      user: {
        id: sessionUser.id,
        name: sessionUser.fullName,
        username: sessionUser.username,
        role: sessionUser.role,
        schoolId: sessionUser.schoolId,
        schoolName: sessionUser.schoolName,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 200 }
    );
  }
}
