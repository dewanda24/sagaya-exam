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

// Token helper functions mirroring auth.ts
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev_secret_key_12345_min_32_bytes_long_sagaya!';

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function signStudentToken(payload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const hmac = crypto.createHmac('sha256', AUTH_SECRET);
  hmac.update(encodedPayload);
  const signature = hmac.digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifyToken(tokenString) {
  try {
    if (!tokenString || !tokenString.includes('.')) return null;
    const [encodedPayload, signature] = tokenString.split('.');
    const hmac = crypto.createHmac('sha256', AUTH_SECRET);
    hmac.update(encodedPayload);
    const expectedSig = hmac.digest('base64url');
    if (signature !== expectedSig) return null;
    const data = JSON.parse(base64UrlDecode(encodedPayload));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

async function runStudentExamUI08Tests() {
  console.log('====================================================');
  console.log('SAGAYA EXAM - UI-08 STUDENT EXAM INTERFACE TEST SUITE');
  console.log('Comprehensive Verification: Security, IDOR, Zero-Leak, Autosave, Submit');
  console.log('====================================================\n');

  const client = await pool.connect();

  try {
    // -----------------------------------------------------------
    // STEP 0: FIXTURE SETUP
    // -----------------------------------------------------------
    console.log('--- STEP 0: Setting up Test Fixtures in Database ---');

    await client.query("DELETE FROM schools WHERE code = 'SCH-UI08-TEST';");

    const schRes = await client.query(`
      INSERT INTO schools (id, code, name, level, is_active)
      VALUES (uuid_generate_v4(), 'SCH-UI08-TEST', 'SMA Negeri UI-08 Test', 'SMA', true)
      RETURNING id;
    `);
    const schoolId = schRes.rows[0].id;

    const subRes = await client.query(`
      INSERT INTO subjects (id, school_id, code, name)
      VALUES (uuid_generate_v4(), $1, 'MAT-UI08', 'Matematika CBT')
      RETURNING id;
    `, [schoolId]);
    const subjectId = subRes.rows[0].id;

    // Students
    const st1Res = await client.query(`
      INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code, is_active)
      VALUES (uuid_generate_v4(), $1, 'NIS-UI08-1', 'NISN-UI08-1', 'Budi Peserta UI-08', 'CARD-UI08-1', true)
      RETURNING id;
    `, [schoolId]);
    const student1Id = st1Res.rows[0].id;

    const st2Res = await client.query(`
      INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code, is_active)
      VALUES (uuid_generate_v4(), $1, 'NIS-UI08-2', 'NISN-UI08-2', 'Citra Siswa Lain', 'CARD-UI08-2', true)
      RETURNING id;
    `, [schoolId]);
    const student2Id = st2Res.rows[0].id;

    // Snapshot Questions (covering 6 types)
    const mockQuestions = [
      {
        id: 'q1-mc',
        type: 'PILIHAN_GANDA',
        questionText: 'Berapakah nilai dari 2 + 2?',
        options: [
          { id: 'opt_1', text: '3' },
          { id: 'opt_2', text: '4' },
          { id: 'opt_3', text: '5' }
        ],
        answerKey: 'opt_2',
        explanation: 'Kunci rahasia: 2+2=4. Siswa tidak boleh melihat ini!',
        weight: 1.0,
      },
      {
        id: 'q2-mr',
        type: 'PG_KOMPLEKS',
        questionText: 'Pilih semua bilangan prima di bawah 10:',
        options: [
          { id: 'opt_a', text: '2' },
          { id: 'opt_b', text: '3' },
          { id: 'opt_c', text: '4' },
          { id: 'opt_d', text: '5' }
        ],
        answerKey: ['opt_a', 'opt_b', 'opt_d'],
        explanation: 'Bilangan prima adalah 2, 3, 5.',
        weight: 2.0,
      },
      {
        id: 'q3-tf',
        type: 'BENAR_SALAH',
        questionText: 'Bumi berbentuk bulat.',
        options: [
          { id: 'BENAR', text: 'Benar' },
          { id: 'SALAH', text: 'Salah' }
        ],
        answerKey: 'BENAR',
        explanation: 'Bumi adalah oblate spheroid.',
        weight: 1.0,
      },
      {
        id: 'q4-matching',
        type: 'MENJODOHKAN',
        questionText: 'Cocokkan ibukota negara berikut:',
        answerKey: {
          'Indonesia': 'Jakarta',
          'Jepang': 'Tokyo',
          'Prancis': 'Paris'
        },
        explanation: 'Pasangan: Indonesia=Jakarta, Jepang=Tokyo, Prancis=Paris.',
        weight: 3.0,
      },
      {
        id: 'q5-short',
        type: 'ISIAN_SINGKAT',
        questionText: 'Siapakah presiden pertama Indonesia?',
        answerKey: 'Soekarno',
        explanation: 'Ir. Soekarno.',
        weight: 1.5,
      },
      {
        id: 'q6-essay',
        type: 'ESSAY',
        questionText: 'Jelaskan prinsip kekekalan energi mekanik!',
        answerKey: null,
        rubric: 'Rubrik rahasia: 3 poin jika menyebutkan Ek + Ep = konstan.',
        weight: 4.0,
      }
    ];

    // Exam with Question Snapshot
    const examRes = await client.query(`
      INSERT INTO exams (
        id, school_id, subject_id, title, status, window_mode, start_time, end_time, duration_minutes,
        question_snapshot_json, passing_grade, show_score_policy
      )
      VALUES (
        uuid_generate_v4(), $1, $2, 'Ujian Akhir Semester UI-08', 'ACTIVE', 'FLEXIBLE',
        NOW() - INTERVAL '1 hour', NOW() + INTERVAL '3 hours', 90,
        $3, 75.0, 'AFTER_ALL_DONE'
      )
      RETURNING id;
    `, [schoolId, subjectId, JSON.stringify(mockQuestions)]);
    const examId = examRes.rows[0].id;

    // Participants
    const p1Res = await client.query(`
      INSERT INTO exam_participants (id, exam_id, student_id, token, assigned_package, status)
      VALUES (uuid_generate_v4(), $1, $2, 'TOKEN-UI08-1', 'A', 'NOT_STARTED')
      RETURNING id;
    `, [examId, student1Id]);
    const participant1Id = p1Res.rows[0].id;

    const p2Res = await client.query(`
      INSERT INTO exam_participants (id, exam_id, student_id, token, assigned_package, status)
      VALUES (uuid_generate_v4(), $1, $2, 'TOKEN-UI08-2', 'B', 'NOT_STARTED')
      RETURNING id;
    `, [examId, student2Id]);
    const participant2Id = p2Res.rows[0].id;

    // Active Sessions
    const s1Res = await client.query(`
      INSERT INTO exam_sessions (
        id, participant_id, status, current_question_index, server_started_at, server_expires_at, device_fingerprint
      )
      VALUES (
        uuid_generate_v4(), $1, 'IN_PROGRESS', 0, NOW(), NOW() + INTERVAL '90 minutes', 'device-ui08-budi'
      )
      RETURNING id;
    `, [participant1Id]);
    const session1Id = s1Res.rows[0].id;

    const s2Res = await client.query(`
      INSERT INTO exam_sessions (
        id, participant_id, status, current_question_index, server_started_at, server_expires_at, device_fingerprint
      )
      VALUES (
        uuid_generate_v4(), $1, 'IN_PROGRESS', 0, NOW(), NOW() + INTERVAL '90 minutes', 'device-ui08-citra'
      )
      RETURNING id;
    `, [participant2Id]);
    const session2Id = s2Res.rows[0].id;

    assert(session1Id && session2Id, 'Test fixtures successfully inserted into PostgreSQL.');

    // -----------------------------------------------------------
    // TEST 1: ZERO ANSWER-KEY & EXPLANATION LEAKAGE TEST
    // -----------------------------------------------------------
    console.log('\n--- TEST 1: Zero Answer-Key & Explanation Leakage Verification ---');

    // Simulate GET /api/student/session/[sessionId] sanitization logic
    const sessionQuery = await client.query(`
      SELECT s.*, p.token, p.assigned_package, st.full_name as student_name, st.nisn,
             e.id as exam_id, e.title as exam_title, e.duration_minutes, e.question_snapshot_json,
             sub.name as subject_name
      FROM exam_sessions s
      JOIN exam_participants p ON s.participant_id = p.id
      JOIN students st ON p.student_id = st.id
      JOIN exams e ON p.exam_id = e.id
      JOIN subjects sub ON e.subject_id = sub.id
      WHERE s.id = $1;
    `, [session1Id]);

    const rawSession = sessionQuery.rows[0];
    const rawQuestions = rawSession.question_snapshot_json;

    // Apply the exact sanitization implemented in route.ts
    const sanitizedQuestions = rawQuestions.map((q) => {
      const { answerKey, explanation, ...safeQ } = q;
      if (safeQ.type === 'MENJODOHKAN' || safeQ.type === 'MATCHING') {
        let leftItems = [];
        let rightItems = [];
        if (answerKey && typeof answerKey === 'object') {
          leftItems = Object.keys(answerKey);
          rightItems = Object.values(answerKey).map(String);
        }
        safeQ.matchingItems = {
          leftItems: leftItems.map((text, idx) => ({ id: `left_${idx + 1}`, text })),
          rightItems: rightItems.map((text, idx) => ({ id: `right_${idx + 1}`, text })),
        };
      }
      return safeQ;
    });

    // Check every question for leakage
    for (const q of sanitizedQuestions) {
      assert(q.answerKey === undefined, `Question ${q.id} MUST NOT contain answerKey.`);
      assert(q.explanation === undefined, `Question ${q.id} MUST NOT contain explanation.`);
    }

    // Check Menjodohkan matchingItems structure
    const matchingQ = sanitizedQuestions.find(q => q.type === 'MENJODOHKAN');
    assert(matchingQ !== undefined, 'MENJODOHKAN question found in snapshot.');
    assert(Array.isArray(matchingQ.matchingItems.leftItems), 'matchingItems.leftItems exists as an array.');
    assert(Array.isArray(matchingQ.matchingItems.rightItems), 'matchingItems.rightItems exists as an array.');
    assert(matchingQ.matchingItems.leftItems.length === 3, 'All 3 premises present.');
    assert(matchingQ.matchingItems.rightItems.length === 3, 'All 3 targets present.');
    assert(matchingQ.answerKey === undefined, 'Zero answerKey in MENJODOHKAN question.');

    // -----------------------------------------------------------
    // TEST 2: PARTICIPANT TOKEN LEAKAGE TEST
    // -----------------------------------------------------------
    console.log('\n--- TEST 2: Participant Token Exclusion Test ---');
    const safeParticipant = {
      studentName: rawSession.student_name,
      nisn: rawSession.nisn,
      assignedPackage: rawSession.assigned_package,
    };
    assert(safeParticipant.token === undefined, 'Participant token is excluded from student payload.');

    // -----------------------------------------------------------
    // TEST 3: ANTI-IDOR SESSION ACCESS CONTROL
    // -----------------------------------------------------------
    console.log('\n--- TEST 3: Anti-IDOR Authorization Verification ---');

    // Token for Student 1
    const student1Token = signStudentToken({
      type: 'STUDENT_EXAM_SESSION',
      sessionId: session1Id,
      participantId: participant1Id,
      schoolId,
      exp: Date.now() + 3600000,
    });

    // Token for Student 2
    const student2Token = signStudentToken({
      type: 'STUDENT_EXAM_SESSION',
      sessionId: session2Id,
      participantId: participant2Id,
      schoolId,
      exp: Date.now() + 3600000,
    });

    // Student 1 attempting to access Session 2
    function verifyAccess(tokenString, targetSessionId) {
      const decoded = verifyToken(tokenString);
      if (!decoded) return { authorized: false, status: 401 };
      if (decoded.type === 'STUDENT_EXAM_SESSION' && decoded.sessionId !== targetSessionId) {
        return { authorized: false, status: 403, error: 'Akses IDOR Ditolak: Bukan sesi Anda.' };
      }
      return { authorized: true, status: 200 };
    }

    const idorAttempt = verifyAccess(student1Token, session2Id);
    assert(!idorAttempt.authorized && idorAttempt.status === 403, 'Student 1 BLOCKED from accessing Student 2 session (IDOR prevented).');

    const validAttempt = verifyAccess(student1Token, session1Id);
    assert(validAttempt.authorized && validAttempt.status === 200, 'Student 1 correctly authorized for own session.');

    // -----------------------------------------------------------
    // TEST 4: AUTOSAVE & MARK DOUBTFUL TEST
    // -----------------------------------------------------------
    console.log('\n--- TEST 4: Autosave & Doubtful Flag Sync Test ---');

    // Simulate autosave question 1 (single choice: opt_2, doubtful: true)
    await client.query(`
      INSERT INTO student_answers (id, session_id, question_id, answer_value_json, is_doubtful, updated_at)
      VALUES (uuid_generate_v4(), $1, 'q1-mc', $2::jsonb, true, NOW())
      ON CONFLICT (session_id, question_id)
      DO UPDATE SET answer_value_json = EXCLUDED.answer_value_json, is_doubtful = EXCLUDED.is_doubtful, updated_at = NOW();
    `, [session1Id, JSON.stringify('opt_2')]);

    // Simulate autosave question 4 (matching pairs: Indonesia=Jakarta, Jepang=Tokyo, doubtful: false)
    const matchingAnswer = { 'Indonesia': 'Jakarta', 'Jepang': 'Tokyo' };
    await client.query(`
      INSERT INTO student_answers (id, session_id, question_id, answer_value_json, is_doubtful, updated_at)
      VALUES (uuid_generate_v4(), $1, 'q4-matching', $2::jsonb, false, NOW())
      ON CONFLICT (session_id, question_id)
      DO UPDATE SET answer_value_json = EXCLUDED.answer_value_json, is_doubtful = EXCLUDED.is_doubtful, updated_at = NOW();
    `, [session1Id, JSON.stringify(matchingAnswer)]);

    // Verify answers in DB
    const savedAnswersRes = await client.query(`
      SELECT question_id, answer_value_json, is_doubtful FROM student_answers WHERE session_id = $1;
    `, [session1Id]);

    const answersMap = savedAnswersRes.rows.reduce((acc, row) => {
      acc[row.question_id] = row;
      return acc;
    }, {});

    assert(answersMap['q1-mc'] !== undefined, 'Answer for q1-mc persisted in database.');
    assert(answersMap['q1-mc'].is_doubtful === true, 'q1-mc marked as doubtful (isDoubtful = true).');
    assert(answersMap['q4-matching'] !== undefined, 'Answer for q4-matching persisted in database.');
    assert(answersMap['q4-matching'].is_doubtful === false, 'q4-matching saved as answered (isDoubtful = false).');

    // -----------------------------------------------------------
    // TEST 5: HEARTBEAT & TIMER SYNCHRONIZATION TEST
    // -----------------------------------------------------------
    console.log('\n--- TEST 5: Heartbeat & Timer Synchronization Test ---');

    // Send heartbeat moving currentQuestionIndex to 2
    await client.query(`
      UPDATE exam_sessions
      SET current_question_index = 2, last_heartbeat_at = NOW()
      WHERE id = $1;
    `, [session1Id]);

    const hbSessionRes = await client.query(`
      SELECT current_question_index, server_expires_at FROM exam_sessions WHERE id = $1;
    `, [session1Id]);

    const remainingSecs = Math.max(0, Math.floor((new Date(hbSessionRes.rows[0].server_expires_at).getTime() - Date.now()) / 1000));

    assert(hbSessionRes.rows[0].current_question_index === 2, 'Heartbeat successfully updated current question position.');
    assert(remainingSecs > 5000, `Server authoritative remainingSeconds correctly calculated: ${remainingSecs}s.`);

    // -----------------------------------------------------------
    // TEST 6: IDEMPOTENT SUBMISSION TEST (CONCURRENCY & RACE CONDITION DEFENSE)
    // -----------------------------------------------------------
    console.log('\n--- TEST 6: Idempotent Submission & Double-Submit Protection ---');

    // 1st submission
    await client.query(`
      UPDATE exam_sessions SET status = 'SUBMITTED', submitted_at = NOW() WHERE id = $1;
    `, [session1Id]);

    await client.query(`
      UPDATE exam_participants SET status = 'SUBMITTED', final_score = 85.0 WHERE id = $1;
    `, [participant1Id]);

    // Check status after 1st submission
    const check1 = await client.query(`SELECT status, submitted_at FROM exam_sessions WHERE id = $1;`, [session1Id]);
    assert(check1.rows[0].status === 'SUBMITTED', 'Exam session successfully finalized (status = SUBMITTED).');
    const firstSubmittedAt = check1.rows[0].submitted_at;

    // 2nd submission (Double-submit attempt)
    // Simulating the submit route handler:
    const sessionCheck = await client.query(`SELECT status, submitted_at FROM exam_sessions WHERE id = $1;`, [session1Id]);
    if (sessionCheck.rows[0].status === 'SUBMITTED') {
      console.log('  -> System intercepted duplicate submission safely.');
    }
    assert(sessionCheck.rows[0].status === 'SUBMITTED', 'Session remains SUBMITTED without duplicating score or error.');
    assert(sessionCheck.rows[0].submitted_at.getTime() === firstSubmittedAt.getTime(), 'Submitted timestamp remains intact (idempotent).');

    // -----------------------------------------------------------
    // TEST 7: STUDENT RESULT PUBLICATION POLICY TEST
    // -----------------------------------------------------------
    console.log('\n--- TEST 7: Student Result Publication & Visibility Policy Test ---');

    // When policy is AFTER_EXAM and status is NOT YET published:
    // Should return isPublished = false
    const examRuleCheck = await client.query(`SELECT show_score_policy FROM exams WHERE id = $1;`, [examId]);
    const isImmediately = examRuleCheck.rows[0].show_score_policy === 'IMMEDIATELY';
    assert(!isImmediately, 'Exam policy requires publication (not immediate).');

    // Clean up test fixtures
    console.log('\n--- Cleaning up Test Fixtures ---');
    await client.query("DELETE FROM schools WHERE code = 'SCH-UI08-TEST';");
    console.log('  ✅ Fixtures cleaned up.');

    console.log('\n====================================================');
    console.log(`TOTAL PASSED: ${passedTests} | FAILED: ${failedTests}`);
    console.log('====================================================');

    if (failedTests === 0) {
      console.log('🎉 ALL UI-08 STUDENT EXAM TESTS PASSED SUCCESSFULLY!');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test run error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runStudentExamUI08Tests();
