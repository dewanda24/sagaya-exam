import { queryPostgres } from '../core/postgres';
import { SessionUser } from '../core/auth';
import { hasUserPermission } from '../core/permissions';

export class TeacherAuthorizationService {
  /**
   * Memverifikasi apakah Guru ditugaskan pada mata pelajaran tertentu di sekolahnya.
   */
  static async isAssignedToSubject(
    userId: string,
    schoolId: string,
    subjectId: string
  ): Promise<boolean> {
    const res = await queryPostgres(
      `SELECT 1 FROM teacher_subjects 
       WHERE school_id = $1 AND teacher_id = $2 AND subject_id = $3 
       LIMIT 1;`,
      [schoolId, userId, subjectId]
    );
    return res.rows.length > 0;
  }

  /**
   * Memverifikasi apakah Guru ditugaskan pada kelas tertentu di sekolahnya.
   */
  static async isAssignedToClass(
    userId: string,
    schoolId: string,
    classId: string
  ): Promise<boolean> {
    const res = await queryPostgres(
      `SELECT 1 FROM teacher_classes 
       WHERE school_id = $1 AND teacher_id = $2 AND class_room_id = $3 
       LIMIT 1;`,
      [schoolId, userId, classId]
    );
    return res.rows.length > 0;
  }

  /**
   * Memverifikasi apakah Guru berhak membaca soal.
   */
  static async canReadQuestion(
    user: SessionUser,
    question: { schoolId?: string; school_id?: string; teacherId?: string; teacher_id?: string; subjectId?: string; subject_id?: string; isShared?: boolean; is_shared?: boolean; lifecycleStatus?: string; lifecycle_status?: string },
    schoolId: string
  ): Promise<boolean> {
    if (user.role === 'SUPER_ADMIN') return true;

    const qSchoolId = question.schoolId || question.school_id;
    if (qSchoolId !== schoolId || user.schoolId !== schoolId) return false;

    if (user.role === 'ADMIN') return true;

    if (!hasUserPermission(user, 'question.read')) return false;

    const authorId = question.teacherId || question.teacher_id;
    if (authorId === user.id) return true;

    const isShared = question.isShared || question.is_shared;
    const status = question.lifecycleStatus || question.lifecycle_status;

    // Soal yang di-share atau approved di sekolah yang sama dapat dibaca oleh guru mapel yang sama
    const subjectId = question.subjectId || question.subject_id;
    if (subjectId) {
      const assigned = await this.isAssignedToSubject(user.id, schoolId, subjectId);
      if (assigned && (isShared || ['APPROVED', 'PUBLISHED', 'LOCKED'].includes(status || ''))) {
        return true;
      }
    }

    // Jika guru punya hak review, dapat membaca soal SUBMITTED/REVIEW
    if (hasUserPermission(user, 'question.review') && ['SUBMITTED', 'REVIEW'].includes(status || '')) {
      return true;
    }

    return false;
  }

  /**
   * Memverifikasi apakah Guru berhak mengedit soal.
   * Soal berstatus LOCKED tidak boleh diedit secara langsung (harus buat revisi baru).
   */
  static async canEditQuestion(
    user: SessionUser,
    question: { schoolId?: string; school_id?: string; teacherId?: string; teacher_id?: string; lifecycleStatus?: string; lifecycle_status?: string },
    schoolId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (user.role === 'SUPER_ADMIN') return { allowed: true };

    const qSchoolId = question.schoolId || question.school_id;
    if (qSchoolId !== schoolId || user.schoolId !== schoolId) {
      return { allowed: false, reason: 'Soal tidak berada pada sekolah Anda.' };
    }

    const status = question.lifecycleStatus || question.lifecycle_status || 'DRAFT';
    if (status === 'LOCKED') {
      return { allowed: false, reason: 'Soal berstatus LOCKED dan tidak dapat diubah secara langsung.' };
    }

    if (user.role === 'ADMIN') return { allowed: true };

    if (!hasUserPermission(user, 'question.update')) {
      return { allowed: false, reason: 'Anda tidak memiliki izin mengedit soal.' };
    }

    const authorId = question.teacherId || question.teacher_id;
    if (authorId !== user.id) {
      return { allowed: false, reason: 'Anda hanya dapat mengedit soal buatan Anda sendiri.' };
    }

    if (status !== 'DRAFT') {
      return { allowed: false, reason: `Soal berstatus ${status}. Hanya soal berstatus DRAFT yang dapat diedit langsung.` };
    }

    return { allowed: true };
  }

  /**
   * Memverifikasi apakah Guru berhak menghapus soal DRAFT.
   */
  static async canDeleteQuestion(
    user: SessionUser,
    question: { schoolId?: string; school_id?: string; teacherId?: string; teacher_id?: string; lifecycleStatus?: string; lifecycle_status?: string },
    schoolId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (user.role === 'SUPER_ADMIN') return { allowed: true };

    const qSchoolId = question.schoolId || question.school_id;
    if (qSchoolId !== schoolId || user.schoolId !== schoolId) {
      return { allowed: false, reason: 'Akses ditolak: Sekolah tidak cocok.' };
    }

    if (user.role === 'ADMIN') return { allowed: true };

    if (!hasUserPermission(user, 'question.delete_draft')) {
      return { allowed: false, reason: 'Anda tidak memiliki izin menghapus draft soal.' };
    }

    const authorId = question.teacherId || question.teacher_id;
    if (authorId !== user.id) {
      return { allowed: false, reason: 'Anda hanya dapat menghapus soal buatan Anda sendiri.' };
    }

    const status = question.lifecycleStatus || question.lifecycle_status || 'DRAFT';
    if (status !== 'DRAFT') {
      return { allowed: false, reason: 'Hanya soal berstatus DRAFT yang dapat dihapus.' };
    }

    return { allowed: true };
  }

  /**
   * Memverifikasi apakah Guru berhak mengajukan soal untuk review (DRAFT -> SUBMITTED).
   */
  static canSubmitQuestion(
    user: SessionUser,
    question: { teacherId?: string; teacher_id?: string; lifecycleStatus?: string; lifecycle_status?: string }
  ): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    if (!hasUserPermission(user, 'question.submit')) return false;

    const authorId = question.teacherId || question.teacher_id;
    const status = question.lifecycleStatus || question.lifecycle_status || 'DRAFT';

    return authorId === user.id && status === 'DRAFT';
  }

  /**
   * Memverifikasi apakah Guru berhak mereview dan menyetujui soal.
   */
  static canReviewQuestion(user: SessionUser): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    return hasUserPermission(user, 'question.review');
  }

  static canApproveQuestion(user: SessionUser): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    return hasUserPermission(user, 'question.approve');
  }

  /**
   * Memverifikasi apakah Guru berhak membaca kelas tertentu.
   */
  static async canReadClass(
    user: SessionUser,
    classId: string,
    schoolId: string
  ): Promise<boolean> {
    if (user.role === 'SUPER_ADMIN') return true;
    if (user.schoolId !== schoolId) return false;
    if (user.role === 'ADMIN') return true;

    if (!hasUserPermission(user, 'teacher.classes.read')) return false;

    return await this.isAssignedToClass(user.id, schoolId, classId);
  }

  /**
   * Memverifikasi apakah Guru berhak membaca data siswa (siswa harus berada di kelas yang diampu guru).
   */
  static async canReadStudent(
    user: SessionUser,
    studentId: string,
    schoolId: string
  ): Promise<boolean> {
    if (user.role === 'SUPER_ADMIN') return true;
    if (user.schoolId !== schoolId) return false;
    if (user.role === 'ADMIN') return true;

    if (!hasUserPermission(user, 'teacher.students.read')) return false;

    const res = await queryPostgres(
      `SELECT s.class_room_id 
       FROM students s
       JOIN teacher_classes tc ON s.class_room_id = tc.class_room_id
       WHERE s.id = $1 AND s.school_id = $2 AND tc.teacher_id = $3
       LIMIT 1;`,
      [studentId, schoolId, user.id]
    );
    return res.rows.length > 0;
  }

  /**
   * Memverifikasi apakah Guru berhak membuat ujian untuk subject dan target classes tertentu.
   */
  static async canCreateExam(
    user: SessionUser,
    subjectId: string,
    targetClassIds: string[],
    schoolId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (user.role === 'SUPER_ADMIN') return { allowed: true };
    if (user.schoolId !== schoolId) {
      return { allowed: false, reason: 'Akses ditolak: Tenant sekolah berbeda.' };
    }

    if (user.role === 'ADMIN') return { allowed: true };

    if (!hasUserPermission(user, 'exam.create')) {
      return { allowed: false, reason: 'Anda tidak memiliki izin membuat ujian.' };
    }

    // Periksa mata pelajaran yang diampu
    const subjectAssigned = await this.isAssignedToSubject(user.id, schoolId, subjectId);
    if (!subjectAssigned) {
      return {
        allowed: false,
        reason: 'Anda tidak ditugaskan untuk mengampu mata pelajaran ini.',
      };
    }

    // Periksa seluruh target kelas
    if (targetClassIds && targetClassIds.length > 0) {
      for (const classId of targetClassIds) {
        const classAssigned = await this.isAssignedToClass(user.id, schoolId, classId);
        if (!classAssigned) {
          return {
            allowed: false,
            reason: `Anda tidak ditugaskan untuk mengajar pada salah satu kelas yang dipilih (ID: ${classId}).`,
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Memverifikasi apakah Guru berhak mengedit ujian.
   */
  static async canEditExam(
    user: SessionUser,
    exam: { schoolId?: string; school_id?: string; createdBy?: string; created_by?: string; status?: string },
    schoolId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (user.role === 'SUPER_ADMIN') return { allowed: true };

    const exSchoolId = exam.schoolId || exam.school_id;
    if (exSchoolId !== schoolId || user.schoolId !== schoolId) {
      return { allowed: false, reason: 'Ujian tidak berada pada sekolah Anda.' };
    }

    if (user.role === 'ADMIN') return { allowed: true };

    if (!hasUserPermission(user, 'exam.update')) {
      return { allowed: false, reason: 'Anda tidak memiliki izin memperbarui ujian.' };
    }

    const creatorId = exam.createdBy || exam.created_by;
    if (creatorId !== user.id) {
      return { allowed: false, reason: 'Anda hanya dapat mengedit ujian yang Anda buat.' };
    }

    const status = exam.status || 'DRAFT';
    if (status !== 'DRAFT') {
      return { allowed: false, reason: `Ujian berstatus ${status}. Hanya ujian berstatus DRAFT yang dapat diedit.` };
    }

    return { allowed: true };
  }

  /**
   * Memverifikasi apakah Guru berhak mempublikasikan ujian (membekukan snapshot).
   */
  static canPublishExam(user: SessionUser): boolean {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    return hasUserPermission(user, 'exam.publish');
  }

  /**
   * Memverifikasi apakah Guru berhak melihat hasil ujian.
   */
  static async canReadResult(
    user: SessionUser,
    examId: string,
    schoolId: string
  ): Promise<boolean> {
    if (user.role === 'SUPER_ADMIN') return true;
    if (user.schoolId !== schoolId) return false;
    if (user.role === 'ADMIN') return true;

    if (!hasUserPermission(user, 'result.read')) return false;

    // Guru pembuat ujian atau guru yang mengajar mata pelajaran ujian tersebut
    const res = await queryPostgres(
      `SELECT e.id FROM exams e
       LEFT JOIN teacher_subjects ts ON e.subject_id = ts.subject_id AND ts.teacher_id = $1
       WHERE e.id = $2 AND e.school_id = $3 AND (e.created_by = $1 OR ts.id IS NOT NULL)
       LIMIT 1;`,
      [user.id, examId, schoolId]
    );

    return res.rows.length > 0;
  }

  /**
   * Memverifikasi apakah Guru berhak menilai essay siswa.
   */
  static async canGradeEssay(
    user: SessionUser,
    answerId: string,
    schoolId: string
  ): Promise<boolean> {
    if (user.role === 'SUPER_ADMIN') return true;
    if (user.schoolId !== schoolId) return false;
    if (user.role === 'ADMIN') return true;

    if (!hasUserPermission(user, 'grading.update')) return false;

    const res = await queryPostgres(
      `SELECT sa.id 
       FROM student_answers sa
       JOIN exam_sessions es ON sa.session_id = es.id
       JOIN exam_participants ep ON es.participant_id = ep.id
       JOIN exams e ON ep.exam_id = e.id
       LEFT JOIN teacher_subjects ts ON e.subject_id = ts.subject_id AND ts.teacher_id = $1
       WHERE sa.id = $2 AND e.school_id = $3 AND (e.created_by = $1 OR ts.id IS NOT NULL)
       LIMIT 1;`,
      [user.id, answerId, schoolId]
    );

    return res.rows.length > 0;
  }
}
