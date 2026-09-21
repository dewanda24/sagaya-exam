export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'GURU' | 'PENGAWAS';

export interface School {
  id: string;
  code: string;
  name: string;
  npsn?: string;
  nss?: string;
  level: 'SD' | 'SMP' | 'SMA' | 'SMK' | 'MADRASAH' | 'UMUM';
  status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  address?: string;
  village?: string;
  district?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  principalName?: string;
  principalNip?: string;
  logoUrl?: string;
  headerTitle1?: string;
  headerTitle2?: string;
  isActive: boolean;
  quotaStudents?: number;
  quotaExams?: number;
  settings?: Record<string, any>;
  createdAt?: string;
  stats?: {
    totalStudents?: number;
    totalClasses?: number;
    totalTeachers?: number;
    totalExams?: number;
  };
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  schoolId?: string | null;
  schoolName?: string;
  nip?: string;
  nuptk?: string;
  phone?: string;
  assignedSubjects?: string[];
  isActive: boolean;
  sessionVersion?: number;
  lastLoginAt?: string;
  createdAt: string;
}

export interface AcademicYear {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  createdAt?: string;
  semesters?: Semester[];
}

export interface Semester {
  id: string;
  academicYearId: string;
  schoolId: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  createdAt?: string;
}

export interface ClassRoom {
  id: string;
  schoolId?: string;
  name: string;
  level: string;
  academicYear?: string;
  academicYearId?: string;
  homeroomTeacherId?: string;
  homeroomTeacherName?: string;
  isActive?: boolean;
  studentCount?: number;
}

export interface Subject {
  id: string;
  schoolId?: string;
  code: string;
  name: string;
  level?: string;
  category?: string;
  isActive?: boolean;
  questionCount?: number;
  assignedTeacherCount?: number;
}

export interface TeacherSubject {
  id: string;
  schoolId: string;
  teacherId: string;
  teacherName?: string;
  subjectId: string;
  subjectName?: string;
  subjectCode?: string;
  createdAt?: string;
}

export interface TeacherClass {
  id: string;
  schoolId: string;
  teacherId: string;
  teacherName?: string;
  classRoomId: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  createdAt?: string;
}

export interface Student {
  id: string;
  schoolId?: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: 'L' | 'P';
  classRoomId: string;
  classRoomName?: string;
  cardAccessCode: string; // PIN / Kode Akses Kartu
  photoUrl?: string;
  birthPlace?: string;
  birthDate?: string;
  entryYear?: string;
  rombel?: string;
  status?: 'ACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'DROPOUT';
  isActive: boolean;
  createdAt?: string;
}

export interface ExamRoom {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  capacity: number;
  location?: string;
  proctorName?: string;
  isActive: boolean;
  createdAt?: string;
  participantCount?: number;
}

export interface ExamRoomProctor {
  id: string;
  examId: string;
  roomId: string;
  roomName?: string;
  sessionNumber: number;
  proctorId: string;
  proctorName?: string;
  notes?: string;
  createdAt?: string;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  questionId: string;
  revisionNumber: number;
  orderIndex: number;
  weight: number;
  question?: QuestionBankItem;
}


export type QuestionType =
  | 'PILIHAN_GANDA'
  | 'PG_KOMPLEKS'
  | 'BENAR_SALAH'
  | 'TRUE_FALSE'
  | 'MENJODOHKAN'
  | 'MATCHING'
  | 'ISIAN_SINGKAT'
  | 'ESSAY';

export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

export interface QuestionOption {
  id: string; // 'A', 'B', 'C', 'D', 'E' or uuid
  text: string;
  imageUrl?: string;
}

export interface MatchingPair {
  id: string;
  premise: string; // Sisi Kiri / Soal
  target: string;  // Sisi Kanan / Jawaban Pasangan
}

export interface QuestionBankItem {
  id: string;
  schoolId?: string;
  subjectId: string;
  subjectName?: string;
  teacherId?: string;
  teacherName?: string;
  topic: string;
  difficulty: DifficultyLevel;
  type: QuestionType;
  questionText: string;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'NONE';
  options?: QuestionOption[];
  answerKey: any; // e.g. 'A' or ['A', 'C'] or boolean or matching map or string
  rubric?: string;
  weight: number;
  tags?: string[];
  isShared?: boolean;
  cognitiveLevel?: 'L1_PENGETAHUAN' | 'L2_PENERAPAN' | 'L3_PENALARAN';
  competenceCode?: string;
  // Shared Stimulus / Wacana Soal Cerita Bersama
  stimulusId?: string;
  stimulusTitle?: string;
  stimulusText?: string;
  stimulusMediaUrl?: string;
}

export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type WindowMode = 'SIMULTANEOUS' | 'FLEXIBLE';
export type ShowScorePolicy = 'IMMEDIATELY' | 'AFTER_ALL_DONE' | 'SCHEDULED' | 'NEVER';

export type ScoringMode = 'TYPE_WEIGHTS' | 'PROPORTIONAL' | 'BANK_DEFAULT';

export interface ScoringRules {
  mode: ScoringMode;
  typeWeights?: {
    PILIHAN_GANDA?: number;
    PG_KOMPLEKS?: number;
    BENAR_SALAH?: number;
    MENJODOHKAN?: number;
    ISIAN_SINGKAT?: number;
    ESSAY?: number;
  };
  proportional?: {
    objectivePercentage: number; // e.g. 70
    essayPercentage: number;     // e.g. 30
  };
  penaltyWrong?: boolean;
  wrongPenaltyPoints?: number; // e.g. -1 for UTBK simulation
}

export interface Exam {
  id: string;
  schoolId?: string;
  schoolName?: string;
  title: string;
  subjectId: string;
  subjectName?: string;
  createdById?: string;
  status: ExamStatus;
  windowMode: WindowMode;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showScorePolicy: ShowScorePolicy;
  ipRestricted: boolean;
  allowedIpRange?: string;
  questionSnapshotJson: QuestionBankItem[];
  scoringRules?: ScoringRules;
  passingGrade?: number;
  releaseToken?: string;
  tokenReleasedAt?: string;
  tokenExpiresAt?: string;
  totalQuestions?: number;
  totalParticipants?: number;
}

export interface ExamParticipant {
  id: string;
  examId: string;
  studentId: string;
  token: string; // Format: XXXX-XXXX (e.g. A7K9-2M4P)
  tokenStatus: 'ACTIVE' | 'REVOKED' | 'USED';
  assignedPackage: 'A' | 'B' | 'C' | 'D';
  finalScore?: number | null;
  gradedStatus: 'PENDING' | 'PARTIAL' | 'GRADED';
  student?: Student;
  exam?: Exam;
}

export type SessionStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'DISCONNECTED'
  | 'EXPIRED'
  | 'LOCKED';

export interface ExamSession {
  id: string;
  participantId: string;
  deviceFingerprint: string;
  ipAddress?: string;
  userAgent?: string;
  serverStartedAt: string;
  serverExpiresAt: string;
  submittedAt?: string | null;
  status: SessionStatus;
  currentQuestionIndex: number;
  lastHeartbeatAt: string;
  tabViolationCount: number;
  participant?: ExamParticipant;
}

export interface StudentAnswer {
  id: string;
  sessionId: string;
  questionId: string;
  answerValue: any; // String, Array, Object
  isDoubtful: boolean;
  autoScore?: number | null;
  manualScore?: number | null;
  feedback?: string;
  updatedAt: string;
}

export interface ExamCardData {
  student: Student;
  exams: {
    examId: string;
    examTitle: string;
    subjectName: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    room: string;
    token: string;
    tokenActive: boolean;
    sessionStatus?: SessionStatus;
  }[];
}

export interface HeartbeatPayload {
  sessionId: string;
  currentQuestionIndex: number;
  answeredCount: number;
  tabViolations: number;
  clientTimestamp: number;
}
