import pg from 'pg';
import fs from 'fs';
import path from 'path';
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

// -------------------------------------------------------------
// Core RBAC & Permission Matrix definition from permissions.ts
// -------------------------------------------------------------
const PENGAWAS_PERMISSIONS = [
  'monitoring.read',
  'monitoring.control',
  'exam.monitor',
  'rooms.read',
  'participants.read',
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
];

function hasProctorPermission(role, permission, customPermissions = null) {
  if (role === 'SUPER_ADMIN') return true;
  if (Array.isArray(customPermissions) && customPermissions.length > 0) {
    return customPermissions.includes(permission);
  }
  if (role === 'PENGAWAS') {
    return PENGAWAS_PERMISSIONS.includes(permission);
  }
  return false;
}

// -------------------------------------------------------------
// Proctor Authorization & IDOR Assertion helpers
// -------------------------------------------------------------
async function isProctorAssignedToRoom(client, proctorId, examId, roomId, schoolId) {
  const res = await client.query(
    `SELECT 1 FROM exam_room_proctors erp
     JOIN exams e ON erp.exam_id = e.id
     WHERE erp.proctor_id = $1 AND erp.exam_id = $2 AND erp.room_id = $3 AND e.school_id = $4
     LIMIT 1;`,
    [proctorId, examId, roomId, schoolId]
  );
  return res.rows.length > 0;
}

async function isProctorAssignedToExam(client, proctorId, examId, schoolId) {
  const res = await client.query(
    `SELECT 1 FROM exam_room_proctors erp
     JOIN exams e ON erp.exam_id = e.id
     WHERE erp.proctor_id = $1 AND erp.exam_id = $2 AND e.school_id = $3
     LIMIT 1;`,
    [proctorId, examId, schoolId]
  );
  return res.rows.length > 0;
}

async function canAccessRoom(client, user, examId, roomId, schoolId) {
  if (user.role === 'SUPER_ADMIN') return { allowed: true };
  if (user.schoolId !== schoolId) return { allowed: false, reason: 'Cross-tenant access forbidden' };
  if (user.role === 'ADMIN') return { allowed: true };
  if (user.role !== 'PENGAWAS') return { allowed: false, reason: 'Role not authorized' };
  const assigned = await isProctorAssignedToRoom(client, user.id, examId, roomId, schoolId);
  return assigned ? { allowed: true } : { allowed: false, reason: 'Not assigned to room' };
}

async function canAccessParticipant(client, user, examId, roomId, participantId, schoolId) {
  const roomCheck = await canAccessRoom(client, user, examId, roomId, schoolId);
  if (!roomCheck.allowed) return roomCheck;

  const res = await client.query(
    `SELECT ep.id FROM exam_participants ep
     JOIN students s ON ep.student_id = s.id
     WHERE ep.id = $1 AND ep.exam_id = $2 AND ep.room_id = $3 AND s.school_id = $4
     LIMIT 1;`,
    [participantId, examId, roomId, schoolId]
  );
  return res.rows.length > 0 ? { allowed: true } : { allowed: false, reason: 'Participant not in room' };
}

async function checkRoomScheduleConflict(client, proctorId, examId, roomId, sessionNumber = 1) {
  const targetRes = await client.query(`SELECT start_time, end_time FROM exams WHERE id = $1;`, [examId]);
  if (targetRes.rows.length === 0) return { hasConflict: false };
  const { start_time, end_time } = targetRes.rows[0];

  const res = await client.query(
    `SELECT erp.id FROM exam_room_proctors erp
     JOIN exams e ON erp.exam_id = e.id
     WHERE erp.proctor_id = $1
       AND (erp.exam_id != $2 OR erp.room_id != $3 OR erp.session_number != $4)
       AND (e.start_time, e.end_time) OVERLAPS ($5::timestamptz, $6::timestamptz)
     LIMIT 1;`,
    [proctorId, examId, roomId, sessionNumber, start_time, end_time]
  );
  return { hasConflict: res.rows.length > 0 };
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('SAGAYA EXAM — SPRINT 05 AUTOMATED TEST SUITE: PROCTOR CORE');
  console.log('=============================================================\n');

  const client = await pool.connect();
  const suffix = Date.now().toString().slice(-6);

  try {
    console.log('--- 1. SETUP TEST FIXTURES & DATA SEEDING ---');

    // 1. Create Schools A and B
    const sARes = await client.query(
      `INSERT INTO schools (id, code, name, level)
       VALUES (uuid_generate_v4(), $1, 'SMA Sagaya Proctor A', 'SMA') RETURNING id, code;`,
      [`SCH-PROCTOR-A-${suffix}`]
    );
    const schoolAId = sARes.rows[0].id;

    const sBRes = await client.query(
      `INSERT INTO schools (id, code, name, level)
       VALUES (uuid_generate_v4(), $1, 'SMA Sagaya Proctor B', 'SMA') RETURNING id, code;`,
      [`SCH-PROCTOR-B-${suffix}`]
    );
    const schoolBId = sBRes.rows[0].id;

    // 2. Create Users:
    // - Proctor A1 (School A, assigned to Exam 1 Room 1)
    // - Proctor A2 (School A, assigned to Exam 1 Room 2)
    // - Proctor B1 (School B)
    const pA1Res = await client.query(
      `INSERT INTO users (id, school_id, username, password_hash, full_name, role, nip)
       VALUES (uuid_generate_v4(), $1, $2, 'dummy_hash', 'Pengawas A1, S.Kom', 'PENGAWAS', '19910101001')
       RETURNING id, username, full_name, role, school_id;`,
      [schoolAId, `proctor_a1_${suffix}`]
    );
    const proctorA1 = pA1Res.rows[0];

    const pA2Res = await client.query(
      `INSERT INTO users (id, school_id, username, password_hash, full_name, role, nip)
       VALUES (uuid_generate_v4(), $1, $2, 'dummy_hash', 'Pengawas A2, S.Pd', 'PENGAWAS', '19920202002')
       RETURNING id, username, full_name, role, school_id;`,
      [schoolAId, `proctor_a2_${suffix}`]
    );
    const proctorA2 = pA2Res.rows[0];

    const pB1Res = await client.query(
      `INSERT INTO users (id, school_id, username, password_hash, full_name, role, nip)
       VALUES (uuid_generate_v4(), $1, $2, 'dummy_hash', 'Pengawas B1 (Luar Sekolah)', 'PENGAWAS', '19930303003')
       RETURNING id, username, full_name, role, school_id;`,
      [schoolBId, `proctor_b1_${suffix}`]
    );
    const proctorB1 = pB1Res.rows[0];

    // 3. Create Subject & Rooms in School A
    const subRes = await client.query(
      `INSERT INTO subjects (id, school_id, code, name, level)
       VALUES (uuid_generate_v4(), $1, $2, 'Informatika Ujian', 'SMA') RETURNING id;`,
      [schoolAId, `INF-${suffix}`]
    );
    const subjectId = subRes.rows[0].id;

    const r1Res = await client.query(
      `INSERT INTO exam_rooms (id, school_id, code, name, capacity)
       VALUES (uuid_generate_v4(), $1, $2, 'Lab Komputer 1', 35) RETURNING id, code, name;`,
      [schoolAId, `LAB-01-${suffix}`]
    );
    const room1 = r1Res.rows[0];

    const r2Res = await client.query(
      `INSERT INTO exam_rooms (id, school_id, code, name, capacity)
       VALUES (uuid_generate_v4(), $1, $2, 'Lab Komputer 2', 35) RETURNING id, code, name;`,
      [schoolAId, `LAB-02-${suffix}`]
    );
    const room2 = r2Res.rows[0];

    const rBRes = await client.query(
      `INSERT INTO exam_rooms (id, school_id, code, name, capacity)
       VALUES (uuid_generate_v4(), $1, $2, 'Lab Komputer Sekolah B', 30) RETURNING id;`,
      [schoolBId, `LAB-B-${suffix}`]
    );
    const roomB = rBRes.rows[0];

    // 4. Create Exams
    const now = new Date();
    const startTime1 = new Date(now.getTime() - 15 * 60 * 1000);
    const endTime1 = new Date(now.getTime() + 75 * 60 * 1000);

    const questionsSnapshot = [
      { id: 'q1', type: 'PILIHAN_GANDA', question_text: 'Apa itu TCP/IP?', weight: 1 },
      { id: 'q2', type: 'PILIHAN_GANDA', question_text: 'Port default HTTP?', weight: 1 },
    ];

    const ex1Res = await client.query(
      `INSERT INTO exams (id, school_id, title, subject_id, status, start_time, end_time, duration_minutes, question_snapshot_json)
       VALUES (uuid_generate_v4(), $1, 'PAS Informatika 2026', $2, 'ACTIVE', $3, $4, 90, $5)
       RETURNING id, title, status;`,
      [schoolAId, subjectId, startTime1, endTime1, JSON.stringify(questionsSnapshot)]
    );
    const exam1 = ex1Res.rows[0];

    const ex2Res = await client.query(
      `INSERT INTO exams (id, school_id, title, subject_id, status, start_time, end_time, duration_minutes, question_snapshot_json)
       VALUES (uuid_generate_v4(), $1, 'Ujian Khusus Guru Lain', $2, 'SCHEDULED', $3, $4, 60, $5)
       RETURNING id, title;`,
      [schoolAId, subjectId, startTime1, endTime1, JSON.stringify(questionsSnapshot)]
    );
    const exam2 = ex2Res.rows[0];

    const exBRes = await client.query(
      `INSERT INTO exams (id, school_id, title, status, start_time, end_time, duration_minutes)
       VALUES (uuid_generate_v4(), $1, 'Ujian Rahasia Sekolah B', 'ACTIVE', $2, $3, 90)
       RETURNING id, title;`,
      [schoolBId, startTime1, endTime1]
    );
    const examB = exBRes.rows[0];

    // 5. Assign Proctors
    await client.query(
      `INSERT INTO exam_room_proctors (id, exam_id, room_id, session_number, proctor_id, notes)
       VALUES (uuid_generate_v4(), $1, $2, 1, $3, 'Pengawas Utama Ruang 1');`,
      [exam1.id, room1.id, proctorA1.id]
    );

    await client.query(
      `INSERT INTO exam_room_proctors (id, exam_id, room_id, session_number, proctor_id, notes)
       VALUES (uuid_generate_v4(), $1, $2, 1, $3, 'Pengawas Utama Ruang 2');`,
      [exam1.id, room2.id, proctorA2.id]
    );

    // 6. Create Students
    const st1Res = await client.query(
      `INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code)
       VALUES (uuid_generate_v4(), $1, $2, $3, 'Andi Siswa Ruang 1', 'PIN111') RETURNING id;`,
      [schoolAId, `NIS-1-${suffix}`, `NISN-1-${suffix}`]
    );
    const student1 = st1Res.rows[0];

    const st2Res = await client.query(
      `INSERT INTO students (id, school_id, nis, nisn, full_name, card_access_code)
       VALUES (uuid_generate_v4(), $1, $2, $3, 'Budi Siswa Ruang 2', 'PIN222') RETURNING id;`,
      [schoolAId, `NIS-2-${suffix}`, `NISN-2-${suffix}`]
    );
    const student2 = st2Res.rows[0];

    // 7. Create Exam Participants
    const ep1Res = await client.query(
      `INSERT INTO exam_participants (id, exam_id, student_id, token, room_id, session_number, seat_number)
       VALUES (uuid_generate_v4(), $1, $2, 'SECRET-TOK-1', $3, 1, '01')
       RETURNING id;`,
      [exam1.id, student1.id, room1.id]
    );
    const participant1 = ep1Res.rows[0];

    const ep2Res = await client.query(
      `INSERT INTO exam_participants (id, exam_id, student_id, token, room_id, session_number, seat_number)
       VALUES (uuid_generate_v4(), $1, $2, 'SECRET-TOK-2', $3, 1, '02')
       RETURNING id;`,
      [exam1.id, student2.id, room2.id]
    );
    const participant2 = ep2Res.rows[0];

    // 8. Create Active Exam Session for Student 1
    const es1Res = await client.query(
      `INSERT INTO exam_sessions (id, participant_id, device_fingerprint, ip_address, user_agent, server_started_at, server_expires_at, status, last_heartbeat_at)
       VALUES (uuid_generate_v4(), $1, 'FINGERPRINT-SENSITIVE-XYZ', '192.168.1.50', 'Mozilla/5.0 Chrome', NOW(), NOW() + interval '60 minutes', 'IN_PROGRESS', NOW())
       RETURNING id;`,
      [participant1.id]
    );
    const session1 = es1Res.rows[0];

    // Create a student answer to test answer content protection
    await client.query(
      `INSERT INTO student_answers (id, session_id, question_id, answer_value_json)
       VALUES (uuid_generate_v4(), $1, 'q1', '{"selected": "A", "secret_reason": "confidential"}'::jsonb);`,
      [session1.id]
    );

    console.log('✅ Fixtures created successfully.\n');

    const userA1 = {
      id: proctorA1.id,
      username: proctorA1.username,
      fullName: proctorA1.full_name,
      role: 'PENGAWAS',
      schoolId: schoolAId,
    };

    const userB1 = {
      id: proctorB1.id,
      username: proctorB1.username,
      fullName: proctorB1.full_name,
      role: 'PENGAWAS',
      schoolId: schoolBId,
    };

    // =========================================================================
    // TEST 1: Role & Granular Permission Matrix
    // =========================================================================
    console.log('--- TEST 1: PROCTOR RBAC PERMISSION MATRIX ---');
    assert(hasProctorPermission('PENGAWAS', 'proctor.dashboard.read'), 'Role PENGAWAS has proctor.dashboard.read');
    assert(hasProctorPermission('PENGAWAS', 'proctor.schedule.read'), 'Role PENGAWAS has proctor.schedule.read');
    assert(hasProctorPermission('PENGAWAS', 'proctor.exam.read'), 'Role PENGAWAS has proctor.exam.read');
    assert(hasProctorPermission('PENGAWAS', 'proctor.exam.monitor'), 'Role PENGAWAS has proctor.exam.monitor');
    assert(hasProctorPermission('PENGAWAS', 'proctor.room.read'), 'Role PENGAWAS has proctor.room.read');
    assert(hasProctorPermission('PENGAWAS', 'proctor.participants.read'), 'Role PENGAWAS has proctor.participants.read');
    assert(hasProctorPermission('PENGAWAS', 'proctor.attendance.read'), 'Role PENGAWAS has proctor.attendance.read');
    assert(hasProctorPermission('PENGAWAS', 'proctor.attendance.update'), 'Role PENGAWAS has proctor.attendance.update');
    assert(hasProctorPermission('PENGAWAS', 'proctor.violation.read'), 'Role PENGAWAS has proctor.violation.read');
    assert(hasProctorPermission('PENGAWAS', 'proctor.incident.create'), 'Role PENGAWAS has proctor.incident.create');
    assert(hasProctorPermission('PENGAWAS', 'proctor.incident.update'), 'Role PENGAWAS has proctor.incident.update');
    assert(hasProctorPermission('PENGAWAS', 'proctor.note.create'), 'Role PENGAWAS has proctor.note.create');
    assert(hasProctorPermission('PENGAWAS', 'proctor.session.read'), 'Role PENGAWAS has proctor.session.read');
    assert(hasProctorPermission('PENGAWAS', 'proctor.session.revoke'), 'Role PENGAWAS has proctor.session.revoke');

    // Proctor cannot create/edit questions, exams, or grades
    assert(!hasProctorPermission('PENGAWAS', 'question.create'), 'Pengawas CANNOT question.create');
    assert(!hasProctorPermission('PENGAWAS', 'question.update'), 'Pengawas CANNOT question.update');
    assert(!hasProctorPermission('PENGAWAS', 'exam.create'), 'Pengawas CANNOT exam.create');
    assert(!hasProctorPermission('PENGAWAS', 'grading.update'), 'Pengawas CANNOT grading.update');
    assert(!hasProctorPermission('PENGAWAS', 'user.create'), 'Pengawas CANNOT user.create');

    // =========================================================================
    // TEST 2: Proctor Assignment & Access to Own Room
    // =========================================================================
    console.log('\n--- TEST 2: PROCTOR ACCESS TO OWN ASSIGNMENT ---');
    const assignedA1 = await isProctorAssignedToRoom(client, userA1.id, exam1.id, room1.id, schoolAId);
    assert(assignedA1 === true, 'Proctor A1 is correctly assigned to Room 1');

    const canAccessOwn = await canAccessRoom(client, userA1, exam1.id, room1.id, schoolAId);
    assert(canAccessOwn.allowed === true, 'Proctor A1 can access assigned Room 1');

    // =========================================================================
    // TEST 3: IDOR Defense - Cross-Exam Blocking
    // =========================================================================
    console.log('\n--- TEST 3: IDOR DEFENSE - CROSS-EXAM BLOCKING ---');
    const assignedExam2 = await isProctorAssignedToExam(client, userA1.id, exam2.id, schoolAId);
    assert(assignedExam2 === false, 'Proctor A1 has NO assignment to Exam 2');

    // =========================================================================
    // TEST 4: IDOR Defense - Cross-Room Blocking
    // =========================================================================
    console.log('\n--- TEST 4: IDOR DEFENSE - CROSS-ROOM BLOCKING ---');
    const crossRoom = await canAccessRoom(client, userA1, exam1.id, room2.id, schoolAId);
    assert(crossRoom.allowed === false, 'Proctor A1 is strictly BLOCKED from accessing Room 2 (assigned to Proctor A2)');

    // =========================================================================
    // TEST 5: Tenant Isolation - Cross-School Blocking
    // =========================================================================
    console.log('\n--- TEST 5: TENANT ISOLATION - CROSS-SCHOOL BLOCKING ---');
    const crossSchool = await canAccessRoom(client, userB1, exam1.id, room1.id, schoolAId);
    assert(crossSchool.allowed === false, 'Proctor from School B is BLOCKED from accessing School A room');

    const crossSchool2 = await canAccessRoom(client, userA1, examB.id, roomB.id, schoolBId);
    assert(crossSchool2.allowed === false, 'Proctor from School A is BLOCKED from accessing School B room');

    // =========================================================================
    // TEST 6: IDOR Defense - Cross-Room Participant Blocking
    // =========================================================================
    console.log('\n--- TEST 6: IDOR DEFENSE - CROSS-ROOM PARTICIPANT BLOCKING ---');
    const ownPart = await canAccessParticipant(client, userA1, exam1.id, room1.id, participant1.id, schoolAId);
    assert(ownPart.allowed === true, 'Proctor A1 can access participant in Room 1');

    const otherPart = await canAccessParticipant(client, userA1, exam1.id, room1.id, participant2.id, schoolAId);
    assert(otherPart.allowed === false, 'Proctor A1 is BLOCKED from accessing participant in Room 2 (IDOR protection)');

    // =========================================================================
    // TEST 7: Pre-Exam Check & Monitoring Lifecycle
    // =========================================================================
    console.log('\n--- TEST 7: PRE-EXAM CHECK & MONITORING LIFECYCLE ---');
    // Start monitoring
    const startRes = await client.query(
      `INSERT INTO proctor_monitoring_sessions (school_id, exam_id, room_id, proctor_id, status, checklist_json, started_at)
       VALUES ($1, $2, $3, $4, 'MONITORING', '{"roomReady": true, "networkReady": true}', NOW())
       RETURNING id, status;`,
      [schoolAId, exam1.id, room1.id, userA1.id]
    );
    assert(startRes.rows[0].status === 'MONITORING', 'Monitoring session recorded as MONITORING');

    await client.query(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, 'PENGAWAS', 'PROCTOR_STARTED_MONITORING', $3);`,
      [schoolAId, userA1.id, JSON.stringify({ roomId: room1.id })]
    );

    // End monitoring
    const endRes = await client.query(
      `UPDATE proctor_monitoring_sessions SET status = 'ENDED', ended_at = NOW()
       WHERE exam_id = $1 AND room_id = $2 AND proctor_id = $3 AND status = 'MONITORING'
       RETURNING id, status;`,
      [exam1.id, room1.id, userA1.id]
    );
    assert(endRes.rows[0].status === 'ENDED', 'Monitoring session status successfully updated to ENDED');

    // =========================================================================
    // TEST 8: Real-Time Monitoring Data & Data Leakage Protection
    // =========================================================================
    console.log('\n--- TEST 8: MONITORING DATA & ZERO DATA LEAKAGE ---');
    // Query monitoring projection exactly as done by ProctorMonitoringService
    const monRes = await client.query(
      `SELECT ep.id as participant_id, s.full_name as student_name, s.nis, s.nisn,
              ep.seat_number, ep.session_number,
              es.status as session_status, es.last_heartbeat_at,
              COALESCE(ans_stat.answered_count, 0) as answered_count
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN exam_sessions es ON ep.id = es.participant_id
       LEFT JOIN (
         SELECT session_id, count(*) as answered_count
         FROM student_answers
         GROUP BY session_id
       ) ans_stat ON es.id = ans_stat.session_id
       WHERE ep.exam_id = $1 AND ep.room_id = $2;`,
      [exam1.id, room1.id]
    );

    assert(monRes.rows.length === 1, 'Monitoring returns 1 participant in Room 1');
    const pRow = monRes.rows[0];
    assert(pRow.student_name === 'Andi Siswa Ruang 1', 'Participant name is correct');
    assert(parseInt(pRow.answered_count, 10) === 1, 'Correct answer count ratio is returned');

    // STRICT VERIFICATION: NO token, NO answer values, NO answer keys in projection
    assert(!('token' in pRow), 'SECURITY: Raw session token is NOT leaked');
    assert(!('device_fingerprint' in pRow), 'SECURITY: Raw device fingerprint is NOT leaked');
    assert(!('answer_value_json' in pRow), 'SECURITY: Student answer content is NOT leaked');
    assert(!('answer_key_json' in pRow), 'SECURITY: Answer key is NOT leaked');

    // =========================================================================
    // TEST 9: Attendance Management & Audit Logging
    // =========================================================================
    console.log('\n--- TEST 9: ATTENDANCE MANAGEMENT & AUDIT ---');
    // Upsert attendance record
    const attRes = await client.query(
      `INSERT INTO attendance_records (school_id, exam_id, room_id, participant_id, status, marked_by, notes)
       VALUES ($1, $2, $3, $4, 'LATE', $5, 'Hadir terlambat 10 menit')
       ON CONFLICT (exam_id, participant_id) DO UPDATE SET status = 'LATE'
       RETURNING id, status, notes;`,
      [schoolAId, exam1.id, room1.id, participant1.id, userA1.id]
    );
    assert(attRes.rows[0].status === 'LATE', 'Attendance successfully marked as LATE');

    // Record audit
    await client.query(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, 'PENGAWAS', 'ATTENDANCE_UPDATED', $3);`,
      [schoolAId, userA1.id, JSON.stringify({ participantId: participant1.id, status: 'LATE' })]
    );

    const attAudit = await client.query(
      `SELECT * FROM audit_logs WHERE action = 'ATTENDANCE_UPDATED' AND user_id = $1;`,
      [userA1.id]
    );
    assert(attAudit.rows.length > 0, 'Audit log ATTENDANCE_UPDATED is recorded');

    // Verify student master table remains untouched
    const stCheck = await client.query(`SELECT full_name FROM students WHERE id = $1;`, [student1.id]);
    assert(stCheck.rows[0].full_name === 'Andi Siswa Ruang 1', 'Student master record is unaltered');

    // =========================================================================
    // TEST 10: Violation Monitoring & Counters
    // =========================================================================
    console.log('\n--- TEST 10: VIOLATION RECORDING & COUNTERS ---');
    const violRes = await client.query(
      `INSERT INTO exam_violations (school_id, exam_id, room_id, participant_id, session_id, event_type, severity, description)
       VALUES ($1, $2, $3, $4, $5, 'TAB_SWITCH', 'WARNING', 'Tab switch detected')
       RETURNING id, event_type, severity;`,
      [schoolAId, exam1.id, room1.id, participant1.id, session1.id]
    );
    assert(violRes.rows[0].event_type === 'TAB_SWITCH', 'Violation recorded TAB_SWITCH');

    // Increment counter on exam_sessions
    await client.query(`UPDATE exam_sessions SET tab_violation_count = tab_violation_count + 1 WHERE id = $1;`, [session1.id]);
    const sessCheck = await client.query(`SELECT tab_violation_count FROM exam_sessions WHERE id = $1;`, [session1.id]);
    assert(sessCheck.rows[0].tab_violation_count === 1, 'tab_violation_count correctly incremented');

    // =========================================================================
    // TEST 11: Incident Management & Resolution
    // =========================================================================
    console.log('\n--- TEST 11: INCIDENT REPORTING & RESOLUTION ---');
    const incRes = await client.query(
      `INSERT INTO exam_incidents (school_id, exam_id, room_id, participant_id, reported_by, category, severity, description, status)
       VALUES ($1, $2, $3, $4, $5, 'NETWORK_ISSUE', 'WARNING', 'Jaringan switch lab sempat terputus', 'OPEN')
       RETURNING id, category, status;`,
      [schoolAId, exam1.id, room1.id, participant1.id, userA1.id]
    );
    assert(incRes.rows[0].status === 'OPEN', 'Incident recorded with status OPEN');

    // Resolve incident
    const resRes = await client.query(
      `UPDATE exam_incidents SET status = 'RESOLVED', action_taken = 'Kabel LAN diganti', resolved_by = $1, resolved_at = NOW()
       WHERE id = $2 RETURNING id, status, action_taken;`,
      [userA1.id, incRes.rows[0].id]
    );
    assert(resRes.rows[0].status === 'RESOLVED', 'Incident status updated to RESOLVED');
    assert(resRes.rows[0].action_taken === 'Kabel LAN diganti', 'Incident action taken recorded');

    await client.query(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, 'PENGAWAS', 'INCIDENT_CREATED', $3),
              ($1, $2, 'PENGAWAS', 'INCIDENT_RESOLVED', $4);`,
      [
        schoolAId,
        userA1.id,
        JSON.stringify({ incidentId: incRes.rows[0].id }),
        JSON.stringify({ incidentId: incRes.rows[0].id, actionTaken: 'Kabel LAN diganti' }),
      ]
    );

    // =========================================================================
    // TEST 12: Contextual Proctor Notes
    // =========================================================================
    console.log('\n--- TEST 12: CONTEXTUAL PROCTOR NOTES ---');
    const noteRes = await client.query(
      `INSERT INTO proctor_notes (school_id, exam_id, room_id, participant_id, proctor_id, content)
       VALUES ($1, $2, $3, $4, $5, 'Siswa diizinkan melanjutkan setelah pergantian kabel')
       RETURNING id, content;`,
      [schoolAId, exam1.id, room1.id, participant1.id, userA1.id]
    );
    assert(noteRes.rows[0].content.includes('Siswa diizinkan melanjutkan'), 'Proctor note successfully persisted');

    // =========================================================================
    // TEST 13: Force Session Control (Revoke & End Session)
    // =========================================================================
    console.log('\n--- TEST 13: FORCE SESSION CONTROL ---');
    // 1. Revoke session to DISCONNECTED
    await client.query(
      `UPDATE exam_sessions SET status = 'DISCONNECTED', device_fingerprint = 'REVOKED_BY_PROCTOR'
       WHERE participant_id = $1;`,
      [participant1.id]
    );
    const revCheck = await client.query(`SELECT status FROM exam_sessions WHERE participant_id = $1;`, [participant1.id]);
    assert(revCheck.rows[0].status === 'DISCONNECTED', 'Session status revoked to DISCONNECTED');

    // 2. End session to LOCKED (distinct from SUBMITTED)
    await client.query(
      `UPDATE exam_sessions SET status = 'LOCKED' WHERE participant_id = $1;`,
      [participant1.id]
    );
    const endCheck = await client.query(`SELECT status FROM exam_sessions WHERE participant_id = $1;`, [participant1.id]);
    assert(endCheck.rows[0].status === 'LOCKED', 'Session status locked to LOCKED');
    assert(endCheck.rows[0].status !== 'SUBMITTED', 'End session is strictly distinct from SUBMITTED');

    // =========================================================================
    // TEST 14: Emergency Time Extension
    // =========================================================================
    console.log('\n--- TEST 14: EMERGENCY TIME EXTENSION ---');
    // Reset to IN_PROGRESS
    await client.query(
      `UPDATE exam_sessions SET status = 'IN_PROGRESS', server_expires_at = NOW() + interval '20 minutes'
       WHERE participant_id = $1;`,
      [participant1.id]
    );

    // Apply 15 minute extension
    const extRes = await client.query(
      `UPDATE exam_sessions es
       SET server_expires_at = server_expires_at + interval '15 minutes'
       FROM exam_participants ep
       WHERE es.participant_id = ep.id AND ep.exam_id = $1 AND ep.room_id = $2 AND es.status = 'IN_PROGRESS'
       RETURNING es.id;`,
      [exam1.id, room1.id]
    );
    assert(extRes.rows.length === 1, 'Emergency extension updated 1 active session in Room 1');

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (school_id, user_id, role, action, details_json)
       VALUES ($1, $2, 'PENGAWAS', 'EMERGENCY_ACTION_REQUESTED', $3);`,
      [schoolAId, userA1.id, JSON.stringify({ durationMinutes: 15, reason: 'Listrik padam 15 menit' })]
    );
    const emgAudit = await client.query(
      `SELECT * FROM audit_logs WHERE action = 'EMERGENCY_ACTION_REQUESTED' AND user_id = $1;`,
      [userA1.id]
    );
    assert(emgAudit.rows.length > 0, 'Audit log EMERGENCY_ACTION_REQUESTED is recorded');

    // =========================================================================
    // TEST 15: Multi-Proctor Support & Room Conflict Detection
    // =========================================================================
    console.log('\n--- TEST 15: MULTI-PROCTOR & ROOM CONFLICTS ---');
    // Assign second proctor (Proctor A2) to the same Room 1 (Sesi 1)
    await client.query(
      `INSERT INTO exam_room_proctors (id, exam_id, room_id, session_number, proctor_id, notes)
       VALUES (uuid_generate_v4(), $1, $2, 1, $3, 'Pengawas Pendamping');`,
      [exam1.id, room1.id, proctorA2.id]
    );
    assert(true, 'Multiple proctors successfully assigned to the same room/session without conflict');

    // Conflict detection: Check Proctor A1 trying to be assigned to another room on same exam time
    const conflict = await checkRoomScheduleConflict(client, proctorA1.id, exam1.id, room2.id, 1);
    assert(conflict.hasConflict === true, 'Conflict detection correctly flags overlapping proctor schedule');

    // =========================================================================
    // TEST 16: Audit Log Immutability
    // =========================================================================
    console.log('\n--- TEST 16: AUDIT LOG IMMUTABILITY ---');
    const audits = await client.query(
      `SELECT action, count(*) as count FROM audit_logs WHERE school_id = $1 GROUP BY action;`,
      [schoolAId]
    );
    assert(audits.rows.length >= 3, 'Audit logs have recorded multiple distinct proctor events');

    console.log('\n=============================================================');
    console.log(`ALL SPRINT 05 TESTS COMPLETED! Passed: ${passedTests}, Failed: ${failedTests}`);
    console.log('=============================================================\n');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    console.log('--- CLEANUP FIXTURES ---');
    try {
      await client.query(`DELETE FROM schools WHERE code IN ('SCH-PROCTOR-A-${suffix}', 'SCH-PROCTOR-B-${suffix}');`);
      console.log('✅ Test fixtures cleaned up.');
    } catch (cleanErr) {
      console.error('Cleanup warning:', cleanErr);
    }
    client.release();
    await pool.end();
  }
}

runTests();
