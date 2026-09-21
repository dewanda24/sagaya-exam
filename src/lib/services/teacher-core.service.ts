import { queryPostgres } from '../core/postgres';
import { AuditService } from './audit.service';
import { TeacherAuthorizationService } from './teacher-authorization.service';

export interface UpdateProfileInput {
  phone?: string;
  email?: string;
}

export class TeacherCoreService {
  /**
   * Mengambil data profil guru beserta ringkasan penugasan kelas dan mata pelajaran.
   */
  static async getProfile(schoolId: string, teacherId: string) {
    const userRes = await queryPostgres(
      `SELECT u.id, u.username, u.full_name, u.nip, u.nuptk, u.phone, u.email, u.role,
              u.status, u.is_active, u.created_at, u.last_login_at,
              s.name as school_name, s.code as school_code, s.level as school_level
       FROM users u
       JOIN schools s ON u.school_id = s.id
       WHERE u.id = $1 AND u.school_id = $2
       LIMIT 1;`,
      [teacherId, schoolId]
    );

    if (userRes.rows.length === 0) {
      throw new Error('Data profil Guru tidak ditemukan.');
    }

    const u = userRes.rows[0];

    // Ambil penugasan mata pelajaran
    const subjects = await this.getAssignedSubjects(schoolId, teacherId);

    // Ambil penugasan kelas
    const classes = await this.getAssignedClasses(schoolId, teacherId);

    return {
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      nip: u.nip || '-',
      nuptk: u.nuptk || '-',
      phone: u.phone || '',
      email: u.email || '',
      role: u.role,
      status: u.status || 'ACTIVE',
      isActive: u.is_active,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
      school: {
        id: schoolId,
        name: u.school_name,
        code: u.school_code,
        level: u.school_level,
      },
      assignedSubjects: subjects,
      assignedClasses: classes,
    };
  }

  /**
   * Guru hanya diizinkan memperbarui field kontak pribadi (phone, email).
   * Guru TIDAK boleh mengubah role, school_id, permission, account status, atau ownership assignment.
   */
  static async updateProfile(
    schoolId: string,
    teacherId: string,
    data: UpdateProfileInput,
    actor: { id: string; username: string; role: string }
  ) {
    // Validasi bahwa actor adalah guru itu sendiri atau admin sekolah
    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN' && actor.id !== teacherId) {
      throw new Error('Akses ditolak: Anda hanya dapat memperbarui profil Anda sendiri.');
    }

    const cleanPhone = data.phone ? data.phone.trim() : null;
    const cleanEmail = data.email ? data.email.trim().toLowerCase() : null;

    const res = await queryPostgres(
      `UPDATE users 
       SET phone = COALESCE($1, phone),
           email = COALESCE($2, email)
       WHERE id = $3 AND school_id = $4
       RETURNING id, username, full_name, phone, email;`,
      [cleanPhone, cleanEmail, teacherId, schoolId]
    );

    if (res.rows.length === 0) {
      throw new Error('Pengguna tidak ditemukan.');
    }

    await AuditService.createLog({
      action: 'TEACHER_PROFILE_UPDATED',
      schoolId,
      actor: { id: actor.id, username: actor.username, role: actor.role },
      resourceType: 'USER',
      resourceId: teacherId,
      details: { updatedFields: Object.keys(data) },
    });

    return res.rows[0];
  }

  /**
   * Mengambil daftar mata pelajaran yang secara spesifik ditugaskan kepada guru ini.
   */
  static async getAssignedSubjects(schoolId: string, teacherId: string) {
    const res = await queryPostgres(
      `SELECT s.id, s.code, s.name, s.level, s.category,
              (SELECT COUNT(*) FROM question_banks qb WHERE qb.subject_id = s.id AND qb.teacher_id = $2) as my_question_count
       FROM teacher_subjects ts
       JOIN subjects s ON ts.subject_id = s.id
       WHERE ts.school_id = $1 AND ts.teacher_id = $2 AND s.is_active = true
       ORDER BY s.name ASC;`,
      [schoolId, teacherId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      level: r.level,
      category: r.category,
      questionCount: parseInt(r.my_question_count || '0', 10),
    }));
  }

  /**
   * Mengambil daftar kelas yang secara spesifik ditugaskan kepada guru ini.
   */
  static async getAssignedClasses(schoolId: string, teacherId: string) {
    const res = await queryPostgres(
      `SELECT c.id, c.name, c.level, c.academic_year,
              ay.name as academic_year_name,
              s.id as subject_id, s.name as subject_name,
              (SELECT COUNT(*) FROM students st WHERE st.class_room_id = c.id AND st.is_active = true) as student_count
       FROM teacher_classes tc
       JOIN class_rooms c ON tc.class_room_id = c.id
       LEFT JOIN academic_years ay ON c.academic_year_id = ay.id
       LEFT JOIN subjects s ON tc.subject_id = s.id
       WHERE tc.school_id = $1 AND tc.teacher_id = $2 AND c.is_active = true
       ORDER BY c.name ASC;`,
      [schoolId, teacherId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      name: r.name,
      level: r.level,
      academicYear: r.academic_year_name || r.academic_year,
      subjectId: r.subject_id,
      subjectName: r.subject_name || 'Semua Mapel',
      studentCount: parseInt(r.student_count || '0', 10),
    }));
  }

  /**
   * Mengambil daftar siswa dalam kelas yang diampu guru (Strictly Read-Only).
   */
  static async getClassStudents(
    schoolId: string,
    teacherId: string,
    classId: string,
    filters?: { search?: string; limit?: number; offset?: number },
    actorRole?: string
  ) {
    // Verifikasi assignment kelas
    if (actorRole !== 'SUPER_ADMIN' && actorRole !== 'ADMIN') {
      const isAssigned = await TeacherAuthorizationService.isAssignedToClass(
        teacherId,
        schoolId,
        classId
      );
      if (!isAssigned) {
        throw new Error('Akses ditolak: Anda tidak ditugaskan untuk mengajar pada kelas ini.');
      }
    }

    let countSql = `SELECT COUNT(*) as total FROM students WHERE school_id = $1 AND class_room_id = $2 AND is_active = true`;
    let sql = `
      SELECT s.id, s.nis, s.nisn, s.full_name, s.gender, s.status, s.rombel,
             c.name as class_name
      FROM students s
      JOIN class_rooms c ON s.class_room_id = c.id
      WHERE s.school_id = $1 AND s.class_room_id = $2 AND s.is_active = true
    `;
    const params: any[] = [schoolId, classId];

    if (filters?.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (s.full_name ILIKE $${params.length} OR s.nis ILIKE $${params.length} OR s.nisn ILIKE $${params.length})`;
      countSql += ` AND (full_name ILIKE $${params.length} OR nis ILIKE $${params.length} OR nisn ILIKE $${params.length})`;
    }

    sql += ` ORDER BY s.full_name ASC`;

    if (filters?.limit) {
      params.push(filters.limit);
      sql += ` LIMIT $${params.length}`;
    }

    if (filters?.offset) {
      params.push(filters.offset);
      sql += ` OFFSET $${params.length}`;
    }

    const [countRes, dataRes] = await Promise.all([
      queryPostgres(countSql, params.slice(0, filters?.limit ? -2 : params.length)),
      queryPostgres(sql, params),
    ]);

    return {
      students: dataRes.rows.map((r) => ({
        id: r.id,
        nis: r.nis,
        nisn: r.nisn,
        fullName: r.full_name,
        gender: r.gender,
        status: r.status || 'ACTIVE',
        className: r.class_name,
      })),
      total: parseInt(countRes.rows[0]?.total || '0', 10),
    };
  }

  /**
   * Mengambil statistik ringkasan untuk dashboard guru.
   * Dihitung secara server-side berbasis hak akses penugasan guru.
   */
  static async getDashboardStats(schoolId: string, teacherId: string) {
    // 1. Hitung ringkasan soal milik guru
    const qStats = await queryPostgres(
      `SELECT 
        COUNT(*) as total_questions,
        COUNT(*) FILTER (WHERE lifecycle_status = 'DRAFT') as draft_count,
        COUNT(*) FILTER (WHERE lifecycle_status IN ('SUBMITTED', 'REVIEW')) as pending_review_count,
        COUNT(*) FILTER (WHERE lifecycle_status = 'APPROVED') as approved_count,
        COUNT(*) FILTER (WHERE lifecycle_status = 'PUBLISHED') as published_count,
        COUNT(*) FILTER (WHERE lifecycle_status = 'LOCKED') as locked_count
       FROM question_banks 
       WHERE school_id = $1 AND teacher_id = $2;`,
      [schoolId, teacherId]
    );

    // 2. Hitung statistik ujian guru
    const eStats = await queryPostgres(
      `SELECT 
        COUNT(*) as total_exams,
        COUNT(*) FILTER (WHERE status IN ('DRAFT', 'SCHEDULED')) as upcoming_exams,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_exams,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_exams
       FROM exams e
       WHERE e.school_id = $1 AND (e.created_by = $2 OR e.subject_id IN (
         SELECT subject_id FROM teacher_subjects WHERE school_id = $1 AND teacher_id = $2
       ));`,
      [schoolId, teacherId]
    );

    // 3. Hitung jumlah essay yang belum dikoreksi
    const essayStats = await queryPostgres(
      `SELECT COUNT(*) as pending_essays
       FROM student_answers sa
       JOIN exam_sessions es ON sa.session_id = es.id
       JOIN exam_participants ep ON es.participant_id = ep.id
       JOIN exams e ON ep.exam_id = e.id
       JOIN question_banks qb ON sa.question_id = qb.id::text
       WHERE e.school_id = $1 
         AND (e.created_by = $2 OR e.subject_id IN (SELECT subject_id FROM teacher_subjects WHERE school_id = $1 AND teacher_id = $2))
         AND qb.type = 'ESSAY'
         AND sa.manual_score IS NULL
         AND es.status IN ('SUBMITTED', 'COMPLETED');`,
      [schoolId, teacherId]
    );

    // 4. Hitung jumlah total peserta dalam lingkup kelas guru
    const studentCountRes = await queryPostgres(
      `SELECT COUNT(DISTINCT s.id) as total_students
       FROM students s
       JOIN teacher_classes tc ON s.class_room_id = tc.class_room_id
       WHERE tc.school_id = $1 AND tc.teacher_id = $2 AND s.is_active = true;`,
      [schoolId, teacherId]
    );

    // 5. Ambil aktivitas terbaru guru dari audit logs
    const activities = await queryPostgres(
      `SELECT action, details_json, created_at
       FROM audit_logs
       WHERE school_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 8;`,
      [schoolId, teacherId]
    );

    const q = qStats.rows[0];
    const e = eStats.rows[0];

    return {
      questions: {
        total: parseInt(q.total_questions || '0', 10),
        draft: parseInt(q.draft_count || '0', 10),
        pendingReview: parseInt(q.pending_review_count || '0', 10),
        approved: parseInt(q.approved_count || '0', 10),
        published: parseInt(q.published_count || '0', 10),
        locked: parseInt(q.locked_count || '0', 10),
      },
      exams: {
        total: parseInt(e.total_exams || '0', 10),
        upcoming: parseInt(e.upcoming_exams || '0', 10),
        active: parseInt(e.active_exams || '0', 10),
        completed: parseInt(e.completed_exams || '0', 10),
      },
      pendingEssays: parseInt(essayStats.rows[0]?.pending_essays || '0', 10),
      totalAssignedStudents: parseInt(studentCountRes.rows[0]?.total_students || '0', 10),
      recentActivities: activities.rows.map((act) => ({
        action: act.action,
        details: act.details_json,
        createdAt: act.created_at,
      })),
    };
  }
}
