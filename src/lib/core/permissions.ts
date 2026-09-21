import { UserRole } from './types';

export type SuperAdminPermission =
  | 'school.read'
  | 'school.create'
  | 'school.update'
  | 'school.suspend'
  | 'school.archive'
  | 'user.read'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.disable'
  | 'user.reset_password'
  | 'user.revoke_session'
  | 'question.global.read'
  | 'question.global.review'
  | 'question.global.approve'
  | 'question.global.publish'
  | 'question.global.lock'
  | 'regional_exam.read'
  | 'regional_exam.create'
  | 'regional_exam.update'
  | 'regional_exam.publish'
  | 'regional_exam.lock'
  | 'regional_exam.archive'
  | 'security.read'
  | 'security.manage'
  | 'audit.read'
  | 'audit.export'
  | 'system.read'
  | 'system.configure'
  | 'emergency.manage'
  | 'analytics.platform'
  | 'analytics.read'
  | 'analytics.export'
  | 'reports.snapshot.create'
  | 'reports.snapshot.read';

export type SchoolAdminPermission =
  | 'school.read'
  | 'school.update'
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.disable'
  | 'users.reset_password'
  | 'users.revoke_session'
  | 'students.read'
  | 'students.create'
  | 'students.update'
  | 'students.delete'
  | 'students.import'
  | 'teachers.read'
  | 'teachers.create'
  | 'teachers.update'
  | 'teachers.delete'
  | 'teachers.import'
  | 'proctors.read'
  | 'proctors.create'
  | 'proctors.update'
  | 'proctors.delete'
  | 'classes.read'
  | 'classes.create'
  | 'classes.update'
  | 'classes.delete'
  | 'subjects.read'
  | 'subjects.create'
  | 'subjects.update'
  | 'subjects.delete'
  | 'academic_year.read'
  | 'academic_year.create'
  | 'academic_year.update'
  | 'academic_year.delete'
  | 'questions.read'
  | 'questions.moderate'
  | 'questions.approve'
  | 'questions.create'
  | 'questions.update'
  | 'questions.delete'
  | 'exams.read'
  | 'exams.create'
  | 'exams.update'
  | 'exams.publish'
  | 'exams.lock'
  | 'exams.archive'
  | 'participants.read'
  | 'participants.assign'
  | 'participants.remove'
  | 'rooms.read'
  | 'rooms.create'
  | 'rooms.update'
  | 'rooms.delete'
  | 'monitoring.read'
  | 'monitoring.control'
  | 'results.read'
  | 'results.export'
  | 'results.score'
  | 'results.review'
  | 'results.publish'
  | 'results.correct'
  | 'results.void'
  | 'results.regrade'
  | 'result.review'
  | 'result.publish'
  | 'result.correct'
  | 'result.void'
  | 'result.regrade'
  | 'reports.read'
  | 'reports.export'
  | 'audit.read'
  | 'settings.read'
  | 'settings.update'
  | 'analytics.read'
  | 'analytics.export'
  | 'reports.snapshot.create'
  | 'reports.snapshot.read'
  // Backward compatibility alias keys
  | 'school.own.read'
  | 'school.own.update'
  | 'student.read'
  | 'student.create'
  | 'student.update'
  | 'student.delete'
  | 'teacher.manage'
  | 'exam.manage'
  | 'exam.monitor'
  | 'question.manage';

export type TeacherPermission =
  | 'teacher.profile.read'
  | 'teacher.profile.update'
  | 'teacher.classes.read'
  | 'teacher.students.read'
  | 'question.create'
  | 'question.read'
  | 'question.update'
  | 'question.delete_draft'
  | 'question.submit'
  | 'question.duplicate'
  | 'question.import'
  | 'question.export'
  | 'question.review'
  | 'question.approve'
  | 'exam.create'
  | 'exam.read'
  | 'exam.update'
  | 'exam.publish'
  | 'exam.lock'
  | 'exam.participants.read'
  | 'exam.monitoring.read'
  | 'result.read'
  | 'result.export'
  | 'grading.read'
  | 'grading.update'
  | 'feedback.create'
  | 'analytics.read'
  | 'analytics.export';

export type ProctorPermission =
  | 'proctor.dashboard.read'
  | 'proctor.schedule.read'
  | 'proctor.exam.read'
  | 'proctor.exam.monitor'
  | 'proctor.room.read'
  | 'proctor.participants.read'
  | 'proctor.attendance.read'
  | 'proctor.attendance.update'
  | 'proctor.violation.read'
  | 'proctor.incident.create'
  | 'proctor.incident.update'
  | 'proctor.note.create'
  | 'proctor.session.read'
  | 'proctor.session.revoke'
  | 'proctor.emergency.request'
  | 'analytics.operational.read';

export type Permission = SuperAdminPermission | SchoolAdminPermission | TeacherPermission | ProctorPermission;

const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  'school.read',
  'school.create',
  'school.update',
  'school.suspend',
  'school.archive',
  'user.read',
  'user.create',
  'user.update',
  'user.delete',
  'user.disable',
  'user.reset_password',
  'user.revoke_session',
  'question.global.read',
  'question.global.review',
  'question.global.approve',
  'question.global.publish',
  'question.global.lock',
  'regional_exam.read',
  'regional_exam.create',
  'regional_exam.update',
  'regional_exam.publish',
  'regional_exam.lock',
  'regional_exam.archive',
  'security.read',
  'security.manage',
  'audit.read',
  'audit.export',
  'system.read',
  'system.configure',
  'emergency.manage',
  'analytics.platform',
  'analytics.read',
  'analytics.export',
  'reports.snapshot.create',
  'reports.snapshot.read',
  // Includes all teacher permissions
  'teacher.profile.read',
  'teacher.profile.update',
  'teacher.classes.read',
  'teacher.students.read',
  'question.create',
  'question.read',
  'question.update',
  'question.delete_draft',
  'question.submit',
  'question.duplicate',
  'question.import',
  'question.export',
  'question.review',
  'question.approve',
  'exam.create',
  'exam.read',
  'exam.update',
  'exam.publish',
  'exam.lock',
  'exam.participants.read',
  'exam.monitoring.read',
  'result.read',
  'result.export',
  'grading.read',
  'grading.update',
  'feedback.create',
  // Includes all proctor permissions
  'proctor.dashboard.read',
  'proctor.schedule.read',
  'proctor.exam.read',
  'proctor.exam.monitor',
  'proctor.room.read',
  'proctor.participants.read',
  'proctor.attendance.read',
  'proctor.attendance.update',
  'proctor.violation.read',
  'proctor.incident.create',
  'proctor.incident.update',
  'proctor.note.create',
  'proctor.session.read',
  'proctor.session.revoke',
  'proctor.emergency.request',
];

const ADMIN_PERMISSIONS: Permission[] = [
  'school.read',
  'school.update',
  'users.read',
  'users.create',
  'users.update',
  'users.disable',
  'users.reset_password',
  'users.revoke_session',
  'students.read',
  'students.create',
  'students.update',
  'students.delete',
  'students.import',
  'teachers.read',
  'teachers.create',
  'teachers.update',
  'teachers.delete',
  'teachers.import',
  'proctors.read',
  'proctors.create',
  'proctors.update',
  'proctors.delete',
  'classes.read',
  'classes.create',
  'classes.update',
  'classes.delete',
  'subjects.read',
  'subjects.create',
  'subjects.update',
  'subjects.delete',
  'academic_year.read',
  'academic_year.create',
  'academic_year.update',
  'academic_year.delete',
  'questions.read',
  'questions.moderate',
  'questions.approve',
  'questions.create',
  'questions.update',
  'questions.delete',
  'exams.read',
  'exams.create',
  'exams.update',
  'exams.publish',
  'exams.lock',
  'exams.archive',
  'participants.read',
  'participants.assign',
  'participants.remove',
  'rooms.read',
  'rooms.create',
  'rooms.update',
  'rooms.delete',
  'monitoring.read',
  'monitoring.control',
  'results.read',
  'results.export',
  'results.score',
  'results.review',
  'results.publish',
  'results.correct',
  'results.void',
  'results.regrade',
  'result.review',
  'result.publish',
  'result.correct',
  'result.void',
  'result.regrade',
  'reports.read',
  'reports.export',
  'audit.read',
  'settings.read',
  'settings.update',
  'analytics.read',
  'analytics.export',
  'reports.snapshot.create',
  'reports.snapshot.read',
  // Backward compatibility alias keys
  'school.own.read',
  'school.own.update',
  'student.read',
  'student.create',
  'student.update',
  'student.delete',
  'teacher.manage',
  'exam.manage',
  'exam.monitor',
  'question.manage',
  // Teacher permissions available to school admin
  'teacher.profile.read',
  'teacher.profile.update',
  'teacher.classes.read',
  'teacher.students.read',
  'question.create',
  'question.read',
  'question.update',
  'question.delete_draft',
  'question.submit',
  'question.duplicate',
  'question.import',
  'question.export',
  'question.review',
  'question.approve',
  'exam.create',
  'exam.read',
  'exam.update',
  'exam.publish',
  'exam.lock',
  'exam.participants.read',
  'exam.monitoring.read',
  'result.read',
  'result.export',
  'grading.read',
  'grading.update',
  'feedback.create',
  // Proctor permissions available to admin
  'proctor.dashboard.read',
  'proctor.schedule.read',
  'proctor.exam.read',
  'proctor.exam.monitor',
  'proctor.room.read',
  'proctor.participants.read',
  'proctor.attendance.read',
  'proctor.attendance.update',
  'proctor.violation.read',
  'proctor.incident.create',
  'proctor.incident.update',
  'proctor.note.create',
  'proctor.session.read',
  'proctor.session.revoke',
  'proctor.emergency.request',
];

const GURU_PERMISSIONS: Permission[] = [
  'questions.read',
  'questions.create',
  'questions.update',
  'question.manage',
  'results.read',
  'results.score',
  'classes.read',
  'subjects.read',
  // Granular teacher permissions default:
  'teacher.profile.read',
  'teacher.profile.update',
  'teacher.classes.read',
  'teacher.students.read',
  'question.create',
  'question.read',
  'question.update',
  'question.delete_draft',
  'question.submit',
  'question.duplicate',
  'question.import',
  'question.export',
  'exam.create',
  'exam.read',
  'exam.update',
  'exam.participants.read',
  'exam.monitoring.read',
  'result.read',
  'result.export',
  'grading.read',
  'grading.update',
  'feedback.create',
  'analytics.read',
  'analytics.export',
  // Note: 'question.review', 'question.approve', 'exam.publish', 'exam.lock' are NOT given by default
  // They can be explicitly assigned per user or assigned to reviewer teachers
];

const PENGAWAS_PERMISSIONS: Permission[] = [
  'monitoring.read',
  'monitoring.control',
  'exam.monitor',
  'rooms.read',
  'participants.read',
  // Granular proctor permissions default:
  'proctor.dashboard.read',
  'proctor.schedule.read',
  'proctor.exam.read',
  'proctor.exam.monitor',
  'proctor.room.read',
  'proctor.participants.read',
  'proctor.attendance.read',
  'proctor.attendance.update',
  'proctor.violation.read',
  'proctor.incident.create',
  'proctor.incident.update',
  'proctor.note.create',
  'proctor.session.read',
  'proctor.session.revoke',
  'analytics.operational.read',
  // Note: 'proctor.emergency.request' is reserved for authorized proctors / admins
];

export const ROLE_PERMISSION_MAP: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: SUPER_ADMIN_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  GURU: GURU_PERMISSIONS,
  PENGAWAS: PENGAWAS_PERMISSIONS,
};

/**
 * Validasi apakah role tertentu memiliki permission yang diminta.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  if (role === 'SUPER_ADMIN') return true;
  const permissions = ROLE_PERMISSION_MAP[role] || [];
  return permissions.includes(permission);
}

/**
 * Validasi permission spesifik pengguna dengan dukungan granular override per user.
 */
export function hasUserPermission(
  user: { role: UserRole; permissions?: string[] | null },
  permission: Permission
): boolean {
  if (user.role === 'SUPER_ADMIN') return true;

  // Jika user memiliki custom permissions list, prioritaskan per-user permissions
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.includes(permission);
  }

  // Fallback ke default role permissions
  return hasPermission(user.role, permission);
}

