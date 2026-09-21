import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { executeEmergencyOperation } from '@/lib/services/emergency.service';
import { queryPostgres } from '@/lib/core/postgres';
import { getClientIp } from '@/lib/core/rate-limit';

export async function GET() {
  const auth = await requireApiPermission('emergency.manage');
  if (!auth.authorized) return auth.response;

  try {
    // Ambil data unit aktif yang sedang ujian hari ini
    const query = `
      SELECT 
        s.id as school_id,
        s.name as school_name,
        s.code as school_code,
        s.rayon,
        e.id as exam_id,
        e.title as exam_title,
        e.status as exam_status,
        e.start_time,
        e.end_time,
        COUNT(es.id) as total_sessions,
        COUNT(CASE WHEN es.status = 'IN_PROGRESS' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN es.status = 'DISCONNECTED' THEN 1 END) as disconnected_count,
        COUNT(CASE WHEN es.status = 'LOCKED' THEN 1 END) as locked_count,
        COUNT(CASE WHEN es.status = 'SUBMITTED' THEN 1 END) as submitted_count
      FROM schools s
      JOIN students stu ON s.id = stu.school_id
      JOIN exam_participants ep ON stu.id = ep.student_id
      JOIN exams e ON ep.exam_id = e.id
      LEFT JOIN exam_sessions es ON ep.id = es.participant_id
      WHERE e.status IN ('ACTIVE', 'PUBLISHED', 'SCHEDULED')
         OR es.created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY s.id, s.name, s.code, s.rayon, e.id, e.title, e.status, e.start_time, e.end_time
      ORDER BY in_progress_count DESC, s.name ASC;
    `;

    const res = await queryPostgres(query);

    const activeUnits = res.rows.map((r: any) => ({
      schoolId: r.school_id,
      schoolName: r.school_name,
      schoolCode: r.school_code,
      rayon: r.rayon || 'Rayon 1 - Pusat',
      examId: r.exam_id,
      examTitle: r.exam_title,
      examStatus: r.exam_status,
      startTime: r.start_time,
      endTime: r.end_time,
      metrics: {
        totalSessions: parseInt(r.total_sessions || '0', 10),
        inProgress: parseInt(r.in_progress_count || '0', 10),
        disconnected: parseInt(r.disconnected_count || '0', 10),
        locked: parseInt(r.locked_count || '0', 10),
        submitted: parseInt(r.submitted_count || '0', 10),
      },
    }));

    // Ambil log darurat terakhir dari audit_logs
    const auditRes = await queryPostgres(`
      SELECT 
        al.id, al.action, al.details_json as details, al.created_at as "createdAt",
        COALESCE(u.full_name, 'Super Admin') as "operatorName"
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.action LIKE 'EMERGENCY_%'
      ORDER BY al.created_at DESC
      LIMIT 10;
    `);

    return NextResponse.json({
      success: true,
      data: {
        activeUnits,
        recentLogs: auditRes.rows,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat status darurat.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireApiPermission('emergency.manage');
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Mendukung legacy format dan payload format terstandarisasi
    const action = body.action;
    const targetId = body.targetId || body.schoolId || body.examId;
    const reason = body.reason;

    if (!action || !reason) {
      return NextResponse.json(
        { success: false, error: 'Aksi darurat dan alasan (reason) wajib disertakan.' },
        { status: 400 }
      );
    }

    if (reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Alasan tindakan darurat harus minimal 5 karakter.' },
        { status: 400 }
      );
    }

    // Map legacy actions if needed
    let mappedAction = action;
    if (action === 'EXTEND_TIME') mappedAction = 'EXTEND_EXAM_TIME';
    if (action === 'FORCE_FINISH') mappedAction = 'STOP_EXAM';
    if (action === 'SUSPEND') mappedAction = 'SUSPEND_SCHOOL';

    const result = await executeEmergencyOperation(
      {
        action: mappedAction,
        targetId,
        reason: reason.trim(),
        minutesToExtend: body.extraMinutes || body.minutesToExtend,
        broadcastMessage: body.broadcastMessage,
      },
      {
        id: auth.user.id,
        role: auth.user.role,
        fullName: auth.user.fullName,
        ip: clientIp,
        userAgent,
      }
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengeksekusi aksi darurat.' },
      { status: 400 }
    );
  }
}
