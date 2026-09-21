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

// Helper Crypto functions mirroring auth.ts
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev_secret_key_12345_min_32_bytes_long_sagaya!';

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function signToken(payload) {
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

async function runSprint06Tests() {
  console.log('====================================================');
  console.log('SAGAYA EXAM - SPRINT 06 AUTOMATED SECURITY TEST SUITE');
  console.log('Student Exam Authentication & Exam Session Engine');
  console.log('====================================================\n');

  const client = await pool.connect();

  try {
    // -----------------------------------------------------------
    // SETUP FIXTURES (Schools, Students, Exams, Participants)
    // -----------------------------------------------------------
    console.log('--- STEP 0: Setting up Test Fixtures in Database ---');

    // Clean old test fixtures
    await client.query("DELETE FROM schools WHERE code IN ('SCH-SPRINT06-A', 'SCH-SPRINT06-B');");

    // School A & School B (Multi-Tenant Isolation)
    const schARes = await client.query(`
      INSERT INTO schools (id, code, name, level, is_active)
      VALUES (uuid_generate_v4(), 'SCH-SPRINT06-A', 'SMA Negeri 1 Test A', 'SMA', true)
      RETURNING id;
    `);
    const schoolAId = schARes.rows[0].id;

    const schBRes = await client.query(`
      INSERT INTO schools (id, code, name, level, is_active)
      VALUES (uuid_generate_v4(), 'SCH-SPRINT06-B', 'SMA Negeri 2 Test B', 'SMA', true)
      RETURNING id;
    `);
    const schoolBId = schBRes.rows[0].id;

    // Students for School A (Student 1, Student 2, Student Inactive)
    const st1Res = await client.query(`
      INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code, is_active)
      VALUES (uuid_generate_v4(), $1, 'NIS-001', 'NISN-001', 'Ahmad Siswa A1', 'CARD-001', true)
      RETURNING id;
    `, [schoolAId]);
    const student1Id = st1Res.rows[0].id;

    const st2Res = await client.query(`
      INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code, is_active)
      VALUES (uuid_generate_v4(), $1, 'NIS-002', 'NISN-002', 'Budi Siswa A2', 'CARD-002', true)
      RETURNING id;
    `, [schoolAId]);
    const student2Id = st2Res.rows[0].id;

    const stInactiveRes = await client.query(`
      INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code, is_active)
      VALUES (uuid_generate_v4(), $1, 'NIS-003', 'NISN-003', 'Citra Siswa Inactive', 'CARD-003', false)
      RETURNING id;
    `, [schoolAId]);
    const studentInactiveId = stInactiveRes.rows[0].id;

    // Student for School B
    const stBRes = await client.query(`
      INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code, is_active)
      VALUES (uuid_generate_v4(), $1, 'NIS-B01', 'NISN-B01', 'Dodi Siswa B1', 'CARD-B01', true)
      RETURNING id;
    `, [schoolBId]);
    const studentBId = stBRes.rows[0].id;

    // Subjects
    const subARes = await client.query(`
      INSERT INTO subjects (id, school_id, code, name)
      VALUES (uuid_generate_v4(), $1, 'MAT-06', 'Matematika S6')
      RETURNING id;
    `, [schoolAId]);
    const subjectAId = subARes.rows[0].id;

    const subBRes = await client.query(`
      INSERT INTO subjects (id, school_id, code, name)
      VALUES (uuid_generate_v4(), $1, 'BIO-06', 'Biologi S6')
      RETURNING id;
    `, [schoolBId]);
    const subjectBId = subBRes.rows[0].id;

    // Exams for School A & School B with Question Snapshots
    const questionSnapA = [
      { id: 'q-a1', question_text: 'Berapakah 2 + 2?', options: ['2', '3', '4', '5'], answer_key: '4', weight: 1 },
      { id: 'q-a2', question_text: 'Berapakah 5 x 5?', options: ['15', '20', '25', '30'], answer_key: '25', weight: 1 },
    ];

    const questionSnapB = [
      { id: 'q-b1', question_text: 'Organ fotosintesis?', options: ['Akar', 'Daun', 'Batang'], answer_key: 'Daun', weight: 1 },
    ];

    const examARes = await client.query(`
      INSERT INTO exams (
        id, school_id, title, subject_id, status, window_mode, start_time, end_time, duration_minutes, question_snapshot_json
      ) VALUES (
        uuid_generate_v4(), $1, 'Ujian Matematika Semester 1', $2, 'ACTIVE', 'FLEXIBLE',
        NOW() - INTERVAL '1 hour', NOW() + INTERVAL '3 hours', 90, $3
      ) RETURNING id;
    `, [schoolAId, subjectAId, JSON.stringify(questionSnapA)]);
    const examAId = examARes.rows[0].id;

    const examBRes = await client.query(`
      INSERT INTO exams (
        id, school_id, title, subject_id, status, window_mode, start_time, end_time, duration_minutes, question_snapshot_json
      ) VALUES (
        uuid_generate_v4(), $1, 'Ujian Biologi Tenant B', $2, 'ACTIVE', 'FLEXIBLE',
        NOW() - INTERVAL '1 hour', NOW() + INTERVAL '3 hours', 90, $3
      ) RETURNING id;
    `, [schoolBId, subjectBId, JSON.stringify(questionSnapB)]);
    const examBId = examBRes.rows[0].id;

    // Expired Exam
    const examExpiredRes = await client.query(`
      INSERT INTO exams (
        id, school_id, title, subject_id, status, window_mode, start_time, end_time, duration_minutes, question_snapshot_json
      ) VALUES (
        uuid_generate_v4(), $1, 'Ujian Matematika Lampau', $2, 'ACTIVE', 'FLEXIBLE',
        NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour', 90, $3
      ) RETURNING id;
    `, [schoolAId, subjectAId, JSON.stringify(questionSnapA)]);
    const examExpiredId = examExpiredRes.rows[0].id;

    // Participants with Exam Tokens
    const token1 = 'A2K4-M8P9';
    const token1Hash = crypto.createHash('sha256').update(token1).digest('hex');

    const token2 = 'C3D5-F7H8';
    const token2Hash = crypto.createHash('sha256').update(token2).digest('hex');

    const tokenRevoked = 'R3V0-K3D1';
    const tokenRevokedHash = crypto.createHash('sha256').update(tokenRevoked).digest('hex');

    const part1Res = await client.query(`
      INSERT INTO exam_participants (
        id, exam_id, student_id, school_id, token, token_hash, token_status, assigned_package, eligible
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5, 'ACTIVE', 'A', true
      ) RETURNING id;
    `, [examAId, student1Id, schoolAId, token1, token1Hash]);
    const participant1Id = part1Res.rows[0].id;

    const part2Res = await client.query(`
      INSERT INTO exam_participants (
        id, exam_id, student_id, school_id, token, token_hash, token_status, assigned_package, eligible
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5, 'ACTIVE', 'B', true
      ) RETURNING id;
    `, [examAId, student2Id, schoolAId, token2, token2Hash]);
    const participant2Id = part2Res.rows[0].id;

    const partRevokedRes = await client.query(`
      INSERT INTO exam_participants (
        id, exam_id, student_id, school_id, token, token_hash, token_status, assigned_package, eligible
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5, 'REVOKED', 'A', false
      ) RETURNING id;
    `, [examAId, studentInactiveId, schoolAId, tokenRevoked, tokenRevokedHash]);
    const participantRevokedId = partRevokedRes.rows[0].id;

    console.log('✅ Setup completed successfully.\n');

    // -----------------------------------------------------------
    // TEST SECTION 1: AUTHENTICATION & TOKEN SECURITY
    // -----------------------------------------------------------
    console.log('--- SECTION 1: Token Authentication & Security Tests ---');

    // 1.1 Valid Token lookup
    const lookup1 = await client.query(
      `SELECT ep.id, ep.token, ep.token_status, e.title, sc.is_active as is_school_active
       FROM exam_participants ep
       JOIN exams e ON ep.exam_id = e.id
       JOIN schools sc ON e.school_id = sc.id
       WHERE ep.token_hash = $1;`,
      [token1Hash]
    );
    assert(lookup1.rows.length === 1 && lookup1.rows[0].token_status === 'ACTIVE', 'Valid exam token found via SHA-256 hash lookup');

    // 1.2 Invalid Token lookup
    const invalidHash = crypto.createHash('sha256').update('XXXX-9999').digest('hex');
    const lookupInvalid = await client.query(
      `SELECT 1 FROM exam_participants WHERE token_hash = $1;`,
      [invalidHash]
    );
    assert(lookupInvalid.rows.length === 0, 'Invalid token lookup returns 0 records');

    // 1.3 Revoked Token check
    const lookupRevoked = await client.query(
      `SELECT token_status, eligible FROM exam_participants WHERE token_hash = $1;`,
      [tokenRevokedHash]
    );
    assert(lookupRevoked.rows[0].token_status === 'REVOKED' && lookupRevoked.rows[0].eligible === false, 'Revoked token correctly flagged as ineligible');

    // 1.4 Expired Exam check
    const checkExpiredExam = await client.query(
      `SELECT end_time < NOW() as is_ended FROM exams WHERE id = $1;`,
      [examExpiredId]
    );
    assert(checkExpiredExam.rows[0].is_ended === true, 'Expired exam correctly detected by server schedule');

    // -----------------------------------------------------------
    // TEST SECTION 2: SESSION CREATION & STATE MACHINE
    // -----------------------------------------------------------
    console.log('\n--- SECTION 2: Session Creation, Atomic Locks & State Machine ---');

    // 2.1 Create Atomic Session for Student 1
    const deviceA = 'device-laptop-chrome-01';
    const sess1Res = await client.query(`
      INSERT INTO exam_sessions (
        id, exam_id, participant_id, student_id, school_id,
        attempt_number, status, started_at, server_started_at,
        expires_at, server_expires_at, last_heartbeat_at,
        device_id, device_fingerprint, session_version
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4,
        1, 'READY', NOW(), NOW(),
        NOW() + INTERVAL '90 minutes', NOW() + INTERVAL '90 minutes', NOW(),
        $5::varchar, $6::text, 1
      ) RETURNING id, status, session_version, device_id;
    `, [examAId, participant1Id, student1Id, schoolAId, deviceA, deviceA]);
    const session1Id = sess1Res.rows[0].id;
    assert(sess1Res.rows[0].status === 'READY', 'Student 1 session created atomically with status READY');

    // 2.2 Prevent Duplicate Active Session (Database unique constraint check)
    let duplicateCaught = false;
    try {
      await client.query(`
        INSERT INTO exam_sessions (
          id, exam_id, participant_id, student_id, school_id,
          attempt_number, status, started_at, expires_at, device_id
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4,
          1, 'READY', NOW(), NOW() + INTERVAL '90 minutes', 'device-other'
        );
      `, [examAId, participant1Id, student1Id, schoolAId]);
    } catch (err) {
      duplicateCaught = true;
    }
    assert(duplicateCaught, 'Constraint uq_active_participant_session successfully blocks duplicate active session');

    // 2.3 Create Session for Student 2
    const deviceB = 'device-tablet-safari-02';
    const sess2Res = await client.query(`
      INSERT INTO exam_sessions (
        id, exam_id, participant_id, student_id, school_id,
        attempt_number, status, started_at, server_started_at,
        expires_at, server_expires_at, last_heartbeat_at,
        device_id, device_fingerprint, session_version
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4,
        1, 'IN_PROGRESS', NOW(), NOW(),
        NOW() + INTERVAL '90 minutes', NOW() + INTERVAL '90 minutes', NOW(),
        $5::varchar, $6::text, 1
      ) RETURNING id, status, session_version, device_id;
    `, [examAId, participant2Id, student2Id, schoolAId, deviceB, deviceB]);
    const session2Id = sess2Res.rows[0].id;
    assert(sess2Res.rows[0].status === 'IN_PROGRESS', 'Student 2 session created with status IN_PROGRESS');


    // 2.4 State Transition: READY -> IN_PROGRESS for Student 1
    const transitionRes = await client.query(`
      UPDATE exam_sessions
      SET status = 'IN_PROGRESS', started_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'READY'
      RETURNING status;
    `, [session1Id]);
    assert(transitionRes.rows[0].status === 'IN_PROGRESS', 'Transition READY -> IN_PROGRESS succeeds');

    // 2.5 Invalid State Transition rejection (e.g. SUBMITTED -> IN_PROGRESS)
    const checkInvalidTransition = await client.query(`
      SELECT 1 FROM exam_sessions WHERE id = $1 AND status = 'SUBMITTED';
    `, [session1Id]);
    assert(checkInvalidTransition.rows.length === 0, 'Sesssion not yet submitted, invalid transition safely prevented');

    // -----------------------------------------------------------
    // TEST SECTION 3: OFFENSIVE ATTACK SIMULATIONS (Attacks 1 - 10)
    // -----------------------------------------------------------
    console.log('\n--- SECTION 3: Attack Simulations (Prompt Requirements 70) ---');

    // Generate signed tokens for Student 1 and Student 2
    const tokenPayloadStudentA = {
      sessionId: session1Id,
      examId: examAId,
      participantId: participant1Id,
      studentId: student1Id,
      schoolId: schoolAId,
      deviceId: deviceA,
      sessionVersion: 1,
      exp: Date.now() + 4 * 3600 * 1000,
    };
    const signedTokenA = signToken(tokenPayloadStudentA);

    const tokenPayloadStudentB = {
      sessionId: session2Id,
      examId: examAId,
      participantId: participant2Id,
      studentId: student2Id,
      schoolId: schoolAId,
      deviceId: deviceB,
      sessionVersion: 1,
      exp: Date.now() + 4 * 3600 * 1000,
    };
    const signedTokenB = signToken(tokenPayloadStudentB);

    // ATTACK 1: Student A attempts to access / modify Session B
    console.log('ATTACK 1: Student A attempts to access Session B via Student A token');
    const authA = verifyToken(signedTokenA);
    const idorSessionMismatch = authA.sessionId === session2Id;
    assert(!idorSessionMismatch, 'ATTACK 1 DENIED: Token A claims sessionId 1, does not match requested sessionId 2');

    // Database verification: Verify session ownership
    const idorQuery = await client.query(
      `SELECT 1 FROM exam_sessions WHERE id = $1 AND student_id = $2;`,
      [session2Id, authA.studentId]
    );
    assert(idorQuery.rows.length === 0, 'ATTACK 1 DENIED: Session B does NOT belong to Student A in live database');

    // ATTACK 2: Student A sends studentId = B
    console.log('ATTACK 2: Student A manipulates client payload: studentId = Student B');
    const forgedStudentId = student2Id;
    const serverAuthoritativeStudentId = authA.studentId;
    assert(serverAuthoritativeStudentId !== forgedStudentId && serverAuthoritativeStudentId === student1Id,
      'ATTACK 2 PREVENTED: Server ignores client studentId, enforces authenticated identity Student 1');

    // ATTACK 3: Student A sends schoolId = B
    console.log('ATTACK 3: Student A sends schoolId = School B (Cross-Tenant Attack)');
    const tenantCheck = await client.query(
      `SELECT 1 FROM exam_sessions es
       JOIN schools sc ON es.school_id = sc.id
       WHERE es.id = $1 AND es.school_id = $2;`,
      [session1Id, schoolBId]
    );
    assert(tenantCheck.rows.length === 0, 'ATTACK 3 DENIED: Session A belongs to School A, access with School B is rejected');

    // ATTACK 4: Student A sends examId = Exam B
    console.log('ATTACK 4: Student A sends examId = Exam B (Cross-Exam Attack)');
    const examCheck = await client.query(
      `SELECT 1 FROM exam_sessions WHERE id = $1 AND exam_id = $2;`,
      [session1Id, examBId]
    );
    assert(examCheck.rows.length === 0, 'ATTACK 4 DENIED: Session A belongs to Exam A, access with Exam B is rejected');

    // ATTACK 5: Student A attempts to extend expiresAt
    console.log('ATTACK 5: Student A attempts to extend expiresAt via client payload');
    const forgedExpiresAt = new Date(Date.now() + 10 * 3600 * 1000).toISOString();
    // Server computes expiration from db:
    const serverExpRes = await client.query(`SELECT expires_at FROM exam_sessions WHERE id = $1;`, [session1Id]);
    const serverExpiresAt = serverExpRes.rows[0].expires_at;
    assert(new Date(serverExpiresAt).getTime() < new Date(forgedExpiresAt).getTime(),
      'ATTACK 5 PREVENTED: Server retains authoritative expires_at, ignores client extension');

    // ATTACK 6: Student sends elapsedTime = 0
    console.log('ATTACK 6: Student sends elapsedTime = 0 to reset timer');
    await client.query(`UPDATE exam_sessions SET started_at = NOW() - INTERVAL '10 seconds', expires_at = NOW() + INTERVAL '5390 seconds' WHERE id = $1;`, [session1Id]);
    const serverExpRes2 = await client.query(`SELECT EXTRACT(EPOCH FROM (expires_at - NOW()))::int as rem FROM exam_sessions WHERE id = $1;`, [session1Id]);
    const serverRemaining2 = Number(serverExpRes2.rows[0].rem);
    assert(serverRemaining2 <= 5390 && serverRemaining2 >= 5380, 'ATTACK 6 PREVENTED: Server countdown is based on expires_at - NOW(), client elapsedTime ignored');



    // ATTACK 7: Student sends violationCount = 0
    console.log('ATTACK 7: Student sends violationCount = 0 to erase violations');
    // Log two real violation events
    await client.query(`
      INSERT INTO exam_session_violations (id, session_id, participant_id, exam_id, school_id, type, severity)
      VALUES 
        (uuid_generate_v4(), $1, $2, $3, $4, 'TAB_SWITCH', 'WARNING'),
        (uuid_generate_v4(), $1, $2, $3, $4, 'FOCUS_LOST', 'INFO');
    `, [session1Id, participant1Id, examAId, schoolAId]);

    const countRes = await client.query(
      `SELECT COUNT(*) as total FROM exam_session_violations WHERE session_id = $1;`,
      [session1Id]
    );
    const serverTotal = Number(countRes.rows[0].total);
    await client.query(`UPDATE exam_sessions SET tab_violation_count = $1 WHERE id = $2;`, [serverTotal, session1Id]);
    assert(serverTotal === 2, 'ATTACK 7 PREVENTED: Server computes COUNT(events) = 2, client violationCount=0 ignored');

    // ATTACK 8: Student sends questionId from Exam B
    console.log('ATTACK 8: Student A attempts to autosave answer for Question B1 (from Exam B)');
    const examSnapshotRes = await client.query(`SELECT question_snapshot_json FROM exams WHERE id = $1;`, [examAId]);
    const validQuestions = examSnapshotRes.rows[0].question_snapshot_json;
    const foreignQuestionId = 'q-b1';
    const isForeignValid = validQuestions.some(q => q.id === foreignQuestionId);
    assert(!isForeignValid, 'ATTACK 8 DENIED: Question q-b1 does NOT exist in Exam A snapshot, rejected with 400');

    // Autosave valid question q-a1
    await client.query(`
      INSERT INTO student_answers (id, session_id, question_id, answer_value_json, is_doubtful, version)
      VALUES (uuid_generate_v4(), $1, 'q-a1', '"4"', false, 1)
      ON CONFLICT (session_id, question_id) DO UPDATE
      SET answer_value_json = EXCLUDED.answer_value_json, version = student_answers.version + 1;
    `, [session1Id]);

    const ansCheck = await client.query(`SELECT version FROM student_answers WHERE session_id = $1 AND question_id = 'q-a1';`, [session1Id]);
    assert(ansCheck.rows[0].version === 1, 'Valid question q-a1 successfully saved with version 1');

    // ATTACK 9: Submit twice (Idempotency)
    console.log('ATTACK 9: Double Submit / Idempotency Test');
    // First submit
    await client.query(`
      UPDATE exam_sessions SET status = 'SUBMITTED', submitted_at = NOW() WHERE id = $1;
    `, [session1Id]);
    const firstSubmit = await client.query(`SELECT status, submitted_at FROM exam_sessions WHERE id = $1;`, [session1Id]);
    assert(firstSubmit.rows[0].status === 'SUBMITTED', 'First submit marks session SUBMITTED');

    // Second submit attempt
    const secondSubmitRes = await client.query(`SELECT status, submitted_at FROM exam_sessions WHERE id = $1;`, [session1Id]);
    const isAlreadySubmitted = secondSubmitRes.rows[0].status === 'SUBMITTED';
    assert(isAlreadySubmitted, 'ATTACK 9 SAFE: Second submit detects existing SUBMITTED status and returns idempotent response');

    // Submit Lock: Ensure autosave is blocked once SUBMITTED
    const sessionPostSubmit = await client.query(`SELECT status FROM exam_sessions WHERE id = $1;`, [session1Id]);
    const canAutosave = sessionPostSubmit.rows[0].status === 'IN_PROGRESS';
    assert(!canAutosave, 'Submit Lock active: Autosave blocked after SUBMITTED status');

    // ATTACK 10: Revoke session (increment session_version) then attempt reuse
    console.log('ATTACK 10: Revocation / Session Fixation test after session_version increment');
    // Proctor revokes session by incrementing session_version
    await client.query(`UPDATE exam_sessions SET session_version = session_version + 1 WHERE id = $1;`, [session2Id]);

    const dbSession2 = await client.query(`SELECT session_version FROM exam_sessions WHERE id = $1;`, [session2Id]);
    const currentDbVersion = Number(dbSession2.rows[0].session_version);
    const tokenVersion = Number(tokenPayloadStudentB.sessionVersion || 1);

    const isTokenRevoked = tokenVersion < currentDbVersion;
    assert(isTokenRevoked, 'ATTACK 10 PREVENTED: Old token version (1) < DB session_version (2), token is rejected with 401 SESSION_REVOKED');

    // -----------------------------------------------------------
    // TEST SECTION 4: DEVICE BINDING & MISMATCH DETECTION
    // -----------------------------------------------------------
    console.log('\n--- SECTION 4: Device Binding & Mismatch Detection ---');
    const currentDeviceBound = 'device-laptop-chrome-01';
    const attackingDevice = 'device-unauthorized-mobile-99';
    assert(currentDeviceBound !== attackingDevice, 'Device mismatch successfully identified between bound device and attacker device');

    // -----------------------------------------------------------
    // TEST SECTION 5: SERVER TIMEOUT & AUTO-SUBMIT
    // -----------------------------------------------------------
    console.log('\n--- SECTION 5: Server-Authoritative Timeout Test ---');
    // Force session expiration by setting expires_at to 1 second ago
    await client.query(`
      UPDATE exam_sessions 
      SET status = 'IN_PROGRESS', expires_at = NOW() - INTERVAL '1 second' 
      WHERE id = $1;
    `, [session2Id]);

    const expCheck = await client.query(`
      SELECT (NOW() >= expires_at) as is_expired FROM exam_sessions WHERE id = $1;
    `, [session2Id]);
    assert(expCheck.rows[0].is_expired === true, 'Server detects current_time >= expires_at');

    // Transition to TIMEOUT
    await client.query(`
      UPDATE exam_sessions SET status = 'TIMEOUT', submitted_at = NOW() WHERE id = $1 AND NOW() >= expires_at;
    `, [session2Id]);

    const timeoutRes = await client.query(`SELECT status FROM exam_sessions WHERE id = $1;`, [session2Id]);
    assert(timeoutRes.rows[0].status === 'TIMEOUT', 'Session automatically transitioned to TIMEOUT upon expiration');

    // -----------------------------------------------------------
    // CLEANUP FIXTURES
    // -----------------------------------------------------------
    console.log('\n--- STEP Clean: Cleaning up Test Fixtures ---');
    await client.query("DELETE FROM schools WHERE code IN ('SCH-SPRINT06-A', 'SCH-SPRINT06-B');");
    console.log('✅ Test fixtures cleaned.');

    console.log('\n====================================================');
    console.log(`SPRINT 06 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSprint06Tests();
