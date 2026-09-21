import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { validateServerSession } from '@/lib/core/auth';
import { getUserActiveSessions } from '@/lib/services/security.service';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await validateServerSession(token);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Session expired or invalid' }, { status: 401 });
    }

    const currentTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessions = await getUserActiveSessions(user.id, currentTokenHash);

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Gagal memuat sesi aktif.' },
      { status: 500 }
    );
  }
}
