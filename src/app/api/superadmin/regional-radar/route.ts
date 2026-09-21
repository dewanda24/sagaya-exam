import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';
import { getSystemSetting } from '@/lib/superadmin/system-settings';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    // 1. Fetch system integrity policy
    const integrityPolicy = (await getSystemSetting('integrity_policy', {
      maxTabSwitch: 3,
      heartbeatIntervalSeconds: 15,
      lateToleranceMinutes: 30,
      forceFullscreen: true,
    })) as any;

    const maxTabSwitch = integrityPolicy.maxTabSwitch || 3;

    // 2. Macro Concurrency se-wilayah
    const concurrencyRes = await queryPostgres(`
      SELECT 
        COUNT(CASE WHEN es.status = 'IN_PROGRESS' THEN 1 END) as active_test_takers,
        COUNT(CASE WHEN es.status = 'SUBMITTED' THEN 1 END) as completed_sessions,
        COALESCE(SUM(es.tab_violation_count), 0) as total_violations,
        COUNT(DISTINCT e.id) as total_exams,
        COUNT(DISTINCT sc.id) as active_schools
      FROM exam_sessions es
      JOIN exam_participants ep ON es.participant_id = ep.id
      JOIN exams e ON ep.exam_id = e.id
      JOIN schools sc ON e.school_id = sc.id;
    `);

    const c = concurrencyRes.rows[0] || {};
    const concurrency = {
      activeTestTakers: parseInt(c.active_test_takers || '0', 10),
      completedSessions: parseInt(c.completed_sessions || '0', 10),
      totalViolations: parseInt(c.total_violations || '0', 10),
      totalExams: parseInt(c.total_exams || '0', 10),
      activeSchools: parseInt(c.active_schools || '0', 10),
    };

    // 3. Integrity Alerts: High Tab Violations (>= maxTabSwitch)
    const highTabViolationsRes = await queryPostgres(
      `SELECT 
         es.id as session_id,
         es.tab_violation_count,
         es.status as session_status,
         es.last_heartbeat_at,
         es.server_started_at,
         s.full_name as student_name,
         s.nisn,
         sc.name as school_name,
         sc.code as school_code,
         sc.rayon,
         e.title as exam_title,
         e.duration_minutes
       FROM exam_sessions es
       JOIN exam_participants ep ON es.participant_id = ep.id
       JOIN students s ON ep.student_id = s.id
       JOIN exams e ON ep.exam_id = e.id
       JOIN schools sc ON e.school_id = sc.id
       WHERE es.tab_violation_count >= $1
       ORDER BY es.tab_violation_count DESC, es.last_heartbeat_at DESC
       LIMIT 50;`,
      [maxTabSwitch]
    );

    // 4. Abnormal Quick Submits (< 20% duration with high score or extreme anomalies)
    const quickSubmitsRes = await queryPostgres(`
      SELECT 
        es.id as session_id,
        ep.final_score,
        es.tab_violation_count,
        ROUND((EXTRACT(EPOCH FROM (es.updated_at - es.server_started_at)) / 60)::numeric, 1) as completion_minutes,
        e.duration_minutes,
        s.full_name as student_name,
        s.nisn,
        sc.name as school_name,
        sc.code as school_code,
        sc.rayon,
        e.title as exam_title
      FROM exam_sessions es
      JOIN exam_participants ep ON es.participant_id = ep.id
      JOIN students s ON ep.student_id = s.id
      JOIN exams e ON ep.exam_id = e.id
      JOIN schools sc ON e.school_id = sc.id
      WHERE es.status = 'SUBMITTED' 
        AND es.updated_at IS NOT NULL 
        AND es.server_started_at IS NOT NULL
        AND (EXTRACT(EPOCH FROM (es.updated_at - es.server_started_at)) / 60) < (e.duration_minutes * 0.25)
      ORDER BY completion_minutes ASC
      LIMIT 30;
    `);

    // 5. School Integrity Ranking & Incident Rate
    const schoolRankingsRes = await queryPostgres(`
      SELECT 
        sc.id as school_id,
        sc.name as school_name,
        sc.code as school_code,
        sc.rayon,
        COUNT(DISTINCT ep.id) as total_participants,
        COUNT(DISTINCT CASE WHEN es.status = 'IN_PROGRESS' THEN es.id END) as live_students,
        COALESCE(SUM(es.tab_violation_count), 0) as total_violations,
        COUNT(DISTINCT CASE WHEN es.tab_violation_count >= 3 THEN es.id END) as flagged_students
      FROM schools sc
      LEFT JOIN exams e ON sc.id = e.school_id
      LEFT JOIN exam_participants ep ON e.id = ep.exam_id
      LEFT JOIN exam_sessions es ON ep.id = es.participant_id
      WHERE sc.is_active = true
      GROUP BY sc.id, sc.name, sc.code, sc.rayon
      ORDER BY total_violations DESC, flagged_students DESC;
    `);

    return NextResponse.json({
      success: true,
      data: {
        concurrency,
        maxTabSwitchThreshold: maxTabSwitch,
        alerts: {
          highTabViolations: highTabViolationsRes.rows.map((r: any) => ({
            sessionId: r.session_id,
            studentName: r.student_name,
            nisn: r.nisn,
            schoolName: r.school_name,
            schoolCode: r.school_code,
            rayon: r.rayon || 'Rayon 1',
            examTitle: r.exam_title,
            tabViolationCount: r.tab_violation_count,
            sessionStatus: r.session_status,
            lastHeartbeatAt: r.last_heartbeat_at,
          })),
          quickSubmits: quickSubmitsRes.rows.map((r: any) => ({
            sessionId: r.session_id,
            studentName: r.student_name,
            nisn: r.nisn,
            schoolName: r.school_name,
            schoolCode: r.school_code,
            rayon: r.rayon || 'Rayon 1',
            examTitle: r.exam_title,
            finalScore: r.final_score ? parseFloat(r.final_score) : null,
            completionMinutes: parseFloat(r.completion_minutes),
            durationMinutes: r.duration_minutes,
            tabViolationCount: r.tab_violation_count,
          })),
        },
        schoolIntegrityRankings: schoolRankingsRes.rows.map((r: any) => {
          const totalPart = parseInt(r.total_participants || '0', 10);
          const flagged = parseInt(r.flagged_students || '0', 10);
          const incidentRate = totalPart > 0 ? Math.round((flagged / totalPart) * 100) : 0;
          return {
            schoolId: r.school_id,
            schoolName: r.school_name,
            schoolCode: r.school_code,
            rayon: r.rayon || 'Rayon 1',
            totalParticipants: totalPart,
            liveStudents: parseInt(r.live_students || '0', 10),
            totalViolations: parseInt(r.total_violations || '0', 10),
            flaggedStudents: flagged,
            incidentRate,
          };
        }),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat telemetri radar wilayah.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { action, sessionId, announcementMessage } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Aksi wajib ditentukan.' }, { status: 400 });
    }

    // 1. Force Submit a session
    if (action === 'FORCE_FINISH_SESSION') {
      if (!sessionId) {
        return NextResponse.json({ success: false, error: 'sessionId wajib diisi.' }, { status: 400 });
      }

      await queryPostgres(
        `UPDATE exam_sessions 
         SET status = 'SUBMITTED',
             server_expires_at = NOW(),
             updated_at = NOW() 
         WHERE id = $1;`,
        [sessionId]
      );

      // Audit log
      await queryPostgres(
        `INSERT INTO audit_logs (id, user_id, action, details_json, created_at)
         VALUES (uuid_generate_v4(), $1, 'SUPER_ADMIN_FORCE_FINISH_SESSION', $2::jsonb, NOW());`,
        [auth.user.id, JSON.stringify({ sessionId, reason: 'Intervensi Radar Integritas Wilayah' })]
      );

      return NextResponse.json({
        success: true,
        message: 'Sesi siswa berhasil dihentikan paksa dari pusat komando wilayah.',
      });
    }

    // 2. Reset Device Lock for a session
    if (action === 'RESET_DEVICE_SESSION') {
      if (!sessionId) {
        return NextResponse.json({ success: false, error: 'sessionId wajib diisi.' }, { status: 400 });
      }

      await queryPostgres(
        `UPDATE exam_sessions 
         SET device_fingerprint = NULL,
             tab_violation_count = 0,
             updated_at = NOW() 
         WHERE id = $1;`,
        [sessionId]
      );

      // Audit log
      await queryPostgres(
        `INSERT INTO audit_logs (id, user_id, action, details_json, created_at)
         VALUES (uuid_generate_v4(), $1, 'SUPER_ADMIN_RESET_DEVICE', $2::jsonb, NOW());`,
        [auth.user.id, JSON.stringify({ sessionId, reason: 'Reset Kunci Perangkat oleh Dinas' })]
      );

      return NextResponse.json({
        success: true,
        message: 'Kunci perangkat dan batas pelanggaran siswa berhasil di-reset.',
      });
    }

    // 3. Emergency Announcement Broadcast
    if (action === 'BROADCAST_EMERGENCY_ANNOUNCEMENT') {
      if (!announcementMessage) {
        return NextResponse.json({ success: false, error: 'announcementMessage wajib diisi.' }, { status: 400 });
      }

      await queryPostgres(
        `UPDATE system_settings 
         SET value_json = jsonb_set(value_json, '{announcement}', $1::jsonb),
             updated_at = NOW(),
             updated_by = $2
         WHERE key = 'operational_mode';`,
        [JSON.stringify(announcementMessage), auth.user.id]
      );

      // Audit log
      await queryPostgres(
        `INSERT INTO audit_logs (id, user_id, action, details_json, created_at)
         VALUES (uuid_generate_v4(), $1, 'BROADCAST_EMERGENCY_ANNOUNCEMENT', $2::jsonb, NOW());`,
        [auth.user.id, JSON.stringify({ message: announcementMessage })]
      );

      return NextResponse.json({
        success: true,
        message: 'Pengumuman darurat berhasil disiarkan ke seluruh pengawas dan siswa se-wilayah.',
      });
    }

    return NextResponse.json({ success: false, error: 'Aksi intervensi tidak dikenal.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses intervensi radar.' },
      { status: 500 }
    );
  }
}
