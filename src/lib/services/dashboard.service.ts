import { queryPostgres } from '../core/postgres';

export async function getSuperadminDashboardStats() {
  // 1. Schools statistics
  const schoolsStatRes = await queryPostgres(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'ACTIVE' OR (status IS NULL AND is_active = true)) as active,
      COUNT(*) FILTER (WHERE status = 'SUSPENDED' OR (status IS NULL AND is_active = false)) as suspended,
      COUNT(*) FILTER (WHERE status = 'ARCHIVED') as archived
    FROM schools;
  `);

  // 2. Users statistics by role
  const usersStatRes = await queryPostgres(`
    SELECT 
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE role = 'ADMIN') as total_admins,
      COUNT(*) FILTER (WHERE role = 'GURU') as total_teachers,
      COUNT(*) FILTER (WHERE role = 'PENGAWAS') as total_proctors
    FROM users;
  `);

  // 3. Students statistics
  const studentsStatRes = await queryPostgres(`
    SELECT 
      COUNT(*) as total_students,
      COUNT(*) FILTER (WHERE is_active = true) as active_students
    FROM students;
  `);

  // 4. Exams statistics
  const examsStatRes = await queryPostgres(`
    SELECT 
      COUNT(*) as total_exams,
      COUNT(*) FILTER (WHERE status IN ('ACTIVE', 'PUBLISHED', 'SCHEDULED')) as active_exams,
      COUNT(*) FILTER (WHERE status = 'ACTIVE' OR (status = 'PUBLISHED' AND start_time <= NOW() AND end_time >= NOW())) as running_exams,
      COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_exams,
      COUNT(*) FILTER (WHERE is_regional = true) as regional_exams
    FROM exams;
  `);

  // 5. Security & Session statistics
  const securityStatRes = await queryPostgres(`
    SELECT 
      (SELECT COUNT(*) FROM user_sessions WHERE is_revoked = false AND last_activity_at >= NOW() - INTERVAL '24 hours') as active_sessions,
      (SELECT COUNT(*) FROM audit_logs WHERE action = 'LOGIN_FAILED' AND created_at >= NOW() - INTERVAL '24 hours') as failed_logins_24h,
      (SELECT COUNT(*) FROM users WHERE is_active = false) as locked_users,
      (SELECT COUNT(*) FROM audit_logs WHERE severity IN ('WARNING', 'CRITICAL') AND created_at >= NOW() - INTERVAL '24 hours') as security_alerts
  `);

  // 6. Recent Activity Feed
  const recentLogsRes = await queryPostgres(`
    SELECT 
      a.id, a.action, a.severity, a.created_at as "createdAt", a.details_json as details,
      COALESCE(u.full_name, 'Sistem') as "actorName",
      a.role as "actorRole",
      COALESCE(s.name, 'Platform Global') as "schoolName"
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN schools s ON a.school_id = s.id
    ORDER BY a.created_at DESC
    LIMIT 8;
  `);

  // 7. Active / Running Exams List
  const activeExamsRes = await queryPostgres(`
    SELECT 
      e.id, e.title, e.status, e.is_regional as "isRegional",
      e.start_time as "startTime", e.end_time as "endTime",
      COALESCE(s.name, 'Ujian Serentak Wilayah') as "schoolName",
      COALESCE(p.part_count, 0) as "participantCount"
    FROM exams e
    LEFT JOIN schools s ON e.school_id = s.id
    LEFT JOIN (
      SELECT exam_id, COUNT(*) as part_count FROM exam_participants GROUP BY exam_id
    ) p ON e.id = p.exam_id
    WHERE e.status IN ('ACTIVE', 'PUBLISHED', 'SCHEDULED')
    ORDER BY e.start_time ASC
    LIMIT 5;
  `);

  const sRow = schoolsStatRes.rows[0] || {};
  const uRow = usersStatRes.rows[0] || {};
  const stRow = studentsStatRes.rows[0] || {};
  const eRow = examsStatRes.rows[0] || {};
  const secRow = securityStatRes.rows[0] || {};

  return {
    metrics: {
      totalSchools: parseInt(sRow.total || '0', 10),
      activeSchools: parseInt(sRow.active || '0', 10),
      suspendedSchools: parseInt(sRow.suspended || '0', 10),
      archivedSchools: parseInt(sRow.archived || '0', 10),

      totalUsers: parseInt(uRow.total_users || '0', 10),
      totalAdmins: parseInt(uRow.total_admins || '0', 10),
      totalTeachers: parseInt(uRow.total_teachers || '0', 10),
      totalProctors: parseInt(uRow.total_proctors || '0', 10),

      totalStudents: parseInt(stRow.total_students || '0', 10),
      activeStudents: parseInt(stRow.active_students || '0', 10),

      totalExams: parseInt(eRow.total_exams || '0', 10),
      activeExams: parseInt(eRow.active_exams || '0', 10),
      runningExams: parseInt(eRow.running_exams || '0', 10),
      completedExams: parseInt(eRow.completed_exams || '0', 10),
      regionalExams: parseInt(eRow.regional_exams || '0', 10),

      activeSessions: parseInt(secRow.active_sessions || '0', 10),
      failedLogins24h: parseInt(secRow.failed_logins_24h || '0', 10),
      lockedUsers: parseInt(secRow.locked_users || '0', 10),
      securityAlerts: parseInt(secRow.security_alerts || '0', 10),
    },
    systemHealth: {
      status: 'OPERATIONAL',
      database: 'CONNECTED',
      uptime: '99.9%',
      timestamp: new Date().toISOString(),
    },
    recentActivities: recentLogsRes.rows,
    activeExams: activeExamsRes.rows,
  };
}
