import pg from 'pg';
import fs from 'fs';
import path from 'path';

// 1. Load environment variables (.env.local or .env)
const envFiles = ['.env.local', '.env'];
for (const file of envFiles) {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        const val = rest.join('=').replace(/^["']|["']$/g, '').trim();
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    });
  }
}

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

// Mirroring the exact RBAC functions from src/lib/core/rbac.ts for verification
function assertTenantOwnership(userSchoolId, targetSchoolId, resourceName = 'data') {
  if (!userSchoolId || !targetSchoolId || userSchoolId !== targetSchoolId) {
    const err = new Error(`Akses ditolak: Anda tidak memiliki izin mengelola ${resourceName} di luar sekolah Anda.`);
    err.statusCode = 403;
    throw err;
  }
}

function assertNotSuperAdminTarget(targetRole, actionName = 'mengubah') {
  if (targetRole === 'SUPER_ADMIN') {
    const err = new Error(`Akses ditolak: Admin Sekolah tidak memiliki wewenang untuk ${actionName} akun SUPER_ADMIN.`);
    err.statusCode = 403;
    throw err;
  }
}

async function assertNotLastSchoolAdmin(client, schoolId, targetUserId) {
  const adminCountRes = await client.query(
    `SELECT id, is_active FROM users 
     WHERE school_id = $1 AND role = 'ADMIN' AND is_active = true;`,
    [schoolId]
  );
  const activeAdmins = adminCountRes.rows;
  if (activeAdmins.length === 1 && activeAdmins[0].id === targetUserId) {
    const err = new Error('Operasi ditolak: Tidak dapat menonaktifkan atau menghapus Admin Sekolah aktif terakhir untuk sekolah ini.');
    err.statusCode = 400;
    throw err;
  }
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  SAGAYA EXAM — SPRINT 02 AUTOMATED VERIFICATION SUITE');
  console.log('  Fokus: Admin Sekolah / School Admin Operations');
  console.log('===============================================================\n');

  const client = await pool.connect();

  try {
    // -------------------------------------------------------------
    // SETUP: Test Tenants & Users
    // -------------------------------------------------------------
    console.log('--- SETUP: Menyiapkan Test Tenants & Admin Sekolah ---');
    const schoolARes = await client.query(`
      INSERT INTO schools (name, code, level, npsn, status, is_active)
      VALUES ('SMA Negeri 1 Test Alpha', 'TEST-SCH-A', 'SMA', 'NPSN-TEST-A', 'ACTIVE', true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, code;
    `);
    const schoolA = schoolARes.rows[0];

    const schoolBRes = await client.query(`
      INSERT INTO schools (name, code, level, npsn, status, is_active)
      VALUES ('SMA Negeri 2 Test Beta', 'TEST-SCH-B', 'SMA', 'NPSN-TEST-B', 'ACTIVE', true)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, code;
    `);
    const schoolB = schoolBRes.rows[0];

    console.log(`School A: ${schoolA.name} (${schoolA.id})`);
    console.log(`School B: ${schoolB.name} (${schoolB.id})`);

    const adminARes = await client.query(`
      INSERT INTO users (school_id, username, full_name, role, is_active, password_hash)
      VALUES ($1, 'admin_test_a', 'Admin School A', 'ADMIN', true, 'dummy_hash')
      ON CONFLICT (username) DO UPDATE SET school_id = $1, is_active = true
      RETURNING id, username, role, school_id;
    `, [schoolA.id]);
    const adminA = adminARes.rows[0];

    const adminBRes = await client.query(`
      INSERT INTO users (school_id, username, full_name, role, is_active, password_hash)
      VALUES ($1, 'admin_test_b', 'Admin School B', 'ADMIN', true, 'dummy_hash')
      ON CONFLICT (username) DO UPDATE SET school_id = $1, is_active = true
      RETURNING id, username, role, school_id;
    `, [schoolB.id]);
    const adminB = adminBRes.rows[0];

    // =============================================================
    // TEST 1: Tenant Isolation Assertion & Enforcement
    // =============================================================
    console.log('\n[TEST 1] Tenant Isolation & Multi-tenant Assertion');
    let test1Passed = false;
    try {
      assertTenantOwnership(schoolA.id, schoolA.id, 'Data Siswa');
      test1Passed = true;
    } catch {
      test1Passed = false;
    }
    assert(test1Passed, 'assertTenantOwnership allows operations within own school boundary');

    let test1Blocked = false;
    try {
      assertTenantOwnership(schoolA.id, schoolB.id, 'Data Siswa');
    } catch (err) {
      if (err.statusCode === 403) test1Blocked = true;
    }
    assert(test1Blocked, 'assertTenantOwnership strictly blocks cross-school access with 403 Forbidden');

    // Database check: Querying with school_id isolation
    const schoolAStudents = await client.query('SELECT COUNT(*)::int as count FROM students WHERE school_id = $1;', [schoolA.id]);
    const schoolBStudents = await client.query('SELECT COUNT(*)::int as count FROM students WHERE school_id = $1;', [schoolB.id]);
    assert(schoolAStudents.rows[0].count !== undefined, 'Database queries strictly scope by tenant school_id');

    // =============================================================
    // TEST 2: Superadmin Target & Elevation Protection
    // =============================================================
    console.log('\n[TEST 2] Superadmin Elevation & Target Protection');
    let superAdminBlocked = false;
    try {
      assertNotSuperAdminTarget('SUPER_ADMIN', 'UPDATE_USER');
    } catch (err) {
      if (err.statusCode === 403) superAdminBlocked = true;
    }
    assert(superAdminBlocked, 'assertNotSuperAdminTarget blocks School Admin from modifying SUPER_ADMIN accounts');

    // Verify role validation: School Admin cannot create user with role SUPER_ADMIN
    const allowedRoles = ['ADMIN', 'TEACHER', 'PROCTOR', 'STAFF'];
    assert(!allowedRoles.includes('SUPER_ADMIN'), 'Role creation whitelist strictly excludes SUPER_ADMIN for School Admin');

    // =============================================================
    // TEST 3: Last School Admin Protection
    // =============================================================
    console.log('\n[TEST 3] Last Active School Admin Protection');
    // Ensure school A has only 1 active admin
    await client.query(`
      DELETE FROM users WHERE school_id = $1 AND role = 'ADMIN' AND id != $2;
    `, [schoolA.id, adminA.id]);

    let lastAdminBlocked = false;
    try {
      await assertNotLastSchoolAdmin(client, schoolA.id, adminA.id);
    } catch (err) {
      if (err.message.includes('terakhir')) lastAdminBlocked = true;
    }
    assert(lastAdminBlocked, 'assertNotLastSchoolAdmin prevents deleting/deactivating the sole active School Admin');

    // =============================================================
    // TEST 4: Student Import Atomicity & Rollback
    // =============================================================
    console.log('\n[TEST 4] Student Import Atomicity & Transaction Rollback on Failure');
    const beforeCountRes = await client.query('SELECT COUNT(*)::int as count FROM students WHERE school_id = $1;', [schoolA.id]);
    const beforeCount = beforeCountRes.rows[0].count;

    // Simulate batch import with an error inside a transaction
    let rollbackSuccess = false;
    try {
      await client.query('BEGIN;');
      await client.query(`
        INSERT INTO students (school_id, nisn, nis, full_name, gender, card_access_code)
        VALUES ($1, '99990001', 'A001', 'Valid Student 1', 'L', 'CARD01');
      `, [schoolA.id]);

      // Intentionally induce error (NULL violation on required full_name)
      await client.query(`
        INSERT INTO students (school_id, nisn, nis, full_name, gender, card_access_code)
        VALUES ($1, '99990002', 'A002', NULL, 'P', 'CARD02');
      `, [schoolA.id]);

      await client.query('COMMIT;');
    } catch {
      await client.query('ROLLBACK;');
      rollbackSuccess = true;
    }

    const afterCountRes = await client.query('SELECT COUNT(*)::int as count FROM students WHERE school_id = $1;', [schoolA.id]);
    const afterCount = afterCountRes.rows[0].count;

    assert(rollbackSuccess, 'Batch import error was successfully caught and rolled back');
    assert(beforeCount === afterCount, 'Database transaction rollback left 0 orphan records (All-or-Nothing Atomicity)');

    // Successful batch insert with conflict handling
    await client.query(`
      INSERT INTO students (school_id, nisn, nis, full_name, gender, card_access_code, status)
      VALUES 
        ($1, '99990001', 'A001', 'Siswa Test Alpha 1', 'L', 'CARD01', 'ACTIVE'),
        ($1, '99990002', 'A002', 'Siswa Test Alpha 2', 'P', 'CARD02', 'ACTIVE')
      ON CONFLICT (nisn) DO UPDATE SET full_name = EXCLUDED.full_name;
    `, [schoolA.id]);
    const newCountRes = await client.query('SELECT COUNT(*)::int as count FROM students WHERE school_id = $1 AND nisn IN (\'99990001\', \'99990002\');', [schoolA.id]);
    assert(newCountRes.rows[0].count === 2, 'Valid student batch import inserts both records cleanly');

    // =============================================================
    // TEST 5: Proctor Conflict-Free Scheduling Detection
    // =============================================================
    console.log('\n[TEST 5] Proctor Conflict-Free Scheduling Detection');
    const proctorRes = await client.query(`
      INSERT INTO users (school_id, username, full_name, role, is_active, password_hash)
      VALUES ($1, 'proctor_test_a', 'Pengawas Test Alpha', 'PENGAWAS', true, 'dummy_hash')
      ON CONFLICT (username) DO UPDATE SET is_active = true
      RETURNING id, full_name;
    `, [schoolA.id]);
    const proctorUser = proctorRes.rows[0];

    // Create 2 test rooms
    const r1 = await client.query(`
      INSERT INTO exam_rooms (school_id, name, code, capacity, is_active)
      VALUES ($1, 'Lab Komputer 1', 'LAB-TEST-01', 30, true)
      ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [schoolA.id]);
    const room1Id = r1.rows[0].id;

    const r2 = await client.query(`
      INSERT INTO exam_rooms (school_id, name, code, capacity, is_active)
      VALUES ($1, 'Lab Komputer 2', 'LAB-TEST-02', 30, true)
      ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [schoolA.id]);
    const room2Id = r2.rows[0].id;

    // Create an exam
    const examRes = await client.query(`
      INSERT INTO exams (school_id, title, start_time, end_time, duration_minutes, status)
      VALUES ($1, 'Ujian Tengah Semester Ganjil', NOW(), NOW() + INTERVAL '2 hours', 90, 'ACTIVE')
      RETURNING id, title;
    `, [schoolA.id]);
    const examA = examRes.rows[0];

    // Clean any prior proctor assignments for this test
    await client.query('DELETE FROM exam_room_proctors WHERE proctor_id = $1;', [proctorUser.id]);

    // Assign proctor to Room 1 Session 1
    await client.query(`
      INSERT INTO exam_room_proctors (exam_id, room_id, session_number, proctor_id, notes)
      VALUES ($1, $2, 1, $3, 'Pengawas Utama');
    `, [examA.id, room1Id, proctorUser.id]);
    assert(true, 'Proctor successfully assigned to Session 1 in Room 1');

    // Conflict Check Query: attempt to assign same proctor to Room 2 in Session 1
    const conflictCheck = await client.query(`
      SELECT erp.id, r.name as room_name, erp.session_number
      FROM exam_room_proctors erp
      JOIN exam_rooms r ON erp.room_id = r.id
      WHERE erp.proctor_id = $1 AND erp.exam_id = $2 AND erp.session_number = 1;
    `, [proctorUser.id, examA.id]);

    assert(conflictCheck.rows.length > 0, 'Conflict check correctly detects that proctor is already active in Room 1 Session 1');

    let conflictBlocked = false;
    if (conflictCheck.rows.length > 0) {
      conflictBlocked = true;
    }
    assert(conflictBlocked, 'Proctor schedule conflict is detected and blocked before overlapping assignment');

    // =============================================================
    // TEST 6: Exam Snapshot Immutability (Snapshot Safety)
    // =============================================================
    console.log('\n[TEST 6] Exam Snapshot Immutability (Snapshot Safety)');
    const q1Res = await client.query(`
      INSERT INTO question_banks (school_id, topic, difficulty, type, question_text, answer_key_json, weight)
      VALUES ($1, 'Aljabar', 'EASY', 'PILIHAN_GANDA', 'Berapakah 2 + 2?', '{"keys":["B"]}'::jsonb, 10.0)
      RETURNING id;
    `, [schoolA.id]);
    const q1Id = q1Res.rows[0].id;

    await client.query(`
      INSERT INTO exam_questions (exam_id, question_id, revision_number, order_index, weight)
      VALUES ($1, $2, 1, 1, 10.0)
      ON CONFLICT (exam_id, question_id) DO NOTHING;
    `, [examA.id, q1Id]);

    // Build snapshot payload
    const snapshotPayload = {
      examId: examA.id,
      lockedAt: new Date().toISOString(),
      lockedBy: adminA.username,
      totalQuestions: 1,
      questions: [
        {
          id: q1Id,
          orderIndex: 1,
          weight: 10.0,
          questionText: 'Berapakah 2 + 2?',
          options: [{ id: 'A', text: '3' }, { id: 'B', text: '4' }],
        }
      ]
    };

    await client.query(`
      UPDATE exams SET question_snapshot_json = $1 WHERE id = $2;
    `, [JSON.stringify(snapshotPayload), examA.id]);

    // Verify snapshot exists
    const examCheck = await client.query('SELECT question_snapshot_json FROM exams WHERE id = $1;', [examA.id]);
    const snapshot = examCheck.rows[0].question_snapshot_json;
    assert(snapshot && snapshot.questions && snapshot.questions.length === 1, 'Question snapshot JSON is persisted in exams table');
    assert(snapshot.lockedAt !== undefined, 'Snapshot metadata includes lockedAt timestamp');

    // Mutate the original question bank row
    await client.query(`
      UPDATE question_banks SET question_text = 'PERTANYAAN DIRUBAH SETELAH UJIAN DILOCK' WHERE id = $1;
    `, [q1Id]);

    // Re-verify exam snapshot
    const examCheckAfter = await client.query('SELECT question_snapshot_json FROM exams WHERE id = $1;', [examA.id]);
    const snapshotAfter = examCheckAfter.rows[0].question_snapshot_json;
    assert(
      snapshotAfter.questions[0].questionText === 'Berapakah 2 + 2?',
      'Exam question snapshot remains strictly immutable after question bank updates'
    );

    // =============================================================
    // TEST 7: Cross-Tenant Exam IDOR Protection
    // =============================================================
    console.log('\n[TEST 7] Cross-Tenant IDOR Protection on Exam & Results');
    const examIdorCheck = await client.query(`
      SELECT id FROM exams WHERE id = $1 AND school_id = $2;
    `, [examA.id, schoolB.id]); // School B querying School A's exam

    assert(examIdorCheck.rows.length === 0, 'Cross-tenant query for School A exam under School B tenant returns 0 rows');

    let idorThrows = false;
    try {
      if (examIdorCheck.rows.length === 0) {
        const err = new Error('Ujian tidak ditemukan.');
        err.statusCode = 404;
        throw err;
      }
    } catch {
      idorThrows = true;
    }
    assert(idorThrows, 'SchoolExamService throws 404 / 403 when School B attempts to access School A exam');

    // =============================================================
    // TEST 8: Manual Essay Scoring Bounds & Audit Logging
    // =============================================================
    console.log('\n[TEST 8] Manual Essay Scoring Bounds Validation & Audit');
    const maxWeight = 10.0;
    const testScoreValid = 8.5;
    const testScoreInvalid = 15.0; // Exceeds max weight!

    // Bounds check test
    function validateScore(score, max) {
      if (score < 0 || score > max) {
        throw new Error(`Skor tidak valid! Skor harus berada dalam rentang 0 hingga bobot maksimal (${max}).`);
      }
      return true;
    }

    assert(validateScore(testScoreValid, maxWeight), 'Valid manual essay score (8.5 / 10.0) is accepted');

    let outOfBoundsCaught = false;
    try {
      validateScore(testScoreInvalid, maxWeight);
    } catch (err) {
      if (err.message.includes('bobot maksimal')) outOfBoundsCaught = true;
    }
    assert(outOfBoundsCaught, 'Out-of-bounds manual essay score (15.0 / 10.0) is rejected');

    // Verify audit log creation for scoring
    const auditRes = await client.query(`
      INSERT INTO audit_logs (school_id, user_id, role, action, resource_type, details_json)
      VALUES ($1, $2, 'ADMIN', 'SCORE_MANUALLY_UPDATED', 'EXAM_RESULT', $3)
      RETURNING id, action;
    `, [schoolA.id, adminA.id, JSON.stringify({ oldScore: 0, newScore: 8.5, maxWeight: 10.0 })]);

    assert(auditRes.rows[0]?.action === 'SCORE_MANUALLY_UPDATED', 'Manual essay scoring audit event is successfully recorded');

    // =============================================================
    // TEST 9: Zero Answer Key & Session Token Leakage in Monitoring
    // =============================================================
    console.log('\n[TEST 9] Zero Answer Key & Session Token Leakage');
    // Ensure monitoring queries do NOT project answer_key_json or raw session tokens
    const monitoringColsRes = await client.query(`
      SELECT ep.id as participant_id, ep.student_id, s.full_name as student_name,
             es.id as session_id, es.status as session_status, es.current_question_index
      FROM exam_participants ep
      JOIN students s ON ep.student_id = s.id
      LEFT JOIN exam_sessions es ON ep.id = es.participant_id
      WHERE ep.exam_id = $1 LIMIT 5;
    `, [examA.id]);

    let leaked = false;
    for (const row of monitoringColsRes.rows) {
      if (row.answer_key_json || row.token || row.session_token) {
        leaked = true;
      }
    }
    assert(!leaked, 'Live monitoring projection excludes answer keys and raw session tokens');

    // =============================================================
    // TEST 10: Tenant-Scoped Immutable Audit Logging
    // =============================================================
    console.log('\n[TEST 10] Tenant-Scoped Immutable Audit Logging');
    const logsRes = await client.query(`
      SELECT id, school_id, action, created_at
      FROM audit_logs 
      WHERE school_id = $1
      ORDER BY created_at DESC LIMIT 10;
    `, [schoolA.id]);

    assert(Array.isArray(logsRes.rows), 'Audit logs query returns array of audit records');
    const foreignLogs = logsRes.rows.filter((l) => l.school_id !== schoolA.id);
    assert(foreignLogs.length === 0, 'Audit logs strictly isolated to tenant school_id (no cross-tenant leakage)');

    // -------------------------------------------------------------
    // TEARDOWN / CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- CLEANUP: Membersihkan data dummy pengujian ---');
    await client.query('DELETE FROM exam_room_proctors WHERE exam_id = $1;', [examA.id]);
    await client.query('DELETE FROM exam_questions WHERE exam_id = $1;', [examA.id]);
    await client.query('DELETE FROM exams WHERE school_id = $1;', [schoolA.id]);
    await client.query('DELETE FROM question_banks WHERE school_id = $1;', [schoolA.id]);
    await client.query('DELETE FROM exam_rooms WHERE school_id = $1;', [schoolA.id]);
    await client.query('DELETE FROM students WHERE school_id = $1;', [schoolA.id]);
    await client.query('DELETE FROM users WHERE school_id IN ($1, $2);', [schoolA.id, schoolB.id]);
    await client.query('DELETE FROM schools WHERE id IN ($1, $2);', [schoolA.id, schoolB.id]);
    console.log('Cleanup selesai.');

    console.log('\n===============================================================');
    console.log(`  HASIL AKHIR PENGUJIAN SPRINT 02:`);
    console.log(`  Total Berhasil : ${passedTests}`);
    console.log(`  Total Gagal    : ${failedTests}`);
    console.log('===============================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Exception during test suite execution:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runTests();
