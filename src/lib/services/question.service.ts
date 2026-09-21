import { queryPostgres } from '../core/postgres';
import { logAuditEvent } from './audit.service';
import { QuestionType, DifficultyLevel } from '../core/types';

export type QuestionLifecycleStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'LOCKED'
  | 'ARCHIVED';

export interface CreateGlobalQuestionPayload {
  subjectId?: string;
  topic: string;
  difficulty: DifficultyLevel;
  type: QuestionType;
  questionText: string;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'NONE';
  optionsJson?: any[];
  answerKeyJson: any;
  rubricJson?: any;
  weight?: number;
  tags?: string[];
  cognitiveLevel?: string;
  competenceCode?: string;
  stimulusText?: string;
}

export interface QuestionFilter {
  subjectId?: string;
  difficulty?: string;
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Mendapatkan daftar bank soal global dengan filter status lifecycle.
 */
export async function listGlobalQuestions(filter: QuestionFilter = {}) {
  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(100, Math.max(1, filter.limit || 20));
  const offset = (page - 1) * limit;

  let whereClauses: string[] = ['qb.is_global = true'];
  let params: any[] = [];

  if (filter.status && filter.status !== 'ALL') {
    params.push(filter.status.toUpperCase());
    whereClauses.push(`UPPER(COALESCE(qb.lifecycle_status, 'DRAFT')) = $${params.length}`);
  }

  if (filter.subjectId && filter.subjectId !== 'ALL') {
    params.push(filter.subjectId);
    whereClauses.push(`qb.subject_id = $${params.length}`);
  }

  if (filter.difficulty && filter.difficulty !== 'ALL') {
    params.push(filter.difficulty.toUpperCase());
    whereClauses.push(`qb.difficulty = $${params.length}`);
  }

  if (filter.type && filter.type !== 'ALL') {
    params.push(filter.type);
    whereClauses.push(`qb.type = $${params.length}`);
  }

  if (filter.search) {
    params.push(`%${filter.search.trim().toLowerCase()}%`);
    whereClauses.push(
      `(LOWER(qb.topic) LIKE $${params.length} OR LOWER(qb.question_text) LIKE $${params.length} OR LOWER(COALESCE(sub.name, '')) LIKE $${params.length})`
    );
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await queryPostgres(
    `SELECT COUNT(*) as total FROM question_banks qb 
     LEFT JOIN subjects sub ON qb.subject_id = sub.id 
     WHERE ${whereSql};`,
    params
  );
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const query = `
    SELECT 
      qb.id,
      qb.topic,
      qb.difficulty,
      qb.type,
      qb.question_text as "questionText",
      qb.media_url as "mediaUrl",
      qb.media_type as "mediaType",
      qb.options_json as "optionsJson",
      qb.answer_key_json as "answerKeyJson",
      qb.rubric_json as "rubricJson",
      qb.weight,
      qb.tags,
      qb.cognitive_level as "cognitiveLevel",
      qb.competence_code as "competenceCode",
      qb.stimulus_text as "stimulusText",
      COALESCE(qb.lifecycle_status, 'DRAFT') as "lifecycleStatus",
      COALESCE(qb.current_revision_number, 1) as "currentRevisionNumber",
      qb.rejection_reason as "rejectionReason",
      qb.curated_by as "curatedBy",
      qb.curated_at as "curatedAt",
      qb.created_at as "createdAt",
      qb.subject_id as "subjectId",
      sub.name as "subjectName",
      sub.code as "subjectCode",
      COALESCE(rev.rev_count, 0) as "totalRevisions"
    FROM question_banks qb
    LEFT JOIN subjects sub ON qb.subject_id = sub.id
    LEFT JOIN (
      SELECT question_id, COUNT(*) as rev_count FROM question_revisions GROUP BY question_id
    ) rev ON qb.id = rev.question_id
    WHERE ${whereSql}
    ORDER BY qb.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2};
  `;

  const res = await queryPostgres(query, [...params, limit, offset]);

  return {
    questions: res.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Mendapatkan detail lengkap soal global beserta riwayat revisinya.
 */
export async function getGlobalQuestionDetail(questionId: string) {
  const qRes = await queryPostgres(
    `SELECT 
      qb.*,
      COALESCE(qb.lifecycle_status, 'DRAFT') as "lifecycleStatus",
      COALESCE(qb.current_revision_number, 1) as "currentRevisionNumber",
      sub.name as "subjectName",
      sub.code as "subjectCode"
     FROM question_banks qb
     LEFT JOIN subjects sub ON qb.subject_id = sub.id
     WHERE qb.id = $1 LIMIT 1;`,
    [questionId]
  );

  if (qRes.rows.length === 0) {
    throw new Error('Soal global tidak ditemukan.');
  }

  const question = qRes.rows[0];

  const revRes = await queryPostgres(
    `SELECT 
      id, revision_number as "revisionNumber", topic, difficulty, type,
      question_text as "questionText", media_url as "mediaUrl", media_type as "mediaType",
      options_json as "optionsJson", answer_key_json as "answerKeyJson",
      rubric_json as "rubricJson", weight, stimulus_text as "stimulusText",
      created_at as "createdAt", created_by as "createdBy"
     FROM question_revisions
     WHERE question_id = $1
     ORDER BY revision_number DESC;`,
    [questionId]
  );

  return {
    question: {
      id: question.id,
      topic: question.topic,
      difficulty: question.difficulty,
      type: question.type,
      questionText: question.question_text,
      mediaUrl: question.media_url,
      mediaType: question.media_type,
      optionsJson: question.options_json,
      answerKeyJson: question.answer_key_json,
      rubricJson: question.rubric_json,
      weight: question.weight,
      tags: question.tags,
      stimulusText: question.stimulus_text,
      cognitiveLevel: question.cognitive_level,
      competenceCode: question.competence_code,
      lifecycleStatus: question.lifecycleStatus,
      currentRevisionNumber: question.currentRevisionNumber,
      rejectionReason: question.rejection_reason,
      subjectId: question.subject_id,
      subjectName: question.subjectName,
      subjectCode: question.subjectCode,
      createdAt: question.created_at,
    },
    revisions: revRes.rows,
  };
}

/**
 * Membuat soal global baru dalam status DRAFT.
 */
export async function createGlobalQuestion(
  payload: CreateGlobalQuestionPayload,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  if (!payload.topic || !payload.questionText) {
    throw new Error('Topik dan Teks Soal wajib diisi.');
  }

  const res = await queryPostgres(
    `INSERT INTO question_banks (
      subject_id, topic, difficulty, type, question_text,
      media_url, media_type, options_json, answer_key_json,
      rubric_json, weight, tags, stimulus_text, cognitive_level, competence_code,
      is_global, is_shared, lifecycle_status, current_revision_number, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      true, true, 'DRAFT', 1, NOW()
    ) RETURNING *;`,
    [
      payload.subjectId || null,
      payload.topic,
      payload.difficulty || 'MEDIUM',
      payload.type || 'PILIHAN_GANDA',
      payload.questionText,
      payload.mediaUrl || null,
      payload.mediaType || 'NONE',
      JSON.stringify(payload.optionsJson || []),
      JSON.stringify(payload.answerKeyJson || {}),
      JSON.stringify(payload.rubricJson || {}),
      payload.weight || 1.0,
      payload.tags || [],
      payload.stimulusText || null,
      payload.cognitiveLevel || null,
      payload.competenceCode || null,
    ]
  );

  const question = res.rows[0];

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    action: 'QUESTION_CREATED',
    resourceType: 'global_question',
    resourceId: question.id,
    severity: 'INFO',
    details: { topic: question.topic, type: question.type },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return question;
}

/**
 * Mengubah status lifecycle soal global (Transisi State Terkontrol).
 * DRAFT -> SUBMITTED -> REVIEW -> APPROVED -> PUBLISHED -> LOCKED
 */
export async function transitionQuestionStatus(
  questionId: string,
  newStatus: QuestionLifecycleStatus,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string },
  rejectionReason?: string
) {
  const currentRes = await queryPostgres(
    `SELECT * FROM question_banks WHERE id = $1 LIMIT 1;`,
    [questionId]
  );
  if (currentRes.rows.length === 0) throw new Error('Soal global tidak ditemukan.');
  const q = currentRes.rows[0];
  const oldStatus: QuestionLifecycleStatus = q.lifecycle_status || 'DRAFT';

  // Validasi transisi state
  const allowedTransitions: Record<QuestionLifecycleStatus, QuestionLifecycleStatus[]> = {
    DRAFT: ['SUBMITTED', 'ARCHIVED'],
    SUBMITTED: ['REVIEW', 'ARCHIVED'],
    REVIEW: ['APPROVED', 'DRAFT', 'ARCHIVED'],
    APPROVED: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
    PUBLISHED: ['LOCKED', 'ARCHIVED'],
    LOCKED: ['ARCHIVED'],
    ARCHIVED: [],
  };

  if (!allowedTransitions[oldStatus]?.includes(newStatus)) {
    throw new Error(`Transisi status dari '${oldStatus}' ke '${newStatus}' tidak diizinkan.`);
  }

  // Jika Reject (kembali ke DRAFT dari REVIEW/APPROVED), wajib ada reason
  if (newStatus === 'DRAFT' && (oldStatus === 'REVIEW' || oldStatus === 'APPROVED')) {
    if (!rejectionReason || rejectionReason.trim().length < 5) {
      throw new Error('Alasan penolakan (rejection reason) wajib disertakan minimal 5 karakter.');
    }
  }

  // Jika PUBLISHED, simpan revisi ke question_revisions sebagai immutable snapshot
  if (newStatus === 'PUBLISHED') {
    const revNum = q.current_revision_number || 1;
    await queryPostgres(
      `INSERT INTO question_revisions (
        question_id, revision_number, topic, difficulty, type,
        question_text, media_url, media_type, options_json, answer_key_json,
        rubric_json, weight, tags, stimulus_text, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      ON CONFLICT (question_id, revision_number) DO UPDATE SET
        topic = EXCLUDED.topic,
        question_text = EXCLUDED.question_text,
        options_json = EXCLUDED.options_json,
        answer_key_json = EXCLUDED.answer_key_json;`,
      [
        q.id,
        revNum,
        q.topic,
        q.difficulty,
        q.type,
        q.question_text,
        q.media_url,
        q.media_type,
        typeof q.options_json === 'string' ? q.options_json : JSON.stringify(q.options_json || []),
        typeof q.answer_key_json === 'string' ? q.answer_key_json : JSON.stringify(q.answer_key_json || {}),
        typeof q.rubric_json === 'string' ? q.rubric_json : (q.rubric_json ? JSON.stringify(q.rubric_json) : null),
        q.weight,
        q.tags,
        q.stimulus_text,
        actor.id,
      ]
    );
  }

  const updateRes = await queryPostgres(
    `UPDATE question_banks SET 
      lifecycle_status = $1,
      rejection_reason = $2,
      curated_by = $3,
      curated_at = NOW()
     WHERE id = $4 RETURNING *;`,
    [newStatus, rejectionReason || null, actor.fullName, questionId]
  );

  const actionMap: Record<QuestionLifecycleStatus, string> = {
    SUBMITTED: 'QUESTION_SUBMITTED',
    REVIEW: 'QUESTION_IN_REVIEW',
    APPROVED: 'QUESTION_APPROVED',
    DRAFT: rejectionReason ? 'QUESTION_REJECTED' : 'QUESTION_RESET',
    PUBLISHED: 'QUESTION_PUBLISHED',
    LOCKED: 'QUESTION_LOCKED',
    ARCHIVED: 'QUESTION_ARCHIVED',
  };

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    action: actionMap[newStatus] || 'QUESTION_STATUS_CHANGED',
    resourceType: 'global_question',
    resourceId: questionId,
    severity: newStatus === 'DRAFT' && rejectionReason ? 'WARNING' : 'INFO',
    details: {
      oldStatus,
      newStatus,
      topic: q.topic,
      rejectionReason: rejectionReason || undefined,
      curator: actor.fullName,
    },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return updateRes.rows[0];
}

/**
 * Mengedit soal global.
 * IMMUTABILITY RULE (Section 12):
 * Jika soal sudah PUBLISHED atau LOCKED, mutasi langsung DITOLAK.
 * Harus dibuat revisi baru (Revision 2, 3...) yang menginkremen revision number dan masuk status DRAFT/REVIEW.
 */
export async function updateOrReviseGlobalQuestion(
  questionId: string,
  payload: Partial<CreateGlobalQuestionPayload>,
  actor: { id: string; role: string; fullName: string; ip?: string; userAgent?: string }
) {
  const currentRes = await queryPostgres(
    `SELECT * FROM question_banks WHERE id = $1 LIMIT 1;`,
    [questionId]
  );
  if (currentRes.rows.length === 0) throw new Error('Soal global tidak ditemukan.');
  const q = currentRes.rows[0];
  const status: QuestionLifecycleStatus = q.lifecycle_status || 'DRAFT';

  // If already PUBLISHED or LOCKED, trigger new revision flow
  if (status === 'PUBLISHED' || status === 'LOCKED') {
    const nextRev = (q.current_revision_number || 1) + 1;

    // Update with new content, increment revision number, reset status to REVIEW or APPROVED
    const res = await queryPostgres(
      `UPDATE question_banks SET
        topic = COALESCE($1, topic),
        difficulty = COALESCE($2, difficulty),
        type = COALESCE($3, type),
        question_text = COALESCE($4, question_text),
        media_url = COALESCE($5, media_url),
        media_type = COALESCE($6, media_type),
        options_json = COALESCE($7, options_json),
        answer_key_json = COALESCE($8, answer_key_json),
        rubric_json = COALESCE($9, rubric_json),
        weight = COALESCE($10, weight),
        tags = COALESCE($11, tags),
        stimulus_text = COALESCE($12, stimulus_text),
        subject_id = COALESCE($13, subject_id),
        current_revision_number = $14,
        lifecycle_status = 'REVIEW'
       WHERE id = $15 RETURNING *;`,
      [
        payload.topic || null,
        payload.difficulty || null,
        payload.type || null,
        payload.questionText || null,
        payload.mediaUrl || null,
        payload.mediaType || null,
        payload.optionsJson ? JSON.stringify(payload.optionsJson) : null,
        payload.answerKeyJson ? JSON.stringify(payload.answerKeyJson) : null,
        payload.rubricJson ? JSON.stringify(payload.rubricJson) : null,
        payload.weight || null,
        payload.tags || null,
        payload.stimulusText || null,
        payload.subjectId || null,
        nextRev,
        questionId,
      ]
    );

    await logAuditEvent({
      userId: actor.id,
      role: actor.role,
      action: 'QUESTION_REVISED',
      resourceType: 'global_question',
      resourceId: questionId,
      severity: 'INFO',
      details: {
        revisionNumber: nextRev,
        previousStatus: status,
        newStatus: 'REVIEW',
        topic: q.topic,
      },
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
    });

    return {
      question: res.rows[0],
      isNewRevision: true,
      revisionNumber: nextRev,
      message: `Soal terbit telah dibuat revisi baru (Revisi #${nextRev}) dan masuk antrean penelaahan.`,
    };
  }

  // If in DRAFT or REVIEW, update directly
  const res = await queryPostgres(
    `UPDATE question_banks SET
      topic = COALESCE($1, topic),
      difficulty = COALESCE($2, difficulty),
      type = COALESCE($3, type),
      question_text = COALESCE($4, question_text),
      media_url = COALESCE($5, media_url),
      media_type = COALESCE($6, media_type),
      options_json = COALESCE($7, options_json),
      answer_key_json = COALESCE($8, answer_key_json),
      rubric_json = COALESCE($9, rubric_json),
      weight = COALESCE($10, weight),
      tags = COALESCE($11, tags),
      stimulus_text = COALESCE($12, stimulus_text),
      subject_id = COALESCE($13, subject_id)
     WHERE id = $14 RETURNING *;`,
    [
      payload.topic || null,
      payload.difficulty || null,
      payload.type || null,
      payload.questionText || null,
      payload.mediaUrl || null,
      payload.mediaType || null,
      payload.optionsJson ? JSON.stringify(payload.optionsJson) : null,
      payload.answerKeyJson ? JSON.stringify(payload.answerKeyJson) : null,
      payload.rubricJson ? JSON.stringify(payload.rubricJson) : null,
      payload.weight || null,
      payload.tags || null,
      payload.stimulusText || null,
      payload.subjectId || null,
      questionId,
    ]
  );

  await logAuditEvent({
    userId: actor.id,
    role: actor.role,
    action: 'QUESTION_UPDATED',
    resourceType: 'global_question',
    resourceId: questionId,
    severity: 'INFO',
    details: { topic: q.topic, status },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
  });

  return {
    question: res.rows[0],
    isNewRevision: false,
    message: 'Data soal berhasil diperbarui.',
  };
}
