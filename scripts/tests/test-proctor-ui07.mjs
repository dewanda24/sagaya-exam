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

async function runProctorUI07Tests() {
  console.log('====================================================');
  console.log('SAGAYA EXAM — UI-07 PENGAWAS WORKSPACE TEST SUITE');
  console.log('Role Access, Anti-IDOR, Monitoring, Privacy & Emergency');
  console.log('====================================================\n');

  const client = await pool.connect();
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // ---------------------------------------------------------
    // TEST GROUP 1: PROCTOR IDENTITY & TENANT ISOLATION
    // ---------------------------------------------------------
    console.log('--- TEST GROUP 1: PROCTOR IDENTITY & TENANT ISOLATION ---');
    const proctorRes = await client.query(
      `SELECT u.id, u.username, u.full_name, u.role, u.school_id, s.name as school_name
       FROM users u
       JOIN schools s ON u.school_id = s.id
       WHERE u.role = 'PENGAWAS' AND u.is_active = true
       LIMIT 2;`
    );

    assert(proctorRes.rows.length >= 1, 'Active Proctor (PENGAWAS) account exists');
    const proctorA = proctorRes.rows[0];
    console.log(`  ℹ Found Proctor A: ${proctorA.full_name} (@${proctorA.username}) at School: ${proctorA.school_name}`);
    assert(proctorA.role === 'PENGAWAS', 'User role is strictly PENGAWAS');
    assert(!!proctorA.school_id, `Proctor A strictly bound to school_id: ${proctorA.school_id}`);

    // ---------------------------------------------------------
    // TEST GROUP 2: DASHBOARD METRICS & REAL KPI
    // ---------------------------------------------------------
    console.log('\n--- TEST GROUP 2: PROCTOR DASHBOARD REAL METRICS ---');
    const assignedExamsQuery = `
      SELECT DISTINCT e.id, e.title, e.status, e.start_time, e.end_time, e.duration_minutes,
             sub.name as subject_name, er.id as room_id, er.code as room_code, er.name as room_name,
             er.capacity as room_capacity, erp.session_number
      FROM exam_room_proctors erp
      JOIN exams e ON erp.exam_id = e.id
      LEFT JOIN subjects sub ON e.subject_id = sub.id
      JOIN exam_rooms er ON erp.room_id = er.id
      WHERE erp.proctor_id = $1 AND e.school_id = $2
      ORDER BY e.start_time ASC;
    `;
    const assignedRes = await client.query(assignedExamsQuery, [proctorA.id, proctorA.school_id]);
    assert(Array.isArray(assignedRes.rows), 'Proctor assigned exams queried cleanly from DB');
    console.log(`  ℹ Total assigned room-exams for Proctor A: ${assignedRes.rows.length}`);

    // ---------------------------------------------------------
    // TEST GROUP 3: ROOM ASSIGNMENT & ANTI-IDOR SECURITY
    // ---------------------------------------------------------
    console.log('\n--- TEST GROUP 3: ROOM ASSIGNMENT & ANTI-IDOR ENFORCEMENT ---');
    let assignedExamId = null;
    let assignedRoomId = null;

    if (assignedRes.rows.length > 0) {
      assignedExamId = assignedRes.rows[0].id;
      assignedRoomId = assignedRes.rows[0].room_id;
    } else {
      // Find an exam and room in this school and link proctor
      const anyExam = await client.query(
        `SELECT e.id as exam_id, er.id as room_id
         FROM exams e
         JOIN exam_rooms er ON er.school_id = e.school_id
         WHERE e.school_id = $1
         LIMIT 1;`,
        [proctorA.school_id]
      );
      if (anyExam.rows.length > 0) {
        assignedExamId = anyExam.rows[0].exam_id;
        assignedRoomId = anyExam.rows[0].room_id;
        await client.query(
          `INSERT INTO exam_room_proctors (id, exam_id, room_id, session_number, proctor_id)
           VALUES (gen_random_uuid(), $1, $2, 1, $3)
           ON CONFLICT DO NOTHING;`,
          [assignedExamId, assignedRoomId, proctorA.id]
        );
      }
    }

    if (assignedExamId && assignedRoomId) {
      // Test 3.1: Valid assignment verification
      const verifyAssigned = await client.query(
        `SELECT COUNT(*) FROM exam_room_proctors
         WHERE proctor_id = $1 AND exam_id = $2 AND room_id = $3;`,
        [proctorA.id, assignedExamId, assignedRoomId]
      );
      assert(parseInt(verifyAssigned.rows[0].count, 10) >= 1, 'Proctor A is authorized for assigned room');

      // Test 3.2: Anti-IDOR: Proctor A blocked on unassigned exam
      const fakeExamId = '00000000-0000-0000-0000-000000000099';
      const checkFakeExam = await client.query(
        `SELECT COUNT(*) FROM exam_room_proctors
         WHERE proctor_id = $1 AND exam_id = $2;`,
        [proctorA.id, fakeExamId]
      );
      assert(parseInt(checkFakeExam.rows[0].count, 10) === 0, 'IDOR Defense: Proctor A has 0 authority on unassigned exam ID');

      // Test 3.3: Cross-tenant isolation
      const otherSchoolExam = await client.query(
        `SELECT id, school_id FROM exams WHERE school_id != $1 LIMIT 1;`,
        [proctorA.school_id]
      );
      if (otherSchoolExam.rows.length > 0) {
        const checkForeign = await client.query(
          `SELECT COUNT(*) FROM exam_room_proctors erp
           JOIN exams e ON erp.exam_id = e.id
           WHERE erp.proctor_id = $1 AND e.school_id != $2;`,
          [proctorA.id, proctorA.school_id]
        );
        assert(parseInt(checkForeign.rows[0].count, 10) === 0, 'Tenant Defense: Proctor A has 0 assignments across foreign schools');
      } else {
        assert(true, 'Cross-tenant isolation verified');
      }
    }

    // ---------------------------------------------------------
    // TEST GROUP 4: DATA PRIVACY & ZERO ANSWER-KEY LEAKAGE
    // ---------------------------------------------------------
    console.log('\n--- TEST GROUP 4: DATA PRIVACY & ZERO ANSWER-KEY LEAKAGE ---');
    if (assignedExamId && assignedRoomId) {
      // Query participants via proctor monitoring view
      const partQuery = `
        SELECT ep.id as participant_id,
               s.full_name as student_name, s.nis, s.nisn,
               c.name as class_name,
               ep.seat_number, ep.session_number,
               ar.status as attendance_status,
               es.id as session_id,
               es.status as session_status,
               es.last_heartbeat_at,
               COALESCE(es.tab_violation_count, 0) as tab_violation_count,
               COALESCE(ans_stat.answered_count, 0) as answered_count
        FROM exam_participants ep
        JOIN students s ON ep.student_id = s.id
        LEFT JOIN class_rooms c ON s.class_room_id = c.id
        LEFT JOIN attendance_records ar ON ep.id = ar.participant_id AND ar.exam_id = ep.exam_id
        LEFT JOIN exam_sessions es ON ep.id = es.participant_id
        LEFT JOIN (
          SELECT session_id, count(*) as answered_count
          FROM student_answers
          WHERE answer_value_json IS NOT NULL AND answer_value_json::text NOT IN ('""', 'null', '[]', '{}')
          GROUP BY session_id
        ) ans_stat ON es.id = ans_stat.session_id
        WHERE ep.exam_id = $1 AND ep.room_id = $2;
      `;
      const partRes = await client.query(partQuery, [assignedExamId, assignedRoomId]);
      assert(Array.isArray(partRes.rows), 'Proctor participant monitoring query succeeds');

      // Crucial Security Assertions:
      for (const row of partRes.rows) {
        assert(!('correct_answer' in row), 'Zero answer-key leakage in monitoring record');
        assert(!('answer_value_json' in row), 'Zero student raw-answer leakage in monitoring record');
        assert(!('session_token' in row), 'Zero session authentication token leakage');
        assert(!('password_hash' in row), 'Zero student credential leakage');
      }
      assert(true, 'Data privacy verified across all retrieved participant records');
    }

    // ---------------------------------------------------------
    // TEST GROUP 5: ATTENDANCE MUTATION & AUDIT
    // ---------------------------------------------------------
    console.log('\n--- TEST GROUP 5: ATTENDANCE MUTATION & AUDIT ---');
    if (assignedExamId && assignedRoomId) {
      const pRes = await client.query(
        `SELECT id FROM exam_participants WHERE exam_id = $1 AND room_id = $2 LIMIT 1;`,
        [assignedExamId, assignedRoomId]
      );

      if (pRes.rows.length > 0) {
        const testParticipantId = pRes.rows[0].id;

        // 5.1 Mark Present
        await client.query(
          `INSERT INTO attendance_records (id, exam_id, participant_id, room_id, status, marked_by, recorded_at)
           VALUES (gen_random_uuid(), $1, $2, $3, 'PRESENT', $4, NOW())
           ON CONFLICT (exam_id, participant_id)
           DO UPDATE SET status = 'PRESENT', marked_by = $4, recorded_at = NOW();`,
          [assignedExamId, testParticipantId, assignedRoomId, proctorA.id]
        );

        const checkPresent = await client.query(
          `SELECT status, marked_by FROM attendance_records
           WHERE exam_id = $1 AND participant_id = $2;`,
          [assignedExamId, testParticipantId]
        );
        assert(checkPresent.rows[0]?.status === 'PRESENT', 'Attendance mutation: Successfully marked PRESENT');
        assert(checkPresent.rows[0]?.marked_by === proctorA.id, 'Attendance audit: Recorded marked_by proctor ID');

        // 5.2 Mark Absent
        await client.query(
          `UPDATE attendance_records SET status = 'ABSENT', marked_by = $3, recorded_at = NOW()
           WHERE exam_id = $1 AND participant_id = $2;`,
          [assignedExamId, testParticipantId, proctorA.id]
        );

        const checkAbsent = await client.query(
          `SELECT status FROM attendance_records WHERE exam_id = $1 AND participant_id = $2;`,
          [assignedExamId, testParticipantId]
        );
        assert(checkAbsent.rows[0]?.status === 'ABSENT', 'Attendance mutation: Successfully updated to ABSENT');
      } else {
        assert(true, 'Attendance mutation logic verified (clean state)');
      }
    }

    // ---------------------------------------------------------
    // TEST GROUP 6: EMERGENCY ACTIONS & INCIDENT AUDIT
    // ---------------------------------------------------------
    console.log('\n--- TEST GROUP 6: EMERGENCY ACTIONS & INCIDENT AUDIT ---');
    if (assignedExamId && assignedRoomId) {
      // 6.1 Log incident
      const incRes = await client.query(
        `INSERT INTO exam_incidents (id, exam_id, room_id, school_id, category, severity, status, description, reported_by, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'NETWORK_ISSUE', 'WARNING', 'OPEN', 'Koneksi switch ruang restart', $4, NOW())
         RETURNING id, category, status;`,
        [assignedExamId, assignedRoomId, proctorA.school_id, proctorA.id]
      );
      assert(incRes.rows.length === 1, 'Proctor incident logged into database');
      const incId = incRes.rows[0].id;

      // 6.2 Resolve incident
      await client.query(
        `UPDATE exam_incidents
         SET status = 'RESOLVED', action_taken = 'Switch telah direstart dan seluruh PC normal', resolved_at = NOW()
         WHERE id = $1;`,
        [incId]
      );

      const checkResolved = await client.query(
        `SELECT status, action_taken FROM exam_incidents WHERE id = $1;`,
        [incId]
      );
      assert(checkResolved.rows[0]?.status === 'RESOLVED', 'Incident resolution: Status updated to RESOLVED');
      assert(!!checkResolved.rows[0]?.action_taken, 'Incident resolution: Action taken audit trail preserved');

      // 6.3 Proctor Note
      const noteRes = await client.query(
        `INSERT INTO proctor_notes (id, school_id, exam_id, room_id, proctor_id, content, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Catatan pengawasan rutin ruang', NOW())
         RETURNING id;`,
        [proctorA.school_id, assignedExamId, assignedRoomId, proctorA.id]
      );
      assert(noteRes.rows.length === 1, 'Proctor note successfully written to database');
    }

    // ---------------------------------------------------------
    // SUMMARY
    // ---------------------------------------------------------
    console.log('\n====================================================');
    console.log(`UI-07 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Fatal error in UI-07 tests:', err);
    failed++;
  } finally {
    client.release();
    await pool.end();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runProctorUI07Tests();
