import { queryPostgres } from '../core/postgres';
import { logAuditEvent } from './audit.service';

export type RegionalExamStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'ARCHIVED';

export interface CreateRegionalExamPayload {
  title: string;
  subjectId?: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  passingGrade?: number;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  showScorePolicy?: 'IMMEDIATELY' | 'AFTER_ALL_DONE' | 'SCHEDULED' | 'NEVER';
  scoringRulesJson?: Record<string, any>;
  assignedSchoolIds?: string[];
  selectedQuestionIds?: string[];
}

export interface RegionalExamFilter {
  status?: string;
  subjectId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Mendapatkan daftar ujian serentak wilayah beserta sekolah yang ditugaskan.
 */
export async function listRegionalExams(filter: RegionalExamFilter = {}) {
  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(100, Math.max(1, filter.limit || 20));
  const offset = (page - 1) * limit;

  let whereClauses: string[] = ['e.is_regional = true'];
  let params: any[] = [];

  if (filter.status && filter.status !== 'ALL') {
    params.push(filter.status.toUpperCase());
    whereClauses.push(`UPPER(e.status) = $${params.length}`);
  }

  if (filter.subjectId && filter.subjectId !== 'ALL') {
    params.push(filter.subjectId);
    whereClauses.push(`e.subject_id = $${params.length}`);
  }

  if (filter.search) {
    params.push(`%${filter.search.trim().toLowerCase()}%`);
    whereClauses.push(
      `(LOWER(e.title) LIKE $${params.length} OR LOWER(COALESCE(sub.name, '')) LIKE $${params.length})`
    );
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await queryPostgres(
    `SELECT COUNT(*) as total FROM exams e 
     LEFT JOIN subjects sub ON e.subject_id = sub.id 
     WHERE ${whereSql};`,
    params
  );
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const query = `
    SELECT 
      e.id,
      e.title,
      e.status,
      e.start_time as "startTime",
      e.end_time as "endTime",
      e.duration_minutes as "durationMinutes",
      e.passing_grade as "passingGrade",
      e.randomize_questions as "randomizeQuestions",
      e.randomize_options as "randomizeOptions",
      e.show_score_policy as "showScorePolicy",
      e.scoring_rules_json as "scoringRulesJson",
      e.created_at as "createdAt",
      e.subject_id as "subjectId",
      sub.name as "subjectName",
      sub.code as "subjectCode",
      COALESCE(sch.school_count, 0) as "totalAssignedSchools",
      COALESCE(part.participant_count, 0) as "totalParticipants",
      jsonb_array_length(COALESCE(e.question_snapshot_json, '[]'::jsonb)) as "totalQuestions"
    FROM exams e
    LEFT JOIN subjects sub ON e.subject_id = sub.id
    LEFT JOIN (
      SELECT exam_id, COUNT(*) as school_count FROM regional_exam_schools GROUP BY exam_id
    ) sch ON e.id = sch.exam_id
    LEFT JOIN (
      SELECT exam_id, COUNT(*) as participant_count FROM exam_participants GROUP BY exam_id
    ) part ON e.id = part.exam_id
    WHERE ${whereSql}
    ORDER BY e.start_time DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;

  const res = await queryPostgres(query, [...params, limit, offset]);

  return {
    exams: res.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Mendapatkan detail lengkap ujian wilayah beserta sekolah dan butir soalnya.
 */
export async function getRegionalExamDetail(examId: string) {
  const examRes = await queryPostgres(
    `SELECT e.*, sub.name as "subjectName", sub.code as "subjectCode"
     FROM exams e
     LEFT JOIN subjects sub ON e.subject_id = sub.id
     WHERE e.id = $1 AND e.is_regional = true LIMIT 1;`,
    [examId]
  );

  if (examRes.rows.length === 0) {
    throw new Error('Ujian serentak wilayah tidak ditemukan.');
  }

  const exam = examRes.rows[0];

  // Assigned schools
  const schoolsRes = await queryPostgres(
    `SELECT s.id, s.code, s.name, s.level, s.rayon, s.status, res.created_at as "assignedAt"
     FROM regional_exam_schools res
     JOIN schools s ON res.school_id = s.id
     WHERE res.exam_id = $1
     ORDER BY s.name ASC;`,
    [examId]
  );

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      status: exam.status,
      startTime: exam.start_time,
      endTime: exam.end_time,
      durationMinutes: exam.duration_minutes,
      passingGrade: exam.passing_grade,
      randomizeQuestions: exam.randomize_questions,
      randomizeOptions: exam.randomize_options,
      showScorePolicy: exam.show_score_policy,
      scoringRulesJson: exam.scoring_rules_json,
      questionSnapshotJson: exam.question_snapshot_json || [],
      createdAt: exam.created_at,
      subjectId: exam.subject_id,
      subjectName: exam.subjectName,
      subjectCode: exam.subjectCode,
    },
    assignedSchools: schoolsRes.rows,
  };
}

/**
 * Membuat Ujian Serentak Wilayah baru dengan validasi server-side.
 */
export async function createRegionalExam(
  payload: CreateRegionalExamPayload,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  if (!payload.title || !payload.startTime || !payload.endTime || !payload.durationMinutes) {
    throw new Error('Judul, Waktu Mulai, Waktu Selesai, dan Durasi Ujian wajib diisi.');
  }

  const start = new Date(payload.startTime);
  const end = new Date(payload.endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Format waktu mulai atau selesai tidak valid.');
  }

  if (end <= start) {
    throw new Error('Waktu selesai ujian harus lebih besar dari waktu mulai.');
  }

  if (payload.durationMinutes < 5 || payload.durationMinutes > 360) {
    throw new Error('Durasi pengerjaan harus antara 5 menit hingga 360 menit.');
  }

  // Load question snapshot if selected question IDs provided
  let questionSnapshot: any[] = [];
  if (payload.selectedQuestionIds && payload.selectedQuestionIds.length > 0) {
    const qRes = await queryPostgres(
      `SELECT id, topic, difficulty, type, question_text, media_url, media_type,
              options_json, answer_key_json, rubric_json, weight, tags, stimulus_text
       FROM question_banks
       WHERE id = ANY($1::uuid[]);`,
      [payload.selectedQuestionIds]
    );
    questionSnapshot = qRes.rows;
  }

  const insertRes = await queryPostgres(
    `INSERT INTO exams (
      title, subject_id, created_by, status, is_regional,
      start_time, end_time, duration_minutes, passing_grade,
      randomize_questions, randomize_options, show_score_policy,
      scoring_rules_json, question_snapshot_json, created_at
    ) VALUES (
      $1, $2, $3, 'DRAFT', true,
      $4, $5, $6, $7,
      $8, $9, $10,
      $11, $12, NOW()
    ) RETURNING *;`,
    [
      payload.title.trim(),
      payload.subjectId || null,
      actor.id,
      start.toISOString(),
      end.toISOString(),
      payload.durationMinutes,
      payload.passingGrade || 75.0,
      payload.randomizeQuestions ?? true,
      payload.randomizeOptions ?? true,
      payload.showScorePolicy || 'AFTER_ALL_DONE',
      JSON.stringify(payload.scoringRulesJson || {}),
      JSON.stringify(questionSnapshot),
    ]
  );

  const exam = insertRes.rows[0];

  // Assign schools if provided
  if (payload.assignedSchoolIds && payload.assignedSchoolIds.length > 0) {
    for (const schoolId of payload.assignedSchoolIds) {
      await queryPostgres(
        `INSERT INTO regional_exam_schools (exam_id, school_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (exam_id, school_id) DO NOTHING;`,
        [exam.id, schoolId]
      );
    }
  }

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    action: 'REGIONAL_EXAM_CREATED',
    resourceType: 'regional_exam',
    resourceId: exam.id,
    severity: 'INFO',
    details: {
      title: exam.title,
      durationMinutes: exam.duration_minutes,
      assignedSchoolsCount: payload.assignedSchoolIds?.length || 0,
      totalQuestions: questionSnapshot.length,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return exam;
}

/**
 * Menugaskan sekolah-sekolah ke ujian serentak wilayah (Relasi Eksplisit regional_exam_schools).
 */
export async function assignSchoolsToRegionalExam(
  examId: string,
  schoolIds: string[],
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const examRes = await queryPostgres(`SELECT id, title, status FROM exams WHERE id = $1 LIMIT 1;`, [examId]);
  if (examRes.rows.length === 0) throw new Error('Ujian tidak ditemukan.');
  const exam = examRes.rows[0];

  // Sync schools: delete unselected, insert new
  await queryPostgres(`DELETE FROM regional_exam_schools WHERE exam_id = $1;`, [examId]);

  if (schoolIds.length > 0) {
    for (const sId of schoolIds) {
      await queryPostgres(
        `INSERT INTO regional_exam_schools (exam_id, school_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT DO NOTHING;`,
        [examId, sId]
      );
    }
  }

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    action: 'REGIONAL_EXAM_SCHOOLS_ASSIGNED',
    resourceType: 'regional_exam',
    resourceId: examId,
    severity: 'INFO',
    details: {
      examTitle: exam.title,
      totalSchoolsAssigned: schoolIds.length,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return { success: true, totalAssigned: schoolIds.length };
}

/**
 * Mengubah status lifecycle ujian wilayah (DRAFT -> SCHEDULED -> PUBLISHED -> RUNNING -> COMPLETED -> ARCHIVED).
 * IMMUTABILITY & LOCK RULE (Section 17):
 * Saat exam PUBLISHED atau RUNNING, butir soal DIBEKUKAN (frozen) dalam question_snapshot_json.
 */
export async function transitionRegionalExamStatus(
  examId: string,
  newStatus: RegionalExamStatus,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const examRes = await queryPostgres(
    `SELECT id, title, status, question_snapshot_json FROM exams WHERE id = $1 LIMIT 1;`,
    [examId]
  );
  if (examRes.rows.length === 0) throw new Error('Ujian serentak wilayah tidak ditemukan.');
  const exam = examRes.rows[0];
  const oldStatus = exam.status || 'DRAFT';

  // State machine validation
  const allowedTransitions: Record<string, string[]> = {
    DRAFT: ['SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
    SCHEDULED: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
    PUBLISHED: ['RUNNING', 'COMPLETED', 'ARCHIVED'],
    RUNNING: ['COMPLETED', 'ARCHIVED'],
    COMPLETED: ['ARCHIVED'],
    ARCHIVED: [],
  };

  if (!allowedTransitions[oldStatus]?.includes(newStatus)) {
    throw new Error(`Transisi status ujian dari '${oldStatus}' ke '${newStatus}' tidak diizinkan.`);
  }

  // When publishing or starting, ensure questions snapshot is valid and locked
  if (newStatus === 'PUBLISHED' || newStatus === 'RUNNING') {
    const snapshot = exam.question_snapshot_json;
    if (!Array.isArray(snapshot) || snapshot.length === 0) {
      throw new Error('Ujian tidak dapat dipublikasikan atau dijalankan tanpa naskah butir soal (Question Snapshot).');
    }
  }

  const res = await queryPostgres(
    `UPDATE exams SET status = $1 WHERE id = $2 RETURNING *;`,
    [newStatus, examId]
  );

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    action: `EXAM_${newStatus}`,
    resourceType: 'regional_exam',
    resourceId: examId,
    severity: newStatus === 'RUNNING' || newStatus === 'COMPLETED' ? 'INFO' : 'WARNING',
    details: {
      oldStatus,
      newStatus,
      examTitle: exam.title,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return res.rows[0];
}
