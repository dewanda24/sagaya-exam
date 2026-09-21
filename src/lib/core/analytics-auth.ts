import { UserRole } from './types';
import { SessionUser } from './auth';
import { TenantContext } from './tenant';
import { hasUserPermission, Permission } from './permissions';
import { queryPostgres } from './postgres';

export interface AnalyticsContext {
  userId: string;
  role: UserRole;
  schoolId: string | null;
  permissions: string[];
  studentId?: string | null;
}

export class AnalyticsAuthService {
  /**
   * Mengonstruksi AnalyticsContext dari sesi pengguna aktif
   */
  static fromSession(
    user: SessionUser,
    tenant?: TenantContext,
    studentId?: string | null
  ): AnalyticsContext {
    return {
      userId: user.id,
      role: user.role,
      schoolId: tenant?.schoolId || user.schoolId || null,
      permissions: ((user as any).permissions as string[]) || [],
      studentId: studentId || null,
    };
  }

  /**
   * Memastikan pengguna memiliki hak akses ke sekolah target (Tenant Isolation)
   */
  static assertSchoolScope(context: AnalyticsContext, targetSchoolId: string): void {
    if (context.role === 'SUPER_ADMIN') return;

    if (!context.schoolId || context.schoolId !== targetSchoolId) {
      throw new Error('Akses ditolak: Anda tidak memiliki izin untuk melihat data sekolah lain.');
    }
  }

  /**
   * Verifikasi akses terhadap ujian tertentu sesuai role dan assignment
   */
  static async assertExamAccess(context: AnalyticsContext, examId: string): Promise<{ schoolId: string }> {
    const examRes = await queryPostgres(
      `SELECT id, school_id, subject_id, created_by, status FROM exams WHERE id = $1 LIMIT 1;`,
      [examId]
    );

    if (examRes.rows.length === 0) {
      throw new Error('Ujian tidak ditemukan.');
    }

    const exam = examRes.rows[0];
    this.assertSchoolScope(context, exam.school_id);

    // SUPER_ADMIN dan ADMIN memiliki akses penuh dalam sekolahnya
    if (context.role === 'SUPER_ADMIN' || context.role === 'ADMIN') {
      return { schoolId: exam.school_id };
    }

    // GURU: harus pemilik ujian atau guru mapel yang bersangkutan
    if (context.role === 'GURU') {
      if (exam.created_by === context.userId) {
        return { schoolId: exam.school_id };
      }

      const assignedSubjectRes = await queryPostgres(
        `SELECT 1 FROM teacher_subjects WHERE school_id = $1 AND teacher_id = $2 AND subject_id = $3 LIMIT 1;`,
        [exam.school_id, context.userId, exam.subject_id]
      );

      if (assignedSubjectRes.rows.length > 0) {
        return { schoolId: exam.school_id };
      }

      throw new Error('Akses ditolak: Anda tidak ditugaskan pada mata pelajaran atau ujian ini.');
    }

    // PENGAWAS: harus ditugaskan mengawasi setidaknya satu ruang pada ujian ini
    if (context.role === 'PENGAWAS') {
      const proctorAssigned = await queryPostgres(
        `SELECT 1 FROM exam_room_proctors WHERE exam_id = $1 AND proctor_id = $2 LIMIT 1;`,
        [examId, context.userId]
      );

      if (proctorAssigned.rows.length > 0) {
        return { schoolId: exam.school_id };
      }

      throw new Error('Akses ditolak: Anda tidak ditugaskan sebagai pengawas pada ujian ini.');
    }

    // SISWA: Ujian harus sudah diikuti dan berstatus PUBLISHED
    if (context.studentId) {
      const studentParticipant = await queryPostgres(
        `SELECT ep.id, er.status as result_status 
         FROM exam_participants ep
         LEFT JOIN exam_sessions es ON ep.id = es.participant_id
         LEFT JOIN exam_results er ON es.id = er.session_id
         WHERE ep.exam_id = $1 AND ep.student_id = $2 AND ep.school_id = $3
         LIMIT 1;`,
        [examId, context.studentId, exam.school_id]
      );

      if (studentParticipant.rows.length === 0) {
        throw new Error('Akses ditolak: Anda tidak terdaftar pada ujian ini.');
      }

      if (studentParticipant.rows[0].result_status !== 'PUBLISHED') {
        throw new Error('Hasil ujian belum dipublikasikan oleh pihak sekolah.');
      }

      return { schoolId: exam.school_id };
    }

    throw new Error('Akses ditolak: Peran tidak diizinkan mengakses data ujian.');
  }

  /**
   * Verifikasi akses terhadap analitik siswa (Siswa hanya boleh melihat dirinya sendiri)
   */
  static async assertStudentAccess(context: AnalyticsContext, targetStudentId: string): Promise<{ schoolId: string }> {
    const studentRes = await queryPostgres(
      `SELECT s.id, s.school_id, s.class_room_id 
       FROM students s 
       WHERE s.id = $1 LIMIT 1;`,
      [targetStudentId]
    );

    if (studentRes.rows.length === 0) {
      throw new Error('Data siswa tidak ditemukan.');
    }

    const student = studentRes.rows[0];
    this.assertSchoolScope(context, student.school_id);

    if (context.role === 'SUPER_ADMIN' || context.role === 'ADMIN') {
      return { schoolId: student.school_id };
    }

    // Siswa hanya boleh membaca miliknya sendiri
    if (context.studentId) {
      if (context.studentId !== targetStudentId) {
        throw new Error('Akses ditolak: Anda hanya dapat melihat analitik hasil belajar milik Anda sendiri.');
      }
      return { schoolId: student.school_id };
    }

    // Guru: siswa harus berada di kelas yang diajarnya
    if (context.role === 'GURU') {
      const classCheck = await queryPostgres(
        `SELECT 1 FROM teacher_classes WHERE school_id = $1 AND teacher_id = $2 AND class_room_id = $3 LIMIT 1;`,
        [student.school_id, context.userId, student.class_room_id]
      );

      if (classCheck.rows.length > 0) {
        return { schoolId: student.school_id };
      }

      throw new Error('Akses ditolak: Siswa ini berada di luar kelas kewenangan Anda.');
    }

    throw new Error('Akses ditolak untuk melihat data siswa ini.');
  }

  /**
   * Verifikasi akses terhadap analitik kelas
   */
  static async assertClassAccess(context: AnalyticsContext, classId: string): Promise<{ schoolId: string }> {
    const classRes = await queryPostgres(
      `SELECT id, school_id FROM class_rooms WHERE id = $1 LIMIT 1;`,
      [classId]
    );

    if (classRes.rows.length === 0) {
      throw new Error('Kelas tidak ditemukan.');
    }

    const cls = classRes.rows[0];
    this.assertSchoolScope(context, cls.school_id);

    if (context.role === 'SUPER_ADMIN' || context.role === 'ADMIN') {
      return { schoolId: cls.school_id };
    }

    if (context.role === 'GURU') {
      const assigned = await queryPostgres(
        `SELECT 1 FROM teacher_classes WHERE school_id = $1 AND teacher_id = $2 AND class_room_id = $3 LIMIT 1;`,
        [cls.school_id, context.userId, classId]
      );

      if (assigned.rows.length > 0) {
        return { schoolId: cls.school_id };
      }

      throw new Error('Akses ditolak: Anda tidak ditugaskan mengajar pada kelas ini.');
    }

    throw new Error('Akses ditolak untuk melihat analitik kelas ini.');
  }

  /**
   * Verifikasi akses terhadap analitik mata pelajaran
   */
  static async assertSubjectAccess(context: AnalyticsContext, subjectId: string): Promise<{ schoolId: string }> {
    const subjectRes = await queryPostgres(
      `SELECT id, school_id FROM subjects WHERE id = $1 LIMIT 1;`,
      [subjectId]
    );

    if (subjectRes.rows.length === 0) {
      throw new Error('Mata pelajaran tidak ditemukan.');
    }

    const sub = subjectRes.rows[0];
    this.assertSchoolScope(context, sub.school_id);

    if (context.role === 'SUPER_ADMIN' || context.role === 'ADMIN') {
      return { schoolId: sub.school_id };
    }

    if (context.role === 'GURU') {
      const assigned = await queryPostgres(
        `SELECT 1 FROM teacher_subjects WHERE school_id = $1 AND teacher_id = $2 AND subject_id = $3 LIMIT 1;`,
        [sub.school_id, context.userId, subjectId]
      );

      if (assigned.rows.length > 0) {
        return { schoolId: sub.school_id };
      }

      throw new Error('Akses ditolak: Anda tidak mengampu mata pelajaran ini.');
    }

    throw new Error('Akses ditolak untuk melihat analitik mata pelajaran ini.');
  }
}
