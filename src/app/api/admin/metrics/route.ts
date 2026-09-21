import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken } from '@/lib/core/auth';
import { getTenantContext } from '@/lib/core/tenant';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tenant = await getTenantContext(user, searchParams);

    const schoolFilter = tenant.schoolId ? `WHERE school_id = '${tenant.schoolId}'` : '';
    const schoolFilterExam = tenant.schoolId ? `AND e.school_id = '${tenant.schoolId}'` : '';

    const studentCountRes = await queryPostgres(`SELECT count(*) FROM students ${schoolFilter};`);
    const classCountRes = await queryPostgres(`SELECT count(*) FROM class_rooms ${schoolFilter};`);
    const questionCountRes = await queryPostgres(`SELECT count(*) FROM question_banks ${schoolFilter};`);
    const teacherCountRes = await queryPostgres(
      `SELECT count(*) FROM users WHERE role IN ('GURU', 'PENGAWAS') ${tenant.schoolId ? `AND school_id = '${tenant.schoolId}'` : ''};`
    );
    const schoolCountRes = await queryPostgres(`SELECT count(*) FROM schools WHERE is_active = true;`);
    const examCountRes = await queryPostgres(`SELECT count(*) FROM exams ${schoolFilter};`);
    const roomCountRes = await queryPostgres(`SELECT count(*) FROM exam_rooms ${schoolFilter};`);
    const proctorCountRes = await queryPostgres(
      `SELECT count(*) FROM users WHERE role = 'PENGAWAS' ${tenant.schoolId ? `AND school_id = '${tenant.schoolId}'` : ''};`
    );

    // Super Admin global ecosystem data
    let schoolsSummary: any[] = [];
    let globalStats: any = null;

    if (tenant.isSuperAdmin) {
      const globalStudentCount = await queryPostgres(`SELECT count(*) FROM students;`);
      const globalTeacherCount = await queryPostgres(
        `SELECT count(*) FROM users WHERE role IN ('GURU', 'PENGAWAS');`
      );
      const globalExamCount = await queryPostgres(`SELECT count(*) FROM exams;`);
      const globalQuestionCount = await queryPostgres(`SELECT count(*) FROM question_banks;`);
      const globalClassCount = await queryPostgres(`SELECT count(*) FROM class_rooms;`);

      globalStats = {
        totalSchools: parseInt(schoolCountRes.rows[0].count, 10),
        totalStudents: parseInt(globalStudentCount.rows[0].count, 10),
        totalTeachers: parseInt(globalTeacherCount.rows[0].count, 10),
        totalExams: parseInt(globalExamCount.rows[0].count, 10),
        totalQuestions: parseInt(globalQuestionCount.rows[0].count, 10),
        totalClasses: parseInt(globalClassCount.rows[0].count, 10),
      };

      const schoolsRes = await queryPostgres(`
        SELECT 
          s.id, s.name, s.code, s.level, s.logo_url, s.is_active, s.quota_students, s.quota_exams,
          COALESCE(stu.student_count, 0) as student_count,
          COALESCE(cls.class_count, 0) as class_count,
          COALESCE(ex.exam_count, 0) as exam_count
        FROM schools s
        LEFT JOIN (SELECT school_id, count(*) as student_count FROM students GROUP BY school_id) stu ON s.id = stu.school_id
        LEFT JOIN (SELECT school_id, count(*) as class_count FROM class_rooms GROUP BY school_id) cls ON s.id = cls.school_id
        LEFT JOIN (SELECT school_id, count(*) as exam_count FROM exams GROUP BY school_id) ex ON s.id = ex.school_id
        ORDER BY s.name ASC;
      `);

      schoolsSummary = schoolsRes.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        level: r.level,
        logoUrl: r.logo_url,
        isActive: r.is_active,
        quotaStudents: r.quota_students || 1000,
        quotaExams: r.quota_exams || 50,
        studentCount: parseInt(r.student_count, 10),
        classCount: parseInt(r.class_count, 10),
        examCount: parseInt(r.exam_count, 10),
      }));
    }

    // Active school profile (for School Admin or when Super Admin manages a specific school)
    let activeSchoolInfo = null;
    if (tenant.schoolId) {
      const scRes = await queryPostgres(
        `SELECT id, name, code, level, logo_url, principal_name, quota_students, quota_exams, is_active FROM schools WHERE id = $1 LIMIT 1;`,
        [tenant.schoolId]
      );
      if (scRes.rows.length > 0) {
        activeSchoolInfo = {
          id: scRes.rows[0].id,
          name: scRes.rows[0].name,
          code: scRes.rows[0].code,
          level: scRes.rows[0].level,
          logoUrl: scRes.rows[0].logo_url,
          principalName: scRes.rows[0].principal_name,
          quotaStudents: scRes.rows[0].quota_students || 1000,
          quotaExams: scRes.rows[0].quota_exams || 50,
          isActive: scRes.rows[0].is_active,
        };
      }
    }

    // Active exam query
    const examRes = await queryPostgres(
      `SELECT e.*, s.name as subject_name, sc.name as school_name, count(ep.id) as participant_count
       FROM exams e
       LEFT JOIN subjects s ON e.subject_id = s.id
       LEFT JOIN schools sc ON e.school_id = sc.id
       LEFT JOIN exam_participants ep ON e.id = ep.exam_id
       WHERE e.status = 'ACTIVE' ${schoolFilterExam}
       GROUP BY e.id, s.name, sc.name
       ORDER BY e.created_at DESC LIMIT 1;`
    );

    // Live session stats (scoped to tenant school)
    let liveSessionSql = `
      SELECT 
        COUNT(CASE WHEN es.status = 'IN_PROGRESS' THEN 1 END) as in_progress,
        COUNT(CASE WHEN es.status = 'SUBMITTED' THEN 1 END) as submitted,
        COUNT(CASE WHEN es.tab_violation_count > 0 THEN 1 END) as violations
      FROM exam_sessions es
      JOIN exam_participants ep ON es.participant_id = ep.id
      JOIN exams e ON ep.exam_id = e.id
    `;
    if (tenant.schoolId) {
      liveSessionSql += ` WHERE e.school_id = '${tenant.schoolId}'`;
    }
    const liveSessionRes = await queryPostgres(liveSessionSql);

    // Additional KPI queries for School Admin
    const activeExamsCountRes = await queryPostgres(
      `SELECT count(*) FROM exams WHERE status = 'ACTIVE' ${schoolFilterExam};`
    );
    const upcomingExamsCountRes = await queryPostgres(
      `SELECT count(*) FROM exams WHERE status IN ('SCHEDULED', 'READY', 'APPROVED') ${schoolFilterExam};`
    );
    const pendingReviewRes = await queryPostgres(`
      SELECT count(*) FROM exam_sessions es
      JOIN exam_participants ep ON es.participant_id = ep.id
      JOIN exams e ON ep.exam_id = e.id
      WHERE es.status = 'SUBMITTED' AND es.score IS NULL ${tenant.schoolId ? `AND e.school_id = '${tenant.schoolId}'` : ''};
    `);

    // Today / Recent Exams
    const todayExamsRes = await queryPostgres(`
      SELECT e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes,
             s.name as subject_name, cr.name as class_room_name, u.full_name as teacher_name,
             count(ep.id) as participant_count
      FROM exams e
      LEFT JOIN subjects s ON e.subject_id = s.id
      LEFT JOIN class_rooms cr ON e.class_room_id = cr.id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN exam_participants ep ON e.id = ep.exam_id
      WHERE 1=1 ${tenant.schoolId ? `AND e.school_id = '${tenant.schoolId}'` : ''}
      GROUP BY e.id, s.name, cr.name, u.full_name
      ORDER BY e.created_at DESC LIMIT 6;
    `);

    // Recent School Audit Activities
    const recentActivitiesRes = await queryPostgres(`
      SELECT al.id, al.action, al.resource_type, al.resource_id, al.details, al.created_at,
             u.full_name as actor_name, u.username as actor_username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1 ${tenant.schoolId ? `AND al.school_id = '${tenant.schoolId}'` : ''}
      ORDER BY al.created_at DESC LIMIT 8;
    `);

    const activeExam = examRes.rows[0] || null;
    const liveStats = liveSessionRes.rows[0] || { in_progress: 0, submitted: 0, violations: 0 };

    return NextResponse.json({
      success: true,
      data: {
        totalStudents: parseInt(studentCountRes.rows[0].count, 10),
        totalClasses: parseInt(classCountRes.rows[0].count, 10),
        totalQuestions: parseInt(questionCountRes.rows[0].count, 10),
        totalTeachers: parseInt(teacherCountRes.rows[0].count, 10),
        totalSchools: parseInt(schoolCountRes.rows[0].count, 10),
        totalExams: parseInt(examCountRes.rows[0].count, 10),
        totalRooms: parseInt(roomCountRes.rows[0].count, 10),
        totalProctors: parseInt(proctorCountRes.rows[0].count, 10),
        activeExamsCount: parseInt(activeExamsCountRes.rows[0].count, 10),
        upcomingExamsCount: parseInt(upcomingExamsCountRes.rows[0].count, 10),
        pendingReviewCount: parseInt(pendingReviewRes.rows[0].count, 10),
        globalStats,
        schoolsSummary,
        activeSchoolInfo,
        liveSessions: {
          inProgress: parseInt(liveStats.in_progress || '0', 10),
          submitted: parseInt(liveStats.submitted || '0', 10),
          violations: parseInt(liveStats.violations || '0', 10),
        },
        todayExams: todayExamsRes.rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          startTime: r.start_time,
          endTime: r.end_time,
          durationMinutes: r.duration_minutes,
          subjectName: r.subject_name || 'Umum',
          className: r.class_room_name || 'Semua Kelas',
          teacherName: r.teacher_name || 'Admin',
          participantCount: parseInt(r.participant_count || '0', 10),
        })),
        recentActivities: recentActivitiesRes.rows.map((r: any) => ({
          id: r.id,
          action: r.action,
          resourceType: r.resource_type,
          resourceId: r.resource_id,
          details: r.details,
          createdAt: r.created_at,
          actorName: r.actor_name || r.actor_username || 'Sistem',
        })),
        activeExam: activeExam
          ? {
              id: activeExam.id,
              title: activeExam.title,
              subjectName: activeExam.subject_name,
              schoolName: activeExam.school_name,
              status: activeExam.status,
              durationMinutes: activeExam.duration_minutes,
              totalQuestions: (activeExam.question_snapshot_json || []).length,
              participantCount: parseInt(activeExam.participant_count, 10),
            }
          : null,
        currentSchoolId: tenant.schoolId,
        isSuperAdmin: tenant.isSuperAdmin,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat metrik admin.' },
      { status: 500 }
    );
  }
}
