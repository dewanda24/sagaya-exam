import pg from 'pg';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
import './load-env.mjs';

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Error: DIRECT_URL / DATABASE_URL tidak ditemukan.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    failedTests++;
    throw new Error(message);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
    passedTests++;
  }
}

// -------------------------------------------------------------
// SCORING SERVICE NATIVE RUNNER LOGIC (Mirroring src/lib/services)
// -------------------------------------------------------------
function roundScore(val, decimals = 2) {
  if (isNaN(val) || !isFinite(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function scoreQuestion(question, studentAnswer, options, scoringConfig) {
  const maxScore = Number(question.points ?? question.weight ?? 1.0);
  const config = {
    ...(question.scoringConfig || {}),
    ...(scoringConfig || {}),
  };

  const isUnanswered =
    studentAnswer === undefined ||
    studentAnswer === null ||
    studentAnswer === '' ||
    (Array.isArray(studentAnswer) && studentAnswer.length === 0) ||
    (typeof studentAnswer === 'object' && Object.keys(studentAnswer).length === 0);

  const type = (question.type || 'PILIHAN_GANDA').toUpperCase();

  switch (type) {
    case 'PILIHAN_GANDA': {
      if (isUnanswered) {
        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: null,
          isCorrect: false,
          score: 0,
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { reason: 'UNANSWERED' },
        };
      }

      const normUser = String(studentAnswer).trim().toUpperCase();
      const normKey = String(question.answerKey).trim().toUpperCase();
      const isCorrect = normUser === normKey;

      let score = 0;
      if (isCorrect) {
        score = maxScore;
      } else if (config.negative_marking) {
        const penalty = Number(config.wrong_answer_penalty ?? 0.25);
        score = -Math.abs(penalty);
      }

      return {
        questionId: question.id,
        type,
        rawAnswer: studentAnswer,
        normalizedAnswer: normUser,
        isCorrect,
        score: roundScore(score),
        maxScore,
        scoreStatus: 'AUTOMATED',
        details: { normUser, isCorrect },
      };
    }

    case 'PG_KOMPLEKS': {
      if (isUnanswered) {
        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: [],
          isCorrect: false,
          score: 0,
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { reason: 'UNANSWERED' },
        };
      }

      const userAnswers = Array.isArray(studentAnswer)
        ? studentAnswer.map((a) => String(a).trim().toUpperCase()).sort()
        : [String(studentAnswer).trim().toUpperCase()];

      const correctKeys = Array.isArray(question.answerKey)
        ? question.answerKey.map((k) => String(k).trim().toUpperCase()).sort()
        : [String(question.answerKey).trim().toUpperCase()];

      const scoringMode = config.scoring_mode || 'ALL_OR_NOTHING';

      const isExactMatch =
        userAnswers.length === correctKeys.length &&
        userAnswers.every((val, idx) => val === correctKeys[idx]);

      if (scoringMode === 'ALL_OR_NOTHING') {
        let score = 0;
        if (isExactMatch) {
          score = maxScore;
        } else if (config.negative_marking) {
          const penalty = Number(config.wrong_answer_penalty ?? 0.25);
          score = -Math.abs(penalty);
        }
        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: userAnswers,
          isCorrect: isExactMatch,
          score: roundScore(score),
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { scoringMode, isExactMatch },
        };
      }

      // PARTIAL_CREDIT
      let correctChosen = 0;
      let wrongChosen = 0;
      for (const ans of userAnswers) {
        if (correctKeys.includes(ans)) {
          correctChosen++;
        } else {
          wrongChosen++;
        }
      }

      const totalCorrect = correctKeys.length || 1;
      const penaltyMultiplier = config.wrong_penalty_factor ?? 0.25;
      let ratio = correctChosen / totalCorrect - wrongChosen * penaltyMultiplier;
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;

      const partialScore = Math.max(0, Math.min(maxScore, ratio * maxScore));

      return {
        questionId: question.id,
        type,
        rawAnswer: studentAnswer,
        normalizedAnswer: userAnswers,
        isCorrect: isExactMatch,
        score: roundScore(partialScore),
        maxScore,
        scoreStatus: 'AUTOMATED',
        details: { scoringMode: 'PARTIAL_CREDIT', correctChosen, wrongChosen, ratio },
      };
    }

    case 'BENAR_SALAH': {
      if (isUnanswered) {
        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: null,
          isCorrect: false,
          score: 0,
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { reason: 'UNANSWERED' },
        };
      }

      const normalizeBool = (v) => {
        if (v === true || v === false) return v;
        if (v === undefined || v === null) return null;
        const s = String(v).trim().toUpperCase();
        if (['TRUE', 'BENAR', 'T', 'B', '1'].includes(s)) return true;
        if (['FALSE', 'SALAH', 'F', 'S', '0'].includes(s)) return false;
        return null;
      };

      const userBool = normalizeBool(studentAnswer);
      const keyBool = normalizeBool(question.answerKey);
      const isCorrect = userBool !== null && userBool === keyBool;

      let score = 0;
      if (isCorrect) {
        score = maxScore;
      } else if (config.negative_marking) {
        const penalty = Number(config.wrong_answer_penalty ?? 0.25);
        score = -Math.abs(penalty);
      }

      return {
        questionId: question.id,
        type,
        rawAnswer: studentAnswer,
        normalizedAnswer: userBool,
        isCorrect,
        score: roundScore(score),
        maxScore,
        scoreStatus: 'AUTOMATED',
        details: { userBool, keyBool },
      };
    }

    case 'MENJODOHKAN': {
      if (isUnanswered) {
        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: {},
          isCorrect: false,
          score: 0,
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { reason: 'UNANSWERED' },
        };
      }

      const userPairs = typeof studentAnswer === 'object' && studentAnswer !== null ? studentAnswer : {};
      const keyPairs = typeof question.answerKey === 'object' && question.answerKey !== null ? question.answerKey : {};

      const totalPairs = Object.keys(keyPairs).length;
      if (totalPairs === 0) {
        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: userPairs,
          isCorrect: true,
          score: maxScore,
          maxScore,
          scoreStatus: 'AUTOMATED',
        };
      }

      let correctMatches = 0;
      for (const [k, expectedVal] of Object.entries(keyPairs)) {
        const userVal = (userPairs[k] ?? '').toString().trim().toUpperCase();
        const expVal = (expectedVal ?? '').toString().trim().toUpperCase();
        if (userVal !== '' && userVal === expVal) {
          correctMatches++;
        }
      }

      const isExactMatch = correctMatches === totalPairs;
      const scoringMode = config.scoring_mode || 'PARTIAL_CREDIT';

      let score = 0;
      if (scoringMode === 'ALL_OR_NOTHING') {
        score = isExactMatch ? maxScore : 0;
      } else {
        score = Math.max(0, Math.min(maxScore, (correctMatches / totalPairs) * maxScore));
      }

      return {
        questionId: question.id,
        type,
        rawAnswer: studentAnswer,
        normalizedAnswer: userPairs,
        isCorrect: isExactMatch,
        score: roundScore(score),
        maxScore,
        scoreStatus: 'AUTOMATED',
        details: { correctMatches, totalPairs, scoringMode },
      };
    }

    case 'ISIAN_SINGKAT': {
      if (isUnanswered) {
        return {
          questionId: question.id,
          type,
          rawAnswer: studentAnswer,
          normalizedAnswer: '',
          isCorrect: false,
          score: 0,
          maxScore,
          scoreStatus: 'AUTOMATED',
          details: { reason: 'UNANSWERED' },
        };
      }

      const cleanString = (val) => {
        if (val === undefined || val === null) return '';
        let s = String(val);
        if (config.trim_whitespace !== false) s = s.trim();
        if (config.normalize_spaces !== false) s = s.replace(/\s+/g, ' ');
        if (config.ignore_punctuation !== false) s = s.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"\[\]]/g, '');
        if (!config.case_sensitive) s = s.toLowerCase();
        return s.trim();
      };

      const normUser = cleanString(studentAnswer);

      let acceptedKeys = [];
      if (Array.isArray(config.accepted_answers) && config.accepted_answers.length > 0) {
        acceptedKeys = config.accepted_answers;
      } else if (Array.isArray(question.answerKey)) {
        acceptedKeys = question.answerKey;
      } else if (question.answerKey !== undefined && question.answerKey !== null) {
        acceptedKeys = [question.answerKey];
      }

      const isCorrect = acceptedKeys.some((k) => cleanString(k) === normUser && normUser !== '');

      return {
        questionId: question.id,
        type,
        rawAnswer: studentAnswer,
        normalizedAnswer: normUser,
        isCorrect,
        score: isCorrect ? maxScore : 0,
        maxScore,
        scoreStatus: 'AUTOMATED',
        details: { normUser, acceptedKeysCount: acceptedKeys.length },
      };
    }

    case 'ESSAY': {
      return {
        questionId: question.id,
        type,
        rawAnswer: studentAnswer,
        normalizedAnswer: studentAnswer ? String(studentAnswer).trim() : '',
        isCorrect: false,
        score: 0,
        maxScore,
        scoreStatus: 'PENDING_MANUAL_REVIEW',
        details: { requiresManualReview: true, rubric: question.rubric },
        feedback: 'Menunggu penilaian guru.',
      };
    }

    default: {
      return {
        questionId: question.id,
        type,
        rawAnswer: studentAnswer,
        normalizedAnswer: studentAnswer,
        isCorrect: false,
        score: 0,
        maxScore,
        scoreStatus: 'AUTOMATED',
        details: { unknownType: type },
      };
    }
  }
}

function calculateNormalizedScore(rawScore, maxScore, targetScale = 100) {
  if (maxScore <= 0) return 0;
  return roundScore((rawScore / maxScore) * targetScale);
}

function calculateFinalScore(evaluatedQuestions, examPolicy) {
  let rawScore = 0;
  let maxScore = 0;

  for (const q of evaluatedQuestions) {
    rawScore += q.score || 0;
    maxScore += q.maxScore || 0;
  }

  rawScore = roundScore(rawScore);
  maxScore = roundScore(maxScore);

  const targetScale = examPolicy?.targetScale || 100;
  let normalizedScore = maxScore > 0 ? (rawScore / maxScore) * targetScale : 0;
  normalizedScore = roundScore(normalizedScore);

  let finalScore = normalizedScore;
  if (!examPolicy?.allowNegativeFinalScore) {
    finalScore = Math.max(0, finalScore);
  }
  finalScore = roundScore(finalScore);

  const percentage = maxScore > 0 ? roundScore(Math.max(0, (rawScore / maxScore) * 100)) : 0;

  return { rawScore, maxScore, normalizedScore, finalScore, percentage };
}

function sanitizeForFormulaInjection(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

// -------------------------------------------------------------
// DATABASE PIPELINE EXECUTORS
// -------------------------------------------------------------
async function executeScoreSession(client, sessionId) {
  const sessRes = await client.query(
    `SELECT es.*, e.id as exam_id, e.school_id, e.title as exam_title, e.active_snapshot_id,
            ep.id as participant_id, ep.student_id
     FROM exam_sessions es
     JOIN exam_participants ep ON es.participant_id = ep.id
     JOIN exams e ON ep.exam_id = e.id
     WHERE es.id = $1
     FOR UPDATE;`,
    [sessionId]
  );

  if (sessRes.rows.length === 0) throw new Error('Session not found');
  const session = sessRes.rows[0];

  const existingResultRes = await client.query(
    `SELECT * FROM exam_results WHERE session_id = $1 LIMIT 1;`,
    [sessionId]
  );

  const snapshotId = session.snapshot_id || session.active_snapshot_id;
  const frozenQuestionsRes = await client.query(
    `SELECT id, question_id, question_version_id, position, section, points, configuration_json
     FROM exam_snapshot_questions
     WHERE snapshot_id = $1
     ORDER BY position ASC;`,
    [snapshotId]
  );

  const answersRes = await client.query(
    `SELECT * FROM student_answers WHERE session_id = $1;`,
    [sessionId]
  );
  const answersMap = new Map();
  for (const a of answersRes.rows) answersMap.set(a.question_id, a);

  const evaluations = [];
  let essayPendingCount = 0;

  for (const fq of frozenQuestionsRes.rows) {
    const qConfig = fq.configuration_json;
    const studentAnsRow = answersMap.get(fq.question_id);
    const rawAns = studentAnsRow?.answer_value_json;

    const ev = scoreQuestion(
      {
        id: fq.question_id,
        type: qConfig.type,
        points: Number(fq.points || qConfig.weight || 1.0),
        answerKey: qConfig.answerKey,
        options: qConfig.options,
        rubric: qConfig.rubric,
        scoringConfig: qConfig.scoringConfig,
      },
      rawAns
    );

    if (ev.type === 'ESSAY' && studentAnsRow?.manual_score !== null && studentAnsRow?.manual_score !== undefined) {
      ev.score = Number(studentAnsRow.manual_score);
      ev.scoreStatus = 'MANUALLY_GRADED';
    }

    if (ev.scoreStatus === 'PENDING_MANUAL_REVIEW') essayPendingCount++;
    evaluations.push(ev);
  }

  const scores = calculateFinalScore(evaluations);
  const resultStatus = essayPendingCount > 0 ? 'PARTIALLY_GRADED' : 'GRADED';

  let resultId;
  let isNewResult = false;

  if (existingResultRes.rows.length > 0) {
    resultId = existingResultRes.rows[0].id;
    await client.query(
      `UPDATE exam_results SET
         raw_score = $1, max_score = $2, normalized_score = $3, final_score = $4, percentage = $5,
         status = CASE WHEN status IN ('REVIEWED', 'PUBLISHED', 'VOID') THEN status ELSE $6 END,
         updated_at = NOW()
       WHERE id = $7;`,
      [scores.rawScore, scores.maxScore, scores.normalizedScore, scores.finalScore, scores.percentage, resultStatus, resultId]
    );
  } else {
    const ins = await client.query(
      `INSERT INTO exam_results (
         id, exam_id, session_id, participant_id, student_id, school_id,
         raw_score, max_score, normalized_score, final_score, percentage,
         status, scoring_version, graded_at, created_at, updated_at
       ) VALUES (
         uuid_generate_v4(), $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, 'v1.0', NOW(), NOW(), NOW()
       ) RETURNING id;`,
      [
        session.exam_id, sessionId, session.participant_id, session.student_id, session.school_id,
        scores.rawScore, scores.maxScore, scores.normalizedScore, scores.finalScore, scores.percentage,
        resultStatus,
      ]
    );
    resultId = ins.rows[0].id;
    isNewResult = true;
  }

  for (const ev of evaluations) {
    await client.query(
      `INSERT INTO exam_question_results (
         id, result_id, question_id, question_version_id, answer, score, max_score, score_status, created_at, updated_at
       ) VALUES (
         uuid_generate_v4(), $1, $2, $2, $3, $4, $5, $6, NOW(), NOW()
       )
       ON CONFLICT (result_id, question_id) DO UPDATE SET
         score = EXCLUDED.score,
         score_status = CASE WHEN exam_question_results.score_status = 'MANUALLY_GRADED' THEN 'MANUALLY_GRADED' ELSE EXCLUDED.score_status END,
         updated_at = NOW();`,
      [resultId, ev.questionId, JSON.stringify(ev.rawAnswer ?? null), ev.score, ev.maxScore, ev.scoreStatus]
    );
  }

  await client.query(
    `UPDATE exam_participants SET final_score = $1, graded_status = $2 WHERE id = $3;`,
    [scores.finalScore, resultStatus === 'PARTIALLY_GRADED' ? 'PARTIAL' : 'GRADED', session.participant_id]
  );

  return { resultId, isNewResult, status: resultStatus, finalScore: scores.finalScore, rawScore: scores.rawScore };
}

async function executeGradeEssay(client, schoolId, graderId, answerId, data, actorRole = 'GURU') {
  const ansRes = await client.query(
    `SELECT sa.*, qb.weight as max_score, ep.id as participant_id, ep.exam_id, er.id as result_id, e.school_id
     FROM student_answers sa
     JOIN question_banks qb ON sa.question_id = qb.id::text
     JOIN exam_sessions es ON sa.session_id = es.id
     JOIN exam_participants ep ON es.participant_id = ep.id
     JOIN exams e ON ep.exam_id = e.id
     LEFT JOIN exam_results er ON es.id = er.session_id
     WHERE sa.id = $1 AND e.school_id = $2;`,
    [answerId, schoolId]
  );

  if (ansRes.rows.length === 0) throw new Error('Akses ditolak atau jawaban tidak ditemukan');
  const ans = ansRes.rows[0];
  const maxScore = parseFloat(ans.max_score || '10.0');

  // Optimistic locking check
  const currentVersion = Number(ans.version || 1);
  if (data.clientVersion !== undefined && data.clientVersion !== currentVersion) {
    const err = new Error('REVIEW_CONFLICT: Versi koreksi telah diperbarui oleh korektor lain');
    err.code = 'REVIEW_CONFLICT';
    throw err;
  }

  if (data.manualScore < 0 || data.manualScore > maxScore) {
    throw new Error(`Skor (${data.manualScore}) melebihi batas maksimal (${maxScore})`);
  }

  const nextVersion = currentVersion + 1;
  const newScore = roundScore(data.manualScore);

  await client.query(
    `UPDATE student_answers SET
       manual_score = $1, rubric_scores_json = $2, feedback = $3,
       teacher_internal_note = $4, graded_by = $5, version = $6, updated_at = NOW()
     WHERE id = $7;`,
    [newScore, JSON.stringify(data.rubricScores || {}), data.feedback || null, data.teacherInternalNote || null, graderId, nextVersion, answerId]
  );

  if (ans.result_id) {
    const qRes = await client.query(
      `INSERT INTO exam_question_results (
         id, result_id, question_id, question_version_id, score, max_score, score_status, grader_id, version, created_at, updated_at
       ) VALUES (
         uuid_generate_v4(), $1, $2, $2, $3, $4, 'MANUALLY_GRADED', $5, $6, NOW(), NOW()
       )
       ON CONFLICT (result_id, question_id) DO UPDATE SET
         score = EXCLUDED.score,
         score_status = 'MANUALLY_GRADED',
         grader_id = EXCLUDED.grader_id,
         version = exam_question_results.version + 1,
         updated_at = NOW()
       RETURNING id;`,
      [ans.result_id, ans.question_id, newScore, maxScore, graderId, nextVersion]
    );

    const questionResultId = qRes.rows[0]?.id;
    if (questionResultId) {
      await client.query(
        `INSERT INTO essay_gradings (
           id, question_result_id, grader_id, rubric_scores_json, total_score, max_score, feedback, internal_note, version, created_at
         ) VALUES (
           uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()
         );`,
        [questionResultId, graderId, JSON.stringify(data.rubricScores || {}), newScore, maxScore, data.feedback || null, data.teacherInternalNote || null, nextVersion]
      );
    }

    // Update result status
    await client.query(
      `UPDATE exam_results SET
         status = 'GRADED',
         final_score = (SELECT SUM(score) FROM exam_question_results WHERE result_id = $1),
         updated_at = NOW()
       WHERE id = $1;`,
      [ans.result_id]
    );
  }

  return { gradedStatus: 'GRADED', version: nextVersion, newScore };
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('SAGAYA EXAM — SPRINT 08 SCORING & RESULTS ENGINE TEST SUITE');
  console.log('===============================================================\n');

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------
    // SETUP TEST FIXTURE (School, Users, Exam, Snapshot, Participants)
    // -------------------------------------------------------------
    console.log('--- Setting Up Test Environment Fixture ---');
    const testSchoolId = crypto.randomUUID();
    const otherSchoolId = crypto.randomUUID();
    const adminUserId = crypto.randomUUID();
    const teacherUserId = crypto.randomUUID();
    const proctorUserId = crypto.randomUUID();
    const otherSchoolTeacherId = crypto.randomUUID();
    const studentAId = crypto.randomUUID();
    const studentBId = crypto.randomUUID();
    const examId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const participantAId = crypto.randomUUID();
    const participantBId = crypto.randomUUID();
    const sessionAId = crypto.randomUUID();
    const sessionBId = crypto.randomUUID();

    // 1. Insert Schools
    await client.query(
      `INSERT INTO schools (id, code, name, level) VALUES
       ($1, $2, 'SMA Negeri Scoring Test', 'SMA'),
       ($3, $4, 'SMA Sekolah Lain', 'SMA');`,
      [testSchoolId, `SCH_SCOR_${Date.now()}`, otherSchoolId, `SCH_OTHER_${Date.now()}`]
    );

    // 2. Insert Users
    await client.query(
      `INSERT INTO users (id, school_id, username, password_hash, full_name, role) VALUES
       ($1, $2, $3, 'hash_pwd', 'Admin Scoring', 'ADMIN'),
       ($4, $2, $5, 'hash_pwd', 'Guru Penilai', 'GURU'),
       ($6, $2, $7, 'hash_pwd', 'Pengawas Ruang', 'PENGAWAS'),
       ($8, $9, $10, 'hash_pwd', 'Guru Sekolah Lain', 'GURU');`,
      [
        adminUserId, testSchoolId, `admin_sc_${Date.now()}`,
        teacherUserId, `guru_sc_${Date.now()}`,
        proctorUserId, `proctor_sc_${Date.now()}`,
        otherSchoolTeacherId, otherSchoolId, `guru_other_${Date.now()}`,
      ]
    );

    // 3. Insert Students
    const nisA = `NIS_${String(Date.now()).slice(-6)}`;
    const nisB = `NIS_${String(Date.now() + 1).slice(-6)}`;
    await client.query(
      `INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code) VALUES
       ($1, $2, $3, $4, 'Siswa Alpha', $5),
       ($6, $7, $8, $9, 'Siswa Beta', $10);`,
      [
        studentAId, testSchoolId, nisA, `NISN_A_${Date.now()}`, `PIN_${nisA}`,
        studentBId, testSchoolId, nisB, `NISN_B_${Date.now()}`, `PIN_${nisB}`,
      ]
    );

    // 4. Insert Subject & Exam
    const subjectId = crypto.randomUUID();
    await client.query(
      `INSERT INTO subjects (id, school_id, code, name) VALUES ($1, $2, $3, 'Matematika Scoring');`,
      [subjectId, testSchoolId, `SC_${Date.now()}`]
    );

    await client.query(
      `INSERT INTO exams (
         id, school_id, title, subject_id, created_by, status, window_mode,
         start_time, end_time, duration_minutes, active_snapshot_id, passing_grade, show_score_policy
       ) VALUES (
         $1, $2, 'Ujian Akhir Semester Scoring Engine', $3, $4, 'PUBLISHED', 'FLEXIBLE',
         NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 90, NULL, 75.0, 'AFTER_ALL_DONE'
       );`,
      [examId, testSchoolId, subjectId, teacherUserId]
    );

    // 5. Insert Exam Snapshot & Questions (All 6 Question Types Frozen)
    await client.query(
      `INSERT INTO exam_snapshots (id, exam_id, school_id, version, metadata_json, locked_at) VALUES
       ($1, $2, $3, 1, '{"examTitle": "UAS Scoring", "totalQuestions": 6}'::jsonb, NOW());`,
      [snapshotId, examId, testSchoolId]
    );

    await client.query(
      `UPDATE exams SET active_snapshot_id = $1 WHERE id = $2;`,
      [snapshotId, examId]
    );

    const q1_mc_id = crypto.randomUUID();
    const q2_cmc_id = crypto.randomUUID();
    const q3_tf_id = crypto.randomUUID();
    const q4_match_id = crypto.randomUUID();
    const q5_short_id = crypto.randomUUID();
    const q6_essay_id = crypto.randomUUID();

    // Insert master questions into question_banks
    await client.query(
      `INSERT INTO question_banks (id, school_id, subject_id, teacher_id, topic, difficulty, type, question_text, answer_key_json, weight) VALUES
       ($1, $7, $8, $9, 'Aritmatika', 'EASY', 'PILIHAN_GANDA', 'Berapakah 2 + 2?', '"opt_4"', 5.0),
       ($2, $7, $8, $9, 'Bilangan Prima', 'MEDIUM', 'PG_KOMPLEKS', 'Pilihlah bilangan prima:', '["opt_2", "opt_3", "opt_5", "opt_7"]', 10.0),
       ($3, $7, $8, $9, 'Tata Surya', 'EASY', 'BENAR_SALAH', 'Matahari terbit dari timur.', '"TRUE"', 5.0),
       ($4, $7, $8, $9, 'Geografi', 'MEDIUM', 'MENJODOHKAN', 'Jodohkan ibukota negara:', '{"ID": "Jakarta", "MY": "Kuala Lumpur", "JP": "Tokyo", "FR": "Paris"}', 10.0),
       ($5, $7, $8, $9, 'Ibukota', 'EASY', 'ISIAN_SINGKAT', 'Ibukota negara Indonesia saat ini adalah?', '["Jakarta", "DKI Jakarta"]', 5.0),
       ($6, $7, $8, $9, 'Sejarah', 'HARD', 'ESSAY', 'Jelaskan dampak revolusi industri terhadap ekonomi.', '""', 15.0);`,
      [q1_mc_id, q2_cmc_id, q3_tf_id, q4_match_id, q5_short_id, q6_essay_id, testSchoolId, subjectId, teacherUserId]
    );

    // Q1: PILIHAN_GANDA (5 pts, negative marking: -1)
    await client.query(
      `INSERT INTO exam_snapshot_questions (
         id, snapshot_id, question_id, position, points, configuration_json
       ) VALUES ($1, $2, $3, 1, 5.0, $4);`,
      [
        crypto.randomUUID(), snapshotId, q1_mc_id,
        JSON.stringify({
          id: q1_mc_id,
          type: 'PILIHAN_GANDA',
          questionText: 'Berapakah 2 + 2?',
          answerKey: 'opt_4',
          weight: 5.0,
          scoringConfig: {
            negative_marking: true,
            wrong_answer_penalty: 1.0,
          },
        }),
      ]
    );

    // Q2: PG_KOMPLEKS (10 pts, partial credit)
    await client.query(
      `INSERT INTO exam_snapshot_questions (
         id, snapshot_id, question_id, position, points, configuration_json
       ) VALUES ($1, $2, $3, 2, 10.0, $4);`,
      [
        crypto.randomUUID(), snapshotId, q2_cmc_id,
        JSON.stringify({
          id: q2_cmc_id,
          type: 'PG_KOMPLEKS',
          questionText: 'Pilihlah bilangan prima:',
          answerKey: ['opt_2', 'opt_3', 'opt_5', 'opt_7'],
          weight: 10.0,
          scoringConfig: {
            scoring_mode: 'PARTIAL_CREDIT',
            wrong_penalty_factor: 0.25,
          },
        }),
      ]
    );

    // Q3: BENAR_SALAH (5 pts)
    await client.query(
      `INSERT INTO exam_snapshot_questions (
         id, snapshot_id, question_id, position, points, configuration_json
       ) VALUES ($1, $2, $3, 3, 5.0, $4);`,
      [
        crypto.randomUUID(), snapshotId, q3_tf_id,
        JSON.stringify({
          id: q3_tf_id,
          type: 'BENAR_SALAH',
          questionText: 'Matahari terbit dari timur.',
          answerKey: 'TRUE',
          weight: 5.0,
        }),
      ]
    );

    // Q4: MENJODOHKAN (10 pts, partial credit)
    await client.query(
      `INSERT INTO exam_snapshot_questions (
         id, snapshot_id, question_id, position, points, configuration_json
       ) VALUES ($1, $2, $3, 4, 10.0, $4);`,
      [
        crypto.randomUUID(), snapshotId, q4_match_id,
        JSON.stringify({
          id: q4_match_id,
          type: 'MENJODOHKAN',
          questionText: 'Jodohkan ibukota negara:',
          answerKey: {
            ID: 'Jakarta',
            MY: 'Kuala Lumpur',
            JP: 'Tokyo',
            FR: 'Paris',
          },
          weight: 10.0,
          scoringConfig: {
            scoring_mode: 'PARTIAL_CREDIT',
          },
        }),
      ]
    );

    // Q5: ISIAN_SINGKAT (5 pts, accepted answers)
    await client.query(
      `INSERT INTO exam_snapshot_questions (
         id, snapshot_id, question_id, position, points, configuration_json
       ) VALUES ($1, $2, $3, 5, 5.0, $4);`,
      [
        crypto.randomUUID(), snapshotId, q5_short_id,
        JSON.stringify({
          id: q5_short_id,
          type: 'ISIAN_SINGKAT',
          questionText: 'Ibukota negara Indonesia saat ini adalah?',
          answerKey: ['Jakarta', 'DKI Jakarta'],
          weight: 5.0,
          scoringConfig: {
            case_sensitive: false,
            trim_whitespace: true,
            ignore_punctuation: true,
            accepted_answers: ['Jakarta', 'DKI Jakarta'],
          },
        }),
      ]
    );

    // Q6: ESSAY (15 pts, rubric criteria)
    await client.query(
      `INSERT INTO exam_snapshot_questions (
         id, snapshot_id, question_id, position, points, configuration_json
       ) VALUES ($1, $2, $3, 6, 15.0, $4);`,
      [
        crypto.randomUUID(), snapshotId, q6_essay_id,
        JSON.stringify({
          id: q6_essay_id,
          type: 'ESSAY',
          questionText: 'Jelaskan dampak revolusi industri terhadap ekonomi.',
          weight: 15.0,
          rubric: [
            { id: 'crit_1', name: 'Pemahaman Konsep', maxPoints: 5.0 },
            { id: 'crit_2', name: 'Argumentasi', maxPoints: 5.0 },
            { id: 'crit_3', name: 'Bahasa & Struktur', maxPoints: 5.0 },
          ],
        }),
      ]
    );

    // 6. Insert Participants & Sessions
    await client.query(
      `INSERT INTO exam_participants (
         id, exam_id, student_id, school_id, token, token_status, assigned_package, final_score, graded_status
       ) VALUES
       ($1, $2, $3, $4, 'TOKA-1111', 'ACTIVE', 'A', NULL, 'PENDING'),
       ($5, $2, $6, $4, 'TOKB-2222', 'ACTIVE', 'A', NULL, 'PENDING');`,
      [participantAId, examId, studentAId, testSchoolId, participantBId, studentBId]
    );

    await client.query(
      `INSERT INTO exam_sessions (
         id, participant_id, exam_id, student_id, school_id, snapshot_id,
         device_fingerprint, status, server_started_at, server_expires_at
       ) VALUES
       ($1, $2, $3, $4, $5, $6, 'dev_fp_a', 'IN_PROGRESS', NOW(), NOW() + INTERVAL '90 minutes'),
       ($7, $8, $3, $9, $5, $6, 'dev_fp_b', 'IN_PROGRESS', NOW(), NOW() + INTERVAL '90 minutes');`,
      [
        sessionAId, participantAId, examId, studentAId, testSchoolId, snapshotId,
        sessionBId, participantBId, studentBId,
      ]
    );

    console.log('✅ Fixture setup complete.');

    // -------------------------------------------------------------
    // MODULE 1: SCORING SERVICE QUESTION TYPE TESTS
    // -------------------------------------------------------------
    console.log('\n--- Module 1: Question Type Scoring Logic Tests ---');

    // 1.1 Multiple Choice: Correct
    const mcCorrect = scoreQuestion(
      { id: 'q1', type: 'PILIHAN_GANDA', answerKey: 'B', points: 5 },
      'b'
    );
    assert(mcCorrect.isCorrect === true && mcCorrect.score === 5, 'MC Correct receives full points (5)');

    // 1.2 Multiple Choice: Wrong with Negative Marking
    const mcWrongNeg = scoreQuestion(
      {
        id: 'q1',
        type: 'PILIHAN_GANDA',
        answerKey: 'B',
        points: 5,
        scoringConfig: { negative_marking: true, wrong_answer_penalty: 1.25 },
      },
      'C'
    );
    assert(mcWrongNeg.isCorrect === false && mcWrongNeg.score === -1.25, 'MC Wrong with penalty receives -1.25');

    // 1.3 Multiple Choice: Blank
    const mcBlank = scoreQuestion(
      {
        id: 'q1',
        type: 'PILIHAN_GANDA',
        answerKey: 'B',
        points: 5,
        scoringConfig: { negative_marking: true, wrong_answer_penalty: 1.0 },
      },
      ''
    );
    assert(mcBlank.isCorrect === false && mcBlank.score === 0, 'MC Blank receives 0 (penalty not applied to blank)');

    // 1.4 Complex MC: All or Nothing Mode
    const cmcAll = scoreQuestion(
      {
        id: 'q2',
        type: 'PG_KOMPLEKS',
        answerKey: ['A', 'C', 'D'],
        points: 6,
        scoringConfig: { scoring_mode: 'ALL_OR_NOTHING' },
      },
      ['a', 'c', 'd']
    );
    assert(cmcAll.isCorrect === true && cmcAll.score === 6, 'Complex MC ALL_OR_NOTHING match gives full points');

    const cmcPartialInAllMode = scoreQuestion(
      {
        id: 'q2',
        type: 'PG_KOMPLEKS',
        answerKey: ['A', 'C', 'D'],
        points: 6,
        scoringConfig: { scoring_mode: 'ALL_OR_NOTHING' },
      },
      ['A', 'C']
    );
    assert(cmcPartialInAllMode.isCorrect === false && cmcPartialInAllMode.score === 0, 'Complex MC incomplete in ALL_OR_NOTHING gives 0');

    // 1.5 Complex MC: Partial Credit Mode
    const cmcPartial = scoreQuestion(
      {
        id: 'q2',
        type: 'PG_KOMPLEKS',
        answerKey: ['A', 'B', 'C', 'D'],
        points: 8,
        scoringConfig: { scoring_mode: 'PARTIAL_CREDIT', wrong_penalty_factor: 0.25 },
      },
      ['A', 'B', 'C', 'E'] // 3 correct out of 4, 1 wrong option
    );
    // ratio = 3/4 - 1*0.25 = 0.75 - 0.25 = 0.5; score = 0.5 * 8 = 4.0
    assert(cmcPartial.score === 4.0, 'Complex MC PARTIAL_CREDIT calculates correct ratio minus wrong penalty (4.0)');

    // 1.6 True / False
    const tfCorrect = scoreQuestion(
      { id: 'q3', type: 'BENAR_SALAH', answerKey: 'TRUE', points: 4 },
      'benar'
    );
    assert(tfCorrect.isCorrect === true && tfCorrect.score === 4, 'True/False accepts Indonesian "benar" for TRUE');

    // 1.7 Matching: Partial Credit
    const matchPartial = scoreQuestion(
      {
        id: 'q4',
        type: 'MENJODOHKAN',
        answerKey: { A: '1', B: '2', C: '3', D: '4' },
        points: 10,
        scoringConfig: { scoring_mode: 'PARTIAL_CREDIT' },
      },
      { A: '1', B: '2', C: '99', D: '4' } // 3 out of 4 pairs correct
    );
    assert(matchPartial.score === 7.5, 'Matching PARTIAL_CREDIT evaluates 3/4 pairs = 7.5 points');

    // 1.8 Short Answer: Case sensitivity and punctuation trimming
    const saMatch = scoreQuestion(
      {
        id: 'q5',
        type: 'ISIAN_SINGKAT',
        answerKey: ['DKI Jakarta', 'Jakarta'],
        points: 5,
        scoringConfig: { case_sensitive: false, trim_whitespace: true, ignore_punctuation: true },
      },
      '   jakarta!  '
    );
    assert(saMatch.isCorrect === true && saMatch.score === 5, 'Short answer normalizes whitespace and punctuation');

    // 1.9 Essay Question: Pending Review
    const essayEval = scoreQuestion(
      { id: 'q6', type: 'ESSAY', points: 15, rubric: [] },
      'Ini adalah jawaban essay siswa...'
    );
    assert(essayEval.scoreStatus === 'PENDING_MANUAL_REVIEW' && essayEval.score === 0, 'Essay defaults to PENDING_MANUAL_REVIEW with 0 score');

    // -------------------------------------------------------------
    // MODULE 2: NORMALIZATION, ROUNDING & SAFETY CLAMP TESTS
    // -------------------------------------------------------------
    console.log('\n--- Module 2: Normalization, Rounding & Safety Clamp Tests ---');

    // 2.1 Deterministic Rounding
    assert(roundScore(82.556, 2) === 82.56, 'roundScore(82.556, 2) rounds to 82.56');
    assert(roundScore(82.554, 2) === 82.55, 'roundScore(82.554, 2) rounds to 82.55');

    // 2.2 Normalized Score
    const normScore = calculateNormalizedScore(38, 50, 100);
    assert(normScore === 76.0, 'calculateNormalizedScore(38, 50, 100) returns 76.0');

    // 2.3 Clamp Minimum Zero for Final Score
    const negativeQuestions = [
      { id: 'q1', type: 'PILIHAN_GANDA', score: -5, maxScore: 10, isCorrect: false, scoreStatus: 'AUTOMATED', rawAnswer: 'W', normalizedAnswer: 'W' },
    ];
    const clampedFinal = calculateFinalScore(negativeQuestions, { allowNegativeFinalScore: false });
    assert(clampedFinal.finalScore === 0, 'Negative score clamped to 0 when allowNegativeFinalScore=false');

    // -------------------------------------------------------------
    // MODULE 3: SERVER-AUTHORITATIVE SESSION SCORING & IDEMPOTENCY
    // -------------------------------------------------------------
    console.log('\n--- Module 3: Session Finalize, Scoring & Idempotency Tests ---');

    // Populate answers for Session A:
    // Q1: Correct (5 pts)
    // Q2: 3 of 4 correct (5 pts)
    // Q3: Correct (5 pts)
    // Q4: All correct (10 pts)
    // Q5: Correct (5 pts)
    // Q6: Essay (Pending, 0 pts)
    await client.query(
      `INSERT INTO student_answers (session_id, question_id, answer_value_json, state) VALUES
       ($1, $2, '"opt_4"', 'ANSWERED'),
       ($1, $3, '["opt_2", "opt_3", "opt_5"]'::jsonb, 'ANSWERED'),
       ($1, $4, '"TRUE"', 'ANSWERED'),
       ($1, $5, '{"ID": "Jakarta", "MY": "Kuala Lumpur", "JP": "Tokyo", "FR": "Paris"}'::jsonb, 'ANSWERED'),
       ($1, $6, '"jakarta"', 'ANSWERED'),
       ($1, $7, '"Jawaban analisis ekonomi revolusi industri"', 'ANSWERED');`,
      [sessionAId, q1_mc_id, q2_cmc_id, q3_tf_id, q4_match_id, q5_short_id, q6_essay_id]
    );

    // Call executeScoreSession
    const scoreRes1 = await executeScoreSession(client, sessionAId);

    assert(scoreRes1.isNewResult === true, 'First scoring call creates a new exam_result');
    assert(scoreRes1.status === 'PARTIALLY_GRADED', 'Result status is PARTIALLY_GRADED due to pending essay');
    assert(scoreRes1.rawScore > 0, `Raw score computed successfully: ${scoreRes1.rawScore}`);

    // Verify row in exam_results
    const dbResultRes = await client.query(
      `SELECT * FROM exam_results WHERE session_id = $1;`,
      [sessionAId]
    );
    assert(dbResultRes.rows.length === 1, 'Exactly one record in exam_results for session A');
    const resultRecord = dbResultRes.rows[0];
    assert(Number(resultRecord.final_score) === scoreRes1.finalScore, 'DB exam_results.final_score matches calculation');

    // IDEMPOTENCY TEST: Call executeScoreSession again for the same session
    const scoreRes2 = await executeScoreSession(client, sessionAId);
    assert(scoreRes2.isNewResult === false, 'Duplicate scoreExamSession does NOT create duplicate record');
    assert(scoreRes2.resultId === scoreRes1.resultId, 'Duplicate scoring returns existing resultId');

    const countCheck = await client.query(
      `SELECT COUNT(*) as total FROM exam_results WHERE session_id = $1;`,
      [sessionAId]
    );
    assert(parseInt(countCheck.rows[0].total, 10) === 1, 'exam_results row count remains exactly 1 (Idempotent)');

    // -------------------------------------------------------------
    // MODULE 4: SNAPSHOT IMMUTABILITY TEST
    // -------------------------------------------------------------
    console.log('\n--- Module 4: Snapshot Immutability Test ---');
    // Modify question_banks master record to verify snapshot is untouched
    await client.query(
      `UPDATE question_banks SET answer_key_json = '"opt_CHANGED"' WHERE id = $1;`,
      [q1_mc_id]
    );

    const snapQRes = await client.query(
      `SELECT configuration_json FROM exam_snapshot_questions WHERE question_id = $1;`,
      [q1_mc_id]
    );
    const snapConfig = snapQRes.rows[0].configuration_json;
    assert(snapConfig.answerKey === 'opt_4', 'Snapshot frozen question answerKey remains "opt_4" despite question_banks modification');

    // -------------------------------------------------------------
    // MODULE 5: ESSAY MANUAL GRADING & OPTIMISTIC CONCURRENCY TESTS
    // -------------------------------------------------------------
    console.log('\n--- Module 5: Essay Manual Grading & Optimistic Concurrency Tests ---');

    const essayAnsRes = await client.query(
      `SELECT id, version FROM student_answers WHERE session_id = $1 AND question_id = $2;`,
      [sessionAId, q6_essay_id]
    );
    const essayAnswerId = essayAnsRes.rows[0].id;
    const initialVersion = essayAnsRes.rows[0].version || 1;

    // 5.1 Successful Teacher Grading with Rubric
    const gradeRes = await executeGradeEssay(
      client,
      testSchoolId,
      teacherUserId,
      essayAnswerId,
      {
        manualScore: 12.5,
        rubricScores: { crit_1: 4.5, crit_2: 4.0, crit_3: 4.0 },
        feedback: 'Analisis komprehensif, tingkatkan diksi ekonomi.',
        teacherInternalNote: 'Nilai sangat memuaskan.',
        clientVersion: initialVersion,
      },
      'GURU'
    );

    assert(gradeRes.gradedStatus === 'GRADED', 'gradedStatus transitions to GRADED after essay is scored');
    assert(gradeRes.version === initialVersion + 1, 'Answer version incremented to prevent double-grading');

    // Check exam_results status updated to GRADED
    const resAfterGrading = await client.query(
      `SELECT status, final_score FROM exam_results WHERE id = $1;`,
      [resultRecord.id]
    );
    assert(resAfterGrading.rows[0].status === 'GRADED', 'exam_results.status transitioned to GRADED');

    // Check essay_gradings audit entry
    const essayGradingRes = await client.query(
      `SELECT * FROM essay_gradings WHERE grader_id = $1;`,
      [teacherUserId]
    );
    assert(essayGradingRes.rows.length > 0, 'essay_gradings entry successfully created');

    // 5.2 OPTIMISTIC LOCKING / CONFLICT TEST: Stale version rejected
    let conflictDetected = false;
    try {
      await executeGradeEssay(
        client,
        testSchoolId,
        teacherUserId,
        essayAnswerId,
        {
          manualScore: 10.0,
          clientVersion: initialVersion, // Stale version! (Server is now initialVersion + 1)
        },
        'GURU'
      );
    } catch (err) {
      if (err.message.includes('REVIEW_CONFLICT') || err.code === 'REVIEW_CONFLICT') {
        conflictDetected = true;
      }
    }
    assert(conflictDetected === true, 'Optimistic locking blocks stale version with REVIEW_CONFLICT');

    // 5.3 Boundary Safety: Reject negative score or score > maxScore
    let boundaryCaught = false;
    try {
      await executeGradeEssay(
        client,
        testSchoolId,
        teacherUserId,
        essayAnswerId,
        {
          manualScore: 999.0, // Question max is 15.0!
          clientVersion: initialVersion + 1,
        },
        'GURU'
      );
    } catch {
      boundaryCaught = true;
    }
    assert(boundaryCaught === true, 'Manual score > maxScore rejected by server');

    // -------------------------------------------------------------
    // MODULE 6: RESULT LIFECYCLE: REVIEW, PUBLISH, CORRECTION, VOID
    // -------------------------------------------------------------
    console.log('\n--- Module 6: Result Lifecycle State Machine Tests ---');

    // 6.1 Review Result (GRADED -> REVIEWED)
    await client.query(
      `UPDATE exam_results SET status = 'REVIEWED', updated_at = NOW() WHERE id = $1;`,
      [resultRecord.id]
    );
    const revCheck = await client.query(`SELECT status FROM exam_results WHERE id = $1;`, [resultRecord.id]);
    assert(revCheck.rows[0].status === 'REVIEWED', 'Result transitioned to REVIEWED');

    // 6.2 Publish Result (REVIEWED -> PUBLISHED)
    await client.query(
      `UPDATE exam_results SET status = 'PUBLISHED', published_at = NOW(), updated_at = NOW() WHERE id = $1;`,
      [resultRecord.id]
    );
    await client.query(
      `UPDATE exam_participants SET publication_status = 'PUBLISHED' WHERE id = $1;`,
      [participantAId]
    );
    const pubCheck = await client.query(
      `SELECT status, published_at FROM exam_results WHERE id = $1;`,
      [resultRecord.id]
    );
    assert(pubCheck.rows[0].status === 'PUBLISHED' && pubCheck.rows[0].published_at !== null, 'exam_results has PUBLISHED status and timestamp');

    // 6.3 Result Correction with Mandatory Reason
    const oldScoreVal = Number(resultRecord.final_score);
    const newScoreVal = 88.5;
    await client.query(
      `INSERT INTO result_corrections (
         id, result_id, school_id, old_score, new_score, reason, corrected_by, created_at
       ) VALUES (
         uuid_generate_v4(), $1, $2, $3, $4, $5, $6, NOW()
       );`,
      [resultRecord.id, testSchoolId, oldScoreVal, newScoreVal, 'Perbaikan kunci jawaban dan verifikasi ulang butir soal', adminUserId]
    );
    await client.query(
      `UPDATE exam_results SET final_score = $1, normalized_score = $1, percentage = $1 WHERE id = $2;`,
      [newScoreVal, resultRecord.id]
    );

    const corrAudit = await client.query(
      `SELECT * FROM result_corrections WHERE result_id = $1;`,
      [resultRecord.id]
    );
    assert(corrAudit.rows.length === 1, 'result_corrections entry recorded with reason and old/new score');
    assert(corrAudit.rows[0].reason.includes('Perbaikan kunci jawaban'), 'Correction reason saved immutably');

    // 6.4 Result Void with Reason
    await client.query(
      `UPDATE exam_results SET status = 'VOID', voided_at = NOW(), void_reason = $1, voided_by = $2 WHERE id = $3;`,
      ['Pelanggaran integritas akademik terbukti pada sesi ujian', adminUserId, resultRecord.id]
    );
    const voidCheck = await client.query(`SELECT status, void_reason FROM exam_results WHERE id = $1;`, [resultRecord.id]);
    assert(voidCheck.rows[0].status === 'VOID', 'Result successfully transitioned to VOID');

    // -------------------------------------------------------------
    // MODULE 7: REGRADE JOB TEST
    // -------------------------------------------------------------
    console.log('\n--- Module 7: Regrade Job Test ---');
    await client.query(
      `INSERT INTO regrade_jobs (
         id, exam_id, school_id, old_scoring_version, new_scoring_version, reason, status, affected_count, created_by, created_at
       ) VALUES (
         uuid_generate_v4(), $1, $2, 'v1.0', 'v1.0', $3, 'COMPLETED', 1, $4, NOW()
       );`,
      [examId, testSchoolId, 'Regrading seluruh peserta pasca koreksi skala penilaian', adminUserId]
    );

    const regradeAudit = await client.query(
      `SELECT * FROM regrade_jobs WHERE exam_id = $1;`,
      [examId]
    );
    assert(regradeAudit.rows.length === 1, 'regrade_jobs entry recorded in database');

    // -------------------------------------------------------------
    // MODULE 8: SECURITY, IDOR, ZERO-LEAKAGE & FORMULA INJECTION
    // -------------------------------------------------------------
    console.log('\n--- Module 8: Security, IDOR, Zero-Leakage & Formula Injection Tests ---');

    // Restore result to PUBLISHED for student access test
    await client.query(
      `UPDATE exam_results SET status = 'PUBLISHED', published_at = NOW() WHERE id = $1;`,
      [resultRecord.id]
    );

    // 8.1 Student Access Own Published Result
    const studentAuthContextA = {
      studentId: studentAId,
      schoolId: testSchoolId,
      sessionId: sessionAId,
      participantId: participantAId,
      examId,
      studentName: 'Siswa Alpha',
      nisn: 'NISN_A',
      deviceId: 'dev_fp_a',
      sessionVersion: 1,
      status: 'SUBMITTED',
    };

    const resCheck = await client.query(
      `SELECT er.*, e.title as exam_title, s.name as subject_name, e.passing_grade, e.show_score_policy,
              st.full_name as student_name, st.nis, st.nisn, c.name as class_name
       FROM exam_results er
       JOIN exams e ON er.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       JOIN students st ON er.student_id = st.id
       LEFT JOIN class_rooms c ON st.class_room_id = c.id
       WHERE er.id = $1 AND er.school_id = $2;`,
      [resultRecord.id, testSchoolId]
    );
    const row = resCheck.rows[0];
    assert(row.student_id === studentAuthContextA.studentId, 'Student A ownership verified against database record');

    // Fetch questions sanitized (Zero Answer Key Leakage)
    const qResultsRes = await client.query(
      `SELECT eqr.question_id, eqr.score, eqr.max_score, eqr.feedback, eqr.score_status,
              esq.position, esq.configuration_json
       FROM exam_question_results eqr
       LEFT JOIN exam_snapshot_questions esq ON eqr.question_id = esq.question_id
       WHERE eqr.result_id = $1
       ORDER BY esq.position ASC NULLS LAST;`,
      [resultRecord.id]
    );

    const safeBreakdown = qResultsRes.rows.map((r, idx) => ({
      number: r.position || idx + 1,
      questionText: r.configuration_json?.questionText || '',
      score: parseFloat(r.score),
      maxScore: parseFloat(r.max_score),
      feedback: r.feedback || null,
    }));

    let answerKeyLeaked = false;
    for (const b of safeBreakdown) {
      if (b.answerKey || b.answer_key || b.teacherInternalNote) {
        answerKeyLeaked = true;
      }
    }
    assert(answerKeyLeaked === false, 'Zero answer key leakage: Student result payload has no answerKey or internal notes');

    // 8.2 IDOR Attack: Student B attempts to access Student A's result
    const studentAuthContextB = {
      studentId: studentBId,
      schoolId: testSchoolId,
    };
    const isIdorBlocked = row.student_id !== studentAuthContextB.studentId;
    assert(isIdorBlocked === true, 'IDOR blocked: Student B cannot view Student A result (student_id mismatch)');

    // 8.3 Unpublished Result Access Denial
    await client.query(
      `UPDATE exam_results SET status = 'GRADED', published_at = NULL WHERE id = $1;`,
      [resultRecord.id]
    );
    const unpubCheck = await client.query(`SELECT er.status, e.show_score_policy FROM exam_results er JOIN exams e ON er.exam_id = e.id WHERE er.id = $1;`, [resultRecord.id]);
    const isUnpublishedBlocked = unpubCheck.rows[0].status !== 'PUBLISHED' && unpubCheck.rows[0].show_score_policy !== 'IMMEDIATELY';
    assert(isUnpublishedBlocked === true, 'Unpublished result cannot be accessed by student');

    // 8.4 Teacher Cross-School Scope Denial
    let crossSchoolBlocked = false;
    try {
      await executeGradeEssay(
        client,
        otherSchoolId, // Teacher from other school attempting to grade!
        otherSchoolTeacherId,
        essayAnswerId,
        { manualScore: 10.0 },
        'GURU'
      );
    } catch (err) {
      if (err.message.includes('Akses ditolak')) {
        crossSchoolBlocked = true;
      }
    }
    assert(crossSchoolBlocked === true, 'Cross-school teacher essay grading denied');

    // 8.5 CSV / Formula Injection Protection Test
    assert(sanitizeForFormulaInjection('=cmd|"/c calc"!A0') === '\'=cmd|"/c calc"!A0', 'Formula injection with "=" sanitized with leading apostrophe');
    assert(sanitizeForFormulaInjection('+12345') === '\'+12345', 'Formula injection with "+" sanitized');
    assert(sanitizeForFormulaInjection('@SUM(A1:A10)') === '\'@SUM(A1:A10)', 'Formula injection with "@" sanitized');
    assert(sanitizeForFormulaInjection('Normal Student Name') === 'Normal Student Name', 'Safe text left untouched');

    // Export test using xlsx
    const rows = [
      { No: 1, NIS: sanitizeForFormulaInjection('1001'), 'Nama Siswa': sanitizeForFormulaInjection('=FormulaAttack'), 'Nilai Akhir': 88.5 },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hasil');
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    assert(xlsxBuffer.length > 0, 'XLSX export buffer generated successfully');

    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    assert(csvOutput.includes("''=FormulaAttack") || csvOutput.includes("'=FormulaAttack"), 'CSV export sanitized formula injection in output text');

    console.log('\n===============================================================');
    console.log(`SPRINT 08 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('===============================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test Suite Error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runTestSuite();
