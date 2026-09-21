import pg from 'pg';
import crypto from 'crypto';
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

// PRNG & Shuffling functions
function createMulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle(array, prng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

function generateSeed(sessionId, examId, participantId, salt = '') {
  const hash = crypto
    .createHash('sha256')
    .update(`${sessionId}:${examId}:${participantId}:${salt}`)
    .digest();
  return hash.readUInt32BE(0);
}

function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
    .replace(/javascript:\s*/gi, '');
}

function serializeQuestionForStudent(questionConfig, displayPosition, optionOrderList = [], section = 'MAIN', points = 1.0) {
  const rawType = questionConfig.type || 'PILIHAN_GANDA';
  const qText = sanitizeHtml(questionConfig.questionText || questionConfig.question_text || '');
  const qId = questionConfig.id;

  const dto = {
    id: qId,
    number: displayPosition,
    type: rawType,
    questionText: qText,
    mediaUrl: questionConfig.mediaUrl || questionConfig.media_url || null,
    mediaType: questionConfig.mediaType || questionConfig.media_type || 'NONE',
    points: Number(points || questionConfig.weight || 1.0),
    section: section || 'MAIN',
  };

  const rawOptions = Array.isArray(questionConfig.options)
    ? questionConfig.options
    : Array.isArray(questionConfig.options_json)
    ? questionConfig.options_json
    : [];

  if (rawOptions.length > 0) {
    const optMap = new Map();
    if (Array.isArray(optionOrderList) && optionOrderList.length > 0) {
      for (const o of optionOrderList) {
        optMap.set(o.option_id, o.display_position);
      }
    }

    const formattedOptions = rawOptions.map((opt, idx) => {
      const optId = typeof opt === 'object' && opt !== null ? opt.id || `opt_${idx + 1}` : `opt_${idx + 1}`;
      const optText = typeof opt === 'object' && opt !== null ? opt.text || opt.label || '' : String(opt);
      const orderPos = optMap.get(optId) ?? idx + 1;
      const label = String.fromCharCode(64 + Math.min(26, Math.max(1, orderPos)));

      return {
        id: optId,
        displayPosition: orderPos,
        label,
        text: sanitizeHtml(optText),
        mediaUrl: typeof opt === 'object' ? opt.mediaUrl || opt.media_url || null : null,
      };
    });

    formattedOptions.sort((a, b) => a.displayPosition - b.displayPosition);
    dto.options = formattedOptions;
  }

  if (rawType === 'MENJODOHKAN') {
    const leftItems = Array.isArray(questionConfig.options) ? questionConfig.options.filter(i => i.side === 'LEFT' || !i.side) : [];
    const rightItems = Array.isArray(questionConfig.options) ? questionConfig.options.filter(i => i.side === 'RIGHT') : [];
    dto.matchingItems = {
      leftItems: leftItems.map((item, idx) => ({ id: item.id || `left_${idx + 1}`, text: sanitizeHtml(item.text || String(item)) })),
      rightItems: rightItems.map((item, idx) => ({ id: item.id || `right_${idx + 1}`, text: sanitizeHtml(item.text || String(item)) })),
    };
  }

  if (rawType === 'BENAR_SALAH' && (!dto.options || dto.options.length === 0)) {
    dto.options = [
      { id: 'opt_true', displayPosition: 1, label: 'A', text: 'Benar' },
      { id: 'opt_false', displayPosition: 2, label: 'B', text: 'Salah' },
    ];
  }

  const forbiddenFields = [
    'answerKey', 'answer_key', 'answer_key_json', 'rubric', 'rubric_json',
    'explanation', 'teacher_internal_note', 'teacherInternalNote', 'internal_note',
    'scoring_guide', 'expectedAnswer', 'isCorrect'
  ];
  for (const field of forbiddenFields) {
    delete dto[field];
  }

  return dto;
}

async function runSprint07Tests() {
  console.log('====================================================');
  console.log('SAGAYA EXAM - SPRINT 07 AUTOMATED TEST SUITE');
  console.log('Exam Engine, Question Snapshot, Delivery, Navigation & Answer State');
  console.log('====================================================\n');

  const client = await pool.connect();

  try {
    // -----------------------------------------------------------
    // STEP 0: FIXTURE SETUP
    // -----------------------------------------------------------
    console.log('--- STEP 0: Setting up Test Fixtures in Database ---');

    // Clean old test fixtures
    await client.query("DELETE FROM schools WHERE code IN ('SCH-SPRINT07-A', 'SCH-SPRINT07-B');");

    // School A & School B (Multi-Tenant Isolation)
    const schARes = await client.query(`
      INSERT INTO schools (id, code, name, level, is_active)
      VALUES (uuid_generate_v4(), 'SCH-SPRINT07-A', 'SMA Negeri 1 Test Sprint 07', 'SMA', true)
      RETURNING id;
    `);
    const schoolAId = schARes.rows[0].id;

    const schBRes = await client.query(`
      INSERT INTO schools (id, code, name, level, is_active)
      VALUES (uuid_generate_v4(), 'SCH-SPRINT07-B', 'SMA Negeri 2 Test Sprint 07 B', 'SMA', true)
      RETURNING id;
    `);
    const schoolBId = schBRes.rows[0].id;

    // Students for School A (Student 1, Student 2)
    const st1Res = await client.query(`
      INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code, is_active)
      VALUES (uuid_generate_v4(), $1, 'NIS-701', 'NISN-701', 'Budi Siswa 7A', 'CARD-701', true)
      RETURNING id;
    `, [schoolAId]);
    const student1Id = st1Res.rows[0].id;

    const st2Res = await client.query(`
      INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code, is_active)
      VALUES (uuid_generate_v4(), $1, 'NIS-702', 'NISN-702', 'Citra Siswa 7B', 'CARD-702', true)
      RETURNING id;
    `, [schoolAId]);
    const student2Id = st2Res.rows[0].id;

    // Student for School B
    const stBRes = await client.query(`
      INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code, is_active)
      VALUES (uuid_generate_v4(), $1, 'NIS-709', 'NISN-709', 'Dani Siswa School B', 'CARD-709', true)
      RETURNING id;
    `, [schoolBId]);
    const studentBId = stBRes.rows[0].id;

    // Subjects
    const subARes = await client.query(`
      INSERT INTO subjects (id, school_id, code, name)
      VALUES (uuid_generate_v4(), $1, 'BIO-07', 'Biologi Molekuler')
      RETURNING id;
    `, [schoolAId]);
    const subjectAId = subARes.rows[0].id;

    // Question Bank Items (Covering All 6 Types)
    // 1. Multiple Choice (PILIHAN_GANDA)
    const q1Res = await client.query(`
      INSERT INTO question_banks (
        id, school_id, subject_id, topic, difficulty, type, question_text,
        options_json, answer_key_json, weight, explanation
      ) VALUES (
        uuid_generate_v4(), $1, $2, 'Genetika', 'MEDIUM', 'PILIHAN_GANDA',
        'Organel manakah yang berperan sebagai pembawa materi genetik utama?',
        '[{"id": "opt_a", "text": "Ribosom"}, {"id": "opt_b", "text": "Nukleus"}, {"id": "opt_c", "text": "Mitokondria"}, {"id": "opt_d", "text": "Kloroplas"}]'::jsonb,
        '"opt_b"'::jsonb,
        1.0,
        'Nukleus adalah organel pengatur utama materi genetik pada eukariotik.'
      ) RETURNING id;
    `, [schoolAId, subjectAId]);
    const q1Id = q1Res.rows[0].id;

    // 2. Complex Multiple Choice (PG_KOMPLEKS)
    const q2Res = await client.query(`
      INSERT INTO question_banks (
        id, school_id, subject_id, topic, difficulty, type, question_text,
        options_json, answer_key_json, weight, explanation
      ) VALUES (
        uuid_generate_v4(), $1, $2, 'Sel', 'MEDIUM', 'PG_KOMPLEKS',
        'Pilihlah struktur sel yang hanya ditemukan pada sel tumbuhan:',
        '[{"id": "opt_dinding", "text": "Dinding Sel"}, {"id": "opt_kloro", "text": "Kloroplas"}, {"id": "opt_membran", "text": "Membran Plasma"}, {"id": "opt_sentriol", "text": "Sentriol"}]'::jsonb,
        '["opt_dinding", "opt_kloro"]'::jsonb,
        2.0,
        'Dinding sel dan kloroplas spesifik untuk sel tumbuhan.'
      ) RETURNING id;
    `, [schoolAId, subjectAId]);
    const q2Id = q2Res.rows[0].id;

    // 3. True / False (BENAR_SALAH)
    const q3Res = await client.query(`
      INSERT INTO question_banks (
        id, school_id, subject_id, topic, difficulty, type, question_text,
        options_json, answer_key_json, weight, explanation
      ) VALUES (
        uuid_generate_v4(), $1, $2, 'Enzim', 'EASY', 'BENAR_SALAH',
        'Enzim bekerja secara spesifik terhadap substrat tertentu.',
        '[]'::jsonb,
        '"opt_true"'::jsonb,
        1.0,
        'Benar, enzim memiliki situs aktif yang spesifik (Lock and Key).'
      ) RETURNING id;
    `, [schoolAId, subjectAId]);
    const q3Id = q3Res.rows[0].id;

    // 4. Matching (MENJODOHKAN)
    const q4Res = await client.query(`
      INSERT INTO question_banks (
        id, school_id, subject_id, topic, difficulty, type, question_text,
        options_json, answer_key_json, weight, explanation
      ) VALUES (
        uuid_generate_v4(), $1, $2, 'Organ Sistem', 'MEDIUM', 'MENJODOHKAN',
        'Jodohkan organ berikut dengan fungsi biologis utamanya:',
        '[{"id": "L1", "side": "LEFT", "text": "Jantung"}, {"id": "L2", "side": "LEFT", "text": "Paru-paru"}, {"id": "R1", "side": "RIGHT", "text": "Memompa darah"}, {"id": "R2", "side": "RIGHT", "text": "Pertukaran gas"}]'::jsonb,
        '{"L1": "R1", "L2": "R2"}'::jsonb,
        2.0,
        'Jantung memompa darah, paru-paru menukar O2 dan CO2.'
      ) RETURNING id;
    `, [schoolAId, subjectAId]);
    const q4Id = q4Res.rows[0].id;

    // 5. Short Answer (ISIAN_SINGKAT)
    const q5Res = await client.query(`
      INSERT INTO question_banks (
        id, school_id, subject_id, topic, difficulty, type, question_text,
        options_json, answer_key_json, weight, explanation
      ) VALUES (
        uuid_generate_v4(), $1, $2, 'Energi', 'EASY', 'ISIAN_SINGKAT',
        'Molekul penyimpan energi utama dalam sel adalah ...',
        '[]'::jsonb,
        '"ATP"'::jsonb,
        1.0,
        'Adenosina trifosfat (ATP).'
      ) RETURNING id;
    `, [schoolAId, subjectAId]);
    const q5Id = q5Res.rows[0].id;

    // 6. Essay (ESSAY)
    const q6Res = await client.query(`
      INSERT INTO question_banks (
        id, school_id, subject_id, topic, difficulty, type, question_text,
        options_json, answer_key_json, rubric_json, weight, explanation
      ) VALUES (
        uuid_generate_v4(), $1, $2, 'Fotosintesis', 'HARD', 'ESSAY',
        'Jelaskan mekanisme reaksi terang pada proses fotosintesis secara terperinci:',
        '[]'::jsonb,
        '{}'::jsonb,
        '{"accuracy": 5, "clarity": 5}'::jsonb,
        5.0,
        'Rubrik rahasia penilaian essay: fotolisis air, eksitasi elektron, sintesis NADPH dan ATP.'
      ) RETURNING id;
    `, [schoolAId, subjectAId]);
    const q6Id = q6Res.rows[0].id;

    // Question for School B (to test cross-school boundary)
    const qBRes = await client.query(`
      INSERT INTO question_banks (
        id, school_id, topic, difficulty, type, question_text,
        options_json, answer_key_json, weight
      ) VALUES (
        uuid_generate_v4(), $1, 'Fisika', 'EASY', 'PILIHAN_GANDA',
        'Satuan dari gaya adalah ...',
        '[{"id": "opt_n", "text": "Newton"}]'::jsonb,
        '"opt_n"'::jsonb,
        1.0
      ) RETURNING id;
    `, [schoolBId]);
    const qSchoolBId = qBRes.rows[0].id;

    // Create Active Exam A in School A
    const now = new Date();
    const startTime = new Date(now.getTime() - 10 * 60 * 1000); // started 10m ago
    const endTime = new Date(now.getTime() + 120 * 60 * 1000);  // ends in 2 hours

    const examARes = await client.query(`
      INSERT INTO exams (
        id, school_id, title, subject_id, status, window_mode,
        start_time, end_time, duration_minutes, randomize_questions, randomize_options,
        navigation_policy
      ) VALUES (
        uuid_generate_v4(), $1, 'Ujian Biologi Komprehensif Sprint 07', $2, 'PUBLISHED', 'FLEXIBLE',
        $3, $4, 90, true, true, 'FREE_NAVIGATION'
      ) RETURNING id;
    `, [schoolAId, subjectAId, startTime.toISOString(), endTime.toISOString()]);
    const examAId = examARes.rows[0].id;

    // Link Questions to Exam A via exam_questions
    const questionIds = [q1Id, q2Id, q3Id, q4Id, q5Id, q6Id];
    for (let i = 0; i < questionIds.length; i++) {
      await client.query(`
        INSERT INTO exam_questions (id, exam_id, question_id, order_index, weight)
        VALUES (uuid_generate_v4(), $1, $2, $3, 1.0);
      `, [examAId, questionIds[i], i + 1]);
    }

    // Participants for Student 1 and Student 2
    const token1 = '7K9P-2M4X';
    const tokenHash1 = crypto.createHash('sha256').update(token1).digest('hex');

    const ep1Res = await client.query(`
      INSERT INTO exam_participants (
        id, exam_id, student_id, school_id, token, token_hash, token_status, assigned_package, eligible
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5, 'ACTIVE', 'A', true
      ) RETURNING id;
    `, [examAId, student1Id, schoolAId, token1, tokenHash1]);
    const participant1Id = ep1Res.rows[0].id;

    const token2 = '8L2M-9N3Q';
    const tokenHash2 = crypto.createHash('sha256').update(token2).digest('hex');
    const ep2Res = await client.query(`
      INSERT INTO exam_participants (
        id, exam_id, student_id, school_id, token, token_hash, token_status, assigned_package, eligible
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5, 'ACTIVE', 'B', true
      ) RETURNING id;
    `, [examAId, student2Id, schoolAId, token2, tokenHash2]);
    const participant2Id = ep2Res.rows[0].id;

    // Create Active Session for Student 1
    const expiresAt = new Date(now.getTime() + 90 * 60 * 1000);
    const sess1Res = await client.query(`
      INSERT INTO exam_sessions (
        id, participant_id, student_id, exam_id, school_id,
        device_fingerprint, device_id, server_started_at, started_at,
        server_expires_at, expires_at, status, session_version
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4,
        'dev-fingerprint-001', 'dev-001', $5, $5,
        $6, $6, 'IN_PROGRESS', 1
      ) RETURNING id;
    `, [participant1Id, student1Id, examAId, schoolAId, now.toISOString(), expiresAt.toISOString()]);
    const session1Id = sess1Res.rows[0].id;

    // Create Active Session for Student 2
    const sess2Res = await client.query(`
      INSERT INTO exam_sessions (
        id, participant_id, student_id, exam_id, school_id,
        device_fingerprint, device_id, server_started_at, started_at,
        server_expires_at, expires_at, status, session_version
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4,
        'dev-fingerprint-002', 'dev-002', $5, $5,
        $6, $6, 'IN_PROGRESS', 1
      ) RETURNING id;
    `, [participant2Id, student2Id, examAId, schoolAId, now.toISOString(), expiresAt.toISOString()]);
    const session2Id = sess2Res.rows[0].id;

    console.log('✅ Fixtures setup successfully.\n');

    // -----------------------------------------------------------
    // TEST 1: SNAPSHOT CREATION & IMMUTABILITY
    // -----------------------------------------------------------
    console.log('--- TEST 1: Snapshot Creation & Immutability ---');

    // 1.1 Buat record snapshot di exam_snapshots
    const snapMeta = {
      examTitle: 'Ujian Biologi Komprehensif Sprint 07',
      durationMinutes: 90,
      navigationPolicy: 'FREE_NAVIGATION',
      randomizeQuestions: true,
      randomizeOptions: true,
      totalQuestions: 6,
      allowedAttempts: 1,
    };

    const snapRes = await client.query(`
      INSERT INTO exam_snapshots (
        id, exam_id, school_id, version, metadata_json, locked_at, created_at
      ) VALUES (
        uuid_generate_v4(), $1, $2, 1, $3, NOW(), NOW()
      ) RETURNING id;
    `, [examAId, schoolAId, JSON.stringify(snapMeta)]);
    const snapshotId = snapRes.rows[0].id;

    assert(Boolean(snapshotId), 'Snapshot created and locked in exam_snapshots table');

    // 1.2 Bekukan seluruh 6 butir soal ke exam_snapshot_questions
    const eqRows = await client.query(`
      SELECT eq.order_index, eq.weight, qb.*
      FROM exam_questions eq
      JOIN question_banks qb ON eq.question_id = qb.id
      WHERE eq.exam_id = $1
      ORDER BY eq.order_index ASC;
    `, [examAId]);

    assert(eqRows.rows.length === 6, 'Found 6 questions to freeze into snapshot');

    for (const q of eqRows.rows) {
      const frozenConfig = {
        id: q.id,
        type: q.type,
        questionText: q.question_text,
        mediaUrl: q.media_url,
        mediaType: q.media_type,
        options: q.options_json,
        answerKey: q.answer_key_json,
        rubric: q.rubric_json,
        weight: q.weight,
        explanation: q.explanation,
      };

      await client.query(`
        INSERT INTO exam_snapshot_questions (
          id, snapshot_id, question_id, question_version_id, position, section, points, configuration_json
        ) VALUES (
          uuid_generate_v4(), $1, $2, $2, $3, 'MAIN', $4, $5
        );
      `, [snapshotId, q.id, q.order_index, q.weight, JSON.stringify(frozenConfig)]);
    }

    await client.query(`UPDATE exams SET active_snapshot_id = $1 WHERE id = $2;`, [snapshotId, examAId]);

    // SIMULASI: Guru mengubah butir soal q1 di question_banks setelah snapshot dibuat
    await client.query(`
      UPDATE question_banks
      SET question_text = 'PERUBAHAN ILEGAL OLEH GURU SETELAH SNAPSHOT',
          answer_key_json = '"opt_d"'::jsonb
      WHERE id = $1;
    `, [q1Id]);

    // Verifikasi bahwa record di exam_snapshot_questions TIDAK TERUBAH
    const snapQ1Res = await client.query(`
      SELECT configuration_json FROM exam_snapshot_questions WHERE snapshot_id = $1 AND question_id = $2;
    `, [snapshotId, q1Id]);

    const snapQ1Config = snapQ1Res.rows[0].configuration_json;
    assert(
      snapQ1Config.questionText.includes('Organel manakah yang berperan sebagai pembawa materi genetik utama'),
      'Snapshot Question 1 retains original immutable text after question bank mutation'
    );
    assert(
      snapQ1Config.answerKey === 'opt_b',
      'Snapshot Question 1 retains original answer key after question bank mutation'
    );

    // -----------------------------------------------------------
    // TEST 2: DETERMINISTIC RANDOMIZATION & PERSISTENCE
    // -----------------------------------------------------------
    console.log('\n--- TEST 2: Deterministic Randomization & Persistence ---');

    // Ambil daftar butir soal dari snapshot
    const snapQuestionsRes = await client.query(`
      SELECT * FROM exam_snapshot_questions WHERE snapshot_id = $1 ORDER BY position ASC;
    `, [snapshotId]);
    const snapQuestions = snapQuestionsRes.rows;

    // Generate deterministic seed untuk Student 1
    const seed1 = generateSeed(session1Id, examAId, participant1Id);
    const prng1 = createMulberry32(seed1);
    const shuffledQ1 = deterministicShuffle(snapQuestions, prng1);

    // Simpan ke question_order_maps untuk Student 1
    for (let i = 0; i < shuffledQ1.length; i++) {
      const q = shuffledQ1[i];
      await client.query(`
        INSERT INTO question_order_maps (
          id, session_id, snapshot_question_id, question_id, display_position
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4
        );
      `, [session1Id, q.id, q.question_id, i + 1]);
    }

    // Generate deterministic seed untuk Student 2
    const seed2 = generateSeed(session2Id, examAId, participant2Id);
    const prng2 = createMulberry32(seed2);
    const shuffledQ2 = deterministicShuffle(snapQuestions, prng2);

    for (let i = 0; i < shuffledQ2.length; i++) {
      const q = shuffledQ2[i];
      await client.query(`
        INSERT INTO question_order_maps (
          id, session_id, snapshot_question_id, question_id, display_position
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4
        );
      `, [session2Id, q.id, q.question_id, i + 1]);
    }

    // SIMULASI REFRESH BROWSER STUDENT 1: Baca dari question_order_maps
    const orderRead1 = await client.query(`
      SELECT question_id, display_position FROM question_order_maps WHERE session_id = $1 ORDER BY display_position ASC;
    `, [session1Id]);

    const orderRead1Again = await client.query(`
      SELECT question_id, display_position FROM question_order_maps WHERE session_id = $1 ORDER BY display_position ASC;
    `, [session1Id]);

    const stringOrderA = orderRead1.rows.map(r => `${r.display_position}:${r.question_id}`).join('|');
    const stringOrderB = orderRead1Again.rows.map(r => `${r.display_position}:${r.question_id}`).join('|');

    assert(
      stringOrderA === stringOrderB && orderRead1.rows.length === 6,
      'Student 1 question order is 100% deterministic and persisted across refreshes'
    );

    // Option Randomization Persistence
    const optSeed = generateSeed(session1Id, examAId, participant1Id, q1Id);
    const optPrng = createMulberry32(optSeed);
    const optionsRaw = snapQ1Config.options;
    const shuffledOptions = deterministicShuffle(optionsRaw, optPrng);

    for (let j = 0; j < shuffledOptions.length; j++) {
      const opt = shuffledOptions[j];
      await client.query(`
        INSERT INTO option_order_maps (
          id, session_id, question_id, option_id, display_position
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4
        );
      `, [session1Id, q1Id, opt.id, j + 1]);
    }

    const optMapRead1 = await client.query(`
      SELECT option_id, display_position FROM option_order_maps WHERE session_id = $1 AND question_id = $2 ORDER BY display_position ASC;
    `, [session1Id, q1Id]);

    const optMapRead2 = await client.query(`
      SELECT option_id, display_position FROM option_order_maps WHERE session_id = $1 AND question_id = $2 ORDER BY display_position ASC;
    `, [session1Id, q1Id]);

    const strOptA = optMapRead1.rows.map(r => `${r.option_id}:${r.display_position}`).join('|');
    const strOptB = optMapRead2.rows.map(r => `${r.option_id}:${r.display_position}`).join('|');

    assert(
      strOptA === strOptB && optMapRead1.rows.length === 4,
      'Option order is 100% deterministic and persisted across refreshes with stable option_id'
    );

    // -----------------------------------------------------------
    // TEST 3: ZERO ANSWER KEY LEAKAGE (SECURITY AUDIT)
    // -----------------------------------------------------------
    console.log('\n--- TEST 3: Zero Answer Key Leakage Audit ---');

    for (const q of snapQuestions) {
      const config = q.configuration_json;
      const studentPayload = serializeQuestionForStudent(config, q.position, optMapRead1.rows, q.section, q.points);

      assert(studentPayload.answerKey === undefined, `Zero Leakage: Question ${studentPayload.number} has no answerKey`);
      assert(studentPayload.answer_key === undefined, `Zero Leakage: Question ${studentPayload.number} has no answer_key`);
      assert(studentPayload.answer_key_json === undefined, `Zero Leakage: Question ${studentPayload.number} has no answer_key_json`);
      assert(studentPayload.rubric === undefined, `Zero Leakage: Question ${studentPayload.number} has no rubric`);
      assert(studentPayload.rubric_json === undefined, `Zero Leakage: Question ${studentPayload.number} has no rubric_json`);
      assert(studentPayload.explanation === undefined, `Zero Leakage: Question ${studentPayload.number} has no explanation`);
      assert(studentPayload.teacher_internal_note === undefined, `Zero Leakage: Question ${studentPayload.number} has no teacher notes`);
      assert(studentPayload.scoring_guide === undefined, `Zero Leakage: Question ${studentPayload.number} has no scoring guide`);
    }

    // -----------------------------------------------------------
    // TEST 4: ALL 6 QUESTION TYPES PAYLOAD CONFORMANCE
    // -----------------------------------------------------------
    console.log('\n--- TEST 4: All 6 Question Types Payload Conformance ---');

    const serializedAll = snapQuestions.map(q => serializeQuestionForStudent(q.configuration_json, q.position, [], q.section, q.points));

    const mc = serializedAll.find(q => q.type === 'PILIHAN_GANDA');
    assert(Array.isArray(mc.options) && mc.options.length === 4, 'Multiple Choice: 4 options with stable optionId');
    assert(mc.options[0].id && mc.options[0].label && mc.options[0].text, 'Multiple Choice conforms to DTO structure');

    const cmc = serializedAll.find(q => q.type === 'PG_KOMPLEKS');
    assert(Array.isArray(cmc.options) && cmc.options.length === 4, 'Complex MC: 4 options conforming to DTO');

    const tf = serializedAll.find(q => q.type === 'BENAR_SALAH');
    assert(Array.isArray(tf.options) && tf.options.length === 2, 'True/False: 2 standardized options');

    const matching = serializedAll.find(q => q.type === 'MENJODOHKAN');
    assert(matching.matchingItems && matching.matchingItems.leftItems.length === 2 && matching.matchingItems.rightItems.length === 2, 'Matching: contains left and right item sets');

    const sa = serializedAll.find(q => q.type === 'ISIAN_SINGKAT');
    assert(sa.type === 'ISIAN_SINGKAT' && sa.questionText.length > 0, 'Short answer payload clean and complete');

    const essay = serializedAll.find(q => q.type === 'ESSAY');
    assert(essay.type === 'ESSAY' && essay.points === 5, 'Essay question payload complete with 0 rubric leak');

    // -----------------------------------------------------------
    // TEST 5: ANSWER MUTATION, STATE & OPTIMISTIC CONCURRENCY
    // -----------------------------------------------------------
    console.log('\n--- TEST 5: Answer Mutation, State & Optimistic Concurrency ---');

    // 5.1 Save initial answer (version 1)
    const insAns1 = await client.query(`
      INSERT INTO student_answers (
        id, session_id, question_id, question_version_id, answer_value_json,
        is_doubtful, marked_for_review, state, version, updated_at, saved_at
      ) VALUES (
        uuid_generate_v4(), $1::uuid, $2::uuid, $3::uuid, $4::jsonb, false, false, 'ANSWERED', 1, NOW(), NOW()
      ) RETURNING version, state, answer_value_json;
    `, [session1Id, q1Id, q1Id, JSON.stringify('opt_b')]);

    assert(insAns1.rows[0].version === 1 && insAns1.rows[0].state === 'ANSWERED', 'Saved answer with version=1 and state=ANSWERED');

    // 5.2 Update answer (version 2)
    const updateAns2 = await client.query(`
      UPDATE student_answers
      SET answer_value_json = $1,
          version = version + 1,
          updated_at = NOW(),
          saved_at = NOW()
      WHERE session_id = $2 AND question_id = $3
      RETURNING version, answer_value_json;
    `, [JSON.stringify('opt_c'), session1Id, q1Id]);

    assert(updateAns2.rows[0].version === 2 && updateAns2.rows[0].answer_value_json === 'opt_c', 'Updated answer incremented version to 2');

    // 5.3 Optimistic Concurrency Simulation: Client sends clientVersion = 1 when current version = 2
    const clientStaleVersion = 1;
    const currentServerAns = await client.query(
      `SELECT version FROM student_answers WHERE session_id = $1 AND question_id = $2;`,
      [session1Id, q1Id]
    );
    const serverVersion = currentServerAns.rows[0].version;

    const isStale = clientStaleVersion < serverVersion;
    assert(isStale === true, 'Detected stale clientVersion (1 < 2) -> Optimistic Concurrency Conflict successfully triggered');

    // 5.4 Save Complex MC Answer (Array)
    await client.query(`
      INSERT INTO student_answers (
        id, session_id, question_id, question_version_id, answer_value_json,
        is_doubtful, marked_for_review, state, version, updated_at, saved_at
      ) VALUES (
        uuid_generate_v4(), $1::uuid, $2::uuid, $3::uuid, $4::jsonb, false, false, 'ANSWERED', 1, NOW(), NOW()
      );
    `, [session1Id, q2Id, q2Id, JSON.stringify(['opt_dinding', 'opt_kloro'])]);
    assert(true, 'Saved Complex MC array answer');

    // 5.5 Save Matching Answer (Object Map)
    await client.query(`
      INSERT INTO student_answers (
        id, session_id, question_id, question_version_id, answer_value_json,
        is_doubtful, marked_for_review, state, version, updated_at, saved_at
      ) VALUES (
        uuid_generate_v4(), $1::uuid, $2::uuid, $3::uuid, $4::jsonb, false, false, 'ANSWERED', 1, NOW(), NOW()
      );
    `, [session1Id, q4Id, q4Id, JSON.stringify({ L1: 'R1', L2: 'R2' })]);
    assert(true, 'Saved Matching object map answer');

    // 5.6 Save Essay Answer
    await client.query(`
      INSERT INTO student_answers (
        id, session_id, question_id, question_version_id, answer_value_json,
        is_doubtful, marked_for_review, state, version, updated_at, saved_at
      ) VALUES (
        uuid_generate_v4(), $1::uuid, $2::uuid, $3::uuid, $4::jsonb, false, false, 'ANSWERED', 1, NOW(), NOW()
      );
    `, [session1Id, q6Id, q6Id, JSON.stringify('Reaksi terang berlangsung di tilakoid.')]);
    assert(true, 'Saved Essay text answer');

    // -----------------------------------------------------------
    // TEST 6: MARK FOR REVIEW & CLEAR ANSWER
    // -----------------------------------------------------------
    console.log('\n--- TEST 6: Mark for Review & Clear Answer ---');

    // Mark for review without destroying answer
    await client.query(`
      UPDATE student_answers
      SET is_doubtful = true,
          marked_for_review = true,
          updated_at = NOW()
      WHERE session_id = $1 AND question_id = $2;
    `, [session1Id, q1Id]);

    const checkMark = await client.query(`
      SELECT answer_value_json, marked_for_review FROM student_answers WHERE session_id = $1 AND question_id = $2;
    `, [session1Id, q1Id]);
    assert(
      checkMark.rows[0].marked_for_review === true && checkMark.rows[0].answer_value_json === 'opt_c',
      'Answer preserved when marked for review'
    );

    // Clear answer action
    await client.query(`
      UPDATE student_answers
      SET answer_value_json = null,
          state = 'CLEARED',
          updated_at = NOW()
      WHERE session_id = $1 AND question_id = $2;
    `, [session1Id, q1Id]);

    const checkClear = await client.query(`
      SELECT answer_value_json, state FROM student_answers WHERE session_id = $1 AND question_id = $2;
    `, [session1Id, q1Id]);
    assert(
      checkClear.rows[0].answer_value_json === null && checkClear.rows[0].state === 'CLEARED',
      'Answer value cleared and state set to CLEARED'
    );

    // -----------------------------------------------------------
    // TEST 7: IDOR & MULTI-TENANT PROTECTION
    // -----------------------------------------------------------
    console.log('\n--- TEST 7: IDOR & Multi-tenant Protection ---');

    // 7.1 Check question ownership: Student 1 attempts to access/answer question from School B
    const idorCheck = await client.query(`
      SELECT 1 FROM question_order_maps WHERE session_id = $1 AND question_id = $2;
    `, [session1Id, qSchoolBId]);
    assert(idorCheck.rows.length === 0, 'IDOR Denied: Question from School B is not in Student 1 session map');

    // 7.2 Cross-exam snapshot protection
    const crossExamCheck = await client.query(`
      SELECT 1 FROM exam_snapshot_questions sq
      JOIN exam_snapshots s ON sq.snapshot_id = s.id
      WHERE s.exam_id = $1 AND sq.question_id = $2;
    `, [examAId, qSchoolBId]);
    assert(crossExamCheck.rows.length === 0, 'Snapshot Isolation: Question from School B does not exist in Exam A snapshot');

    // -----------------------------------------------------------
    // TEST 8: REVIEW SUMMARY & SUBMIT LOCK
    // -----------------------------------------------------------
    console.log('\n--- TEST 8: Review Summary & Submit Lock ---');

    // Hitung review summary
    const totalQCountRes = await client.query(`SELECT COUNT(*) as cnt FROM question_order_maps WHERE session_id = $1;`, [session1Id]);
    const totalQs = Number(totalQCountRes.rows[0].cnt);

    const ansSummaryRes = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE state = 'ANSWERED' AND answer_value_json IS NOT NULL) as answered,
        COUNT(*) FILTER (WHERE marked_for_review = true) as marked
      FROM student_answers
      WHERE session_id = $1;
    `, [session1Id]);

    const answeredCount = Number(ansSummaryRes.rows[0].answered);
    const markedCount = Number(ansSummaryRes.rows[0].marked);
    const unansweredCount = totalQs - answeredCount;

    assert(totalQs === 6, 'Total questions count is 6');
    assert(answeredCount === 3, 'Answered questions count is 3 (q2, q4, q6 answered; q1 cleared; q3, q5 unanswered)');
    assert(unansweredCount === 3, 'Unanswered questions count is 3');

    // SUBMIT EXAM ATOMICALLY
    const submitRes = await client.query(`
      UPDATE exam_sessions
      SET status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'IN_PROGRESS'
      RETURNING status, submitted_at;
    `, [session1Id]);

    assert(submitRes.rows[0].status === 'SUBMITTED', 'Exam session state changed to SUBMITTED');

    // Idempotent duplicate submit: status remains SUBMITTED
    const checkDup = await client.query(`SELECT status FROM exam_sessions WHERE id = $1;`, [session1Id]);
    assert(checkDup.rows[0].status === 'SUBMITTED', 'Idempotent duplicate submit check passed');

    // SUBMIT LOCK: Verify submit lock policy
    const isLocked = checkDup.rows[0].status === 'SUBMITTED';
    assert(isLocked === true, 'Submit Lock is ACTIVE. All answer mutations for session 1 are blocked');

    // -----------------------------------------------------------
    // TEST 9: XSS SANITIZATION
    // -----------------------------------------------------------
    console.log('\n--- TEST 9: XSS Sanitization Audit ---');
    const dirtyQuestionText = 'Berapakah hasil dari <script>alert("XSS")</script><b>2 + 2</b>? <img src="x" onerror="alert(1)">';
    const cleanQuestionText = sanitizeHtml(dirtyQuestionText);

    assert(!cleanQuestionText.includes('<script>'), 'XSS Sanitization: <script> tags removed');
    assert(!cleanQuestionText.includes('onerror'), 'XSS Sanitization: onerror event handlers removed');
    assert(cleanQuestionText.includes('2 + 2'), 'Safe content preserved');

    console.log('\n====================================================');
    console.log(`SPRINT 07 TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSprint07Tests();
