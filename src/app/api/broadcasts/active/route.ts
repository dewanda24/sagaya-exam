import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken } from '@/lib/core/auth';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    const { searchParams } = new URL(req.url);
    const audienceParam = searchParams.get('audience') || (user?.role === 'ADMIN' ? 'ADMIN_ONLY' : 'ALL');
    const schoolIdParam = searchParams.get('schoolId') || user?.schoolId || null;

    let query = `
      SELECT 
        id, title, message, priority, target_audience, target_school_id, start_at, expires_at, created_at
      FROM broadcast_announcements
      WHERE is_active = true
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (start_at <= NOW())
        AND (
          target_audience = 'ALL'
          OR target_audience = $1
          OR (target_audience = 'SPECIFIC_SCHOOL' AND target_school_id = $2)
        )
      ORDER BY 
        CASE priority 
          WHEN 'URGENT' THEN 1 
          WHEN 'WARNING' THEN 2 
          ELSE 3 
        END ASC,
        created_at DESC
      LIMIT 10;
    `;

    const res = await queryPostgres(query, [audienceParam, schoolIdParam]);

    return NextResponse.json({
      success: true,
      data: res.rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        priority: r.priority,
        targetAudience: r.target_audience,
        startAt: r.start_at,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat pengumuman aktif.' },
      { status: 500 }
    );
  }
}
