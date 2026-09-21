import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['ADMIN', 'SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan untuk Admin ini.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 1. Eksekusi query agregasi metrik spesifik tenant
    const [
      schoolRes,
      studentsRes,
      teachersRes,
      proctorsRes,
      classesRes,
      subjectsRes,
      examsRes,
      questionsRes,
      sessionsRes,
      recentAuditRes,
    ] = await Promise.all([
      queryPostgres(`SELECT id, name, code, level, logo_url, principal_name, quota_students, quota_exams, status, is_active FROM schools WHERE id = $1 LIMIT 1;`, [schoolId]),
      queryPostgres(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM students WHERE school_id = $1;`, [schoolId]),
      queryPostgres(`SELECT COUNT(*) as total FROM users WHERE school_id = $1 AND role = 'GURU' AND is_active = true;`, [schoolId]),
      queryPostgres(`SELECT COUNT(*) as total FROM users WHERE school_id = $1 AND role = 'PENGAWAS' AND is_active = true;`, [schoolId]),
      queryPostgres(`SELECT COUNT(*) as total FROM class_rooms WHERE school_id = $1;`, [schoolId]),
      queryPostgres(`SELECT COUNT(*) as total FROM subjects WHERE school_id = $1;`, [schoolId]),
      queryPostgres(`
        SELECT 
          COUNT(*) as total_exams,
          COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_exams,
          COUNT(*) FILTER (WHERE status = 'SCHEDULED' OR (status = 'ACTIVE' AND start_time > NOW())) as upcoming_exams,
          COUNT(*) FILTER (WHERE status = 'COMPLETED' OR (status = 'ACTIVE' AND end_time < NOW())) as completed_exams
        FROM exams WHERE school_id = $1;
      `, [schoolId]),
      queryPostgres(`SELECT COUNT(*) as total FROM question_banks WHERE school_id = $1;`, [schoolId]),
      queryPostgres(`
        SELECT 
          COUNT(*) FILTER (WHERE es.status = 'IN_PROGRESS') as active_sessions,
          COUNT(*) FILTER (WHERE es.tab_violation_count > 0 OR es.status = 'DISCONNECTED' OR es.status = 'LOCKED') as problem_sessions
        FROM exam_sessions es
        JOIN exam_participants ep ON es.participant_id = ep.id
        JOIN exams e ON ep.exam_id = e.id
        WHERE e.school_id = $1;
      `, [schoolId]),
      queryPostgres(`
        SELECT al.id, al.action, al.created_at, al.role, al.resource_type, al.resource_id, al.severity,
               u.full_name as actor_name, u.username as actor_username
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.school_id = $1
        ORDER BY al.created_at DESC
        LIMIT 10;
      `, [schoolId]),
    ]);

    const school = schoolRes.rows[0] || null;
    const students = studentsRes.rows[0];
    const teachers = teachersRes.rows[0];
    const proctors = proctorsRes.rows[0];
    const classes = classesRes.rows[0];
    const subjects = subjectsRes.rows[0];
    const exams = examsRes.rows[0];
    const questions = questionsRes.rows[0];
    const sessions = sessionsRes.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        schoolInfo: school,
        metrics: {
          totalStudents: parseInt(students?.total || '0', 10),
          activeStudents: parseInt(students?.active || '0', 10),
          totalTeachers: parseInt(teachers?.total || '0', 10),
          totalProctors: parseInt(proctors?.total || '0', 10),
          totalClasses: parseInt(classes?.total || '0', 10),
          totalSubjects: parseInt(subjects?.total || '0', 10),
          totalExams: parseInt(exams?.total_exams || '0', 10),
          activeExams: parseInt(exams?.active_exams || '0', 10),
          upcomingExams: parseInt(exams?.upcoming_exams || '0', 10),
          completedExams: parseInt(exams?.completed_exams || '0', 10),
          totalQuestions: parseInt(questions?.total || '0', 10),
          activeParticipants: parseInt(sessions?.active_sessions || '0', 10),
          problemSessions: parseInt(sessions?.problem_sessions || '0', 10),
        },
        recentActivities: recentAuditRes.rows.map((r: any) => ({
          id: r.id,
          action: r.action,
          role: r.role,
          actorName: r.actor_name || r.actor_username || 'Sistem',
          resourceType: r.resource_type,
          resourceId: r.resource_id,
          severity: r.severity || 'INFO',
          createdAt: r.created_at,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat metrik dashboard sekolah.' },
      { status: 500 }
    );
  }
}
