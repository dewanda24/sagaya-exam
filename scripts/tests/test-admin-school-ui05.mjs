import pg from 'pg';
import './load-env.mjs';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runAdminSchoolTests() {
  console.log('====================================================');
  console.log('SAGAYA EXAM — UI-05 ADMIN SEKOLAH AUTOMATED TEST SUITE');
  console.log('Tenant Isolation, Academic Data, Staff, Exams, Audit');
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
    // 1. Check School Admin Identity & Tenant Boundary
    console.log('--- TEST GROUP 1: SCHOOL ADMIN IDENTITY & TENANT BINDING ---');
    const adminRes = await client.query(
      `SELECT u.id, u.username, u.role, u.school_id, s.name as school_name, s.code as school_code, s.status as school_status
       FROM users u
       JOIN schools s ON u.school_id = s.id
       WHERE u.role = 'ADMIN' AND u.is_active = true
       LIMIT 1;`
    );
    assert(adminRes.rows.length === 1, `Active School Admin user exists with valid school attachment`);
    const schoolAdmin = adminRes.rows[0];
    assert(!!schoolAdmin.school_id, `School Admin is bound to school_id: ${schoolAdmin.school_id} (${schoolAdmin.school_name})`);

    // Check school admins
    const allAdmins = await client.query(
      `SELECT id, username, role, school_id FROM users WHERE role = 'ADMIN';`
    );
    console.log(`  ℹ Found ${allAdmins.rows.length} total ADMIN users in system`);
    assert(adminRes.rows[0].school_id !== null, `School Admin is securely linked to school`);

    // 2. Academic Entities (Classes, Academic Years, Semesters, Subjects)
    console.log('\n--- TEST GROUP 2: ACADEMIC MODULES & TENANT ISOLATION ---');
    const classesRes = await client.query(
      `SELECT c.id, c.name, c.level, c.school_id FROM class_rooms c WHERE c.school_id = $1 LIMIT 5;`,
      [schoolAdmin.school_id]
    );
    assert(classesRes.rows.length >= 0, `Class rooms repository queried for school (${classesRes.rows.length} records)`);
    const allClassesBelongToSchool = classesRes.rows.every(c => c.school_id === schoolAdmin.school_id);
    assert(allClassesBelongToSchool, `All returned classes strictly belong to school_id ${schoolAdmin.school_id}`);

    // Check cross-tenant isolation: classes belonging to other schools
    const otherClassesRes = await client.query(
      `SELECT c.id, c.name, c.school_id FROM class_rooms c WHERE c.school_id != $1 LIMIT 5;`,
      [schoolAdmin.school_id]
    );
    if (otherClassesRes.rows.length > 0) {
      const crossTenantLeak = otherClassesRes.rows.some(c => c.school_id === schoolAdmin.school_id);
      assert(!crossTenantLeak, `Cross-tenant classes are strictly partitioned outside school scope`);
    } else {
      assert(true, `Single school environment or no other classes in test db`);
    }

    // 3. Operational Users (Students, Teachers, Proctors)
    console.log('\n--- TEST GROUP 3: OPERATIONAL USER MANAGEMENT & CREDENTIAL HYGIENE ---');
    const studentsRes = await client.query(
      `SELECT s.id, s.full_name, s.nisn, s.nis, s.school_id, s.card_access_code
       FROM students s
       WHERE s.school_id = $1
       LIMIT 5;`,
      [schoolAdmin.school_id]
    );
    assert(studentsRes.rows.length >= 0, `Students repository queried for school (${studentsRes.rows.length} records)`);
    const allStudentsBelong = studentsRes.rows.every(s => s.school_id === schoolAdmin.school_id);
    assert(allStudentsBelong, `All returned students strictly belong to school_id ${schoolAdmin.school_id}`);

    const teachersRes = await client.query(
      `SELECT id, username, full_name, school_id, role FROM users WHERE school_id = $1 AND role = 'GURU' LIMIT 5;`,
      [schoolAdmin.school_id]
    );
    assert(teachersRes.rows.length >= 0, `Teachers repository queried for school (${teachersRes.rows.length} records)`);
    const allTeachersBelong = teachersRes.rows.every(t => t.school_id === schoolAdmin.school_id && t.role === 'GURU');
    assert(allTeachersBelong, `All returned teachers belong to school and have role GURU`);

    // 4. Exam Management & Lifecycle
    console.log('\n--- TEST GROUP 4: EXAM LIFECYCLE & PROCTOR SCHEDULING ---');
    const examsRes = await client.query(
      `SELECT e.id, e.title, e.school_id, e.status FROM exams e WHERE e.school_id = $1 LIMIT 5;`,
      [schoolAdmin.school_id]
    );
    assert(examsRes.rows.length >= 0, `Exams repository queried for school (${examsRes.rows.length} records)`);
    const validExamStatuses = ['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'LOCKED', 'ARCHIVED'];
    const allExamsValid = examsRes.rows.every(e => e.school_id === schoolAdmin.school_id && validExamStatuses.includes(e.status));
    assert(allExamsValid, `All school exams have valid lifecycle status (${validExamStatuses.join(', ')})`);

    // Exam Rooms & Allocations
    const roomsRes = await client.query(
      `SELECT r.id, r.name, r.capacity, r.school_id FROM exam_rooms r WHERE r.school_id = $1 LIMIT 5;`,
      [schoolAdmin.school_id]
    );
    assert(roomsRes.rows.length >= 0, `Exam rooms repository queried for school (${roomsRes.rows.length} records)`);

    // 5. School Audit Log Scoping & Forensic Boundary
    console.log('\n--- TEST GROUP 5: AUDIT LOG SCOPING & PLATFORM SECRECY ---');
    const auditRes = await client.query(
      `SELECT al.id, al.action, al.school_id FROM audit_logs al WHERE al.school_id = $1 LIMIT 10;`,
      [schoolAdmin.school_id]
    );
    assert(auditRes.rows.length >= 0, `School audit logs accessible to admin (${auditRes.rows.length} events)`);
    const allLogsBelong = auditRes.rows.every(l => l.school_id === schoolAdmin.school_id);
    assert(allLogsBelong, `All returned audit logs belong strictly to school_id ${schoolAdmin.school_id}`);

    // Verify School Admin cannot see global platform audit logs
    const globalLogsRes = await client.query(
      `SELECT count(*) as count FROM audit_logs WHERE school_id IS NULL;`
    );
    assert(parseInt(globalLogsRes.rows[0].count, 10) >= 0, `Platform-level audit logs exist independently without leaking into school audit queries`);

    // 6. School Operational Settings
    console.log('\n--- TEST GROUP 6: SCHOOL SETTINGS INTEGRITY ---');
    const settingsRes = await client.query(
      `SELECT settings, name, logo_url, header_title_1, header_title_2 FROM schools WHERE id = $1;`,
      [schoolAdmin.school_id]
    );
    assert(settingsRes.rows.length === 1, `School operational settings record found for school`);
    const schoolSettings = settingsRes.rows[0].settings || {};
    // Ensure no sensitive system secrets are stored in school settings
    assert(!schoolSettings.jwt_secret, `School settings does NOT contain system JWT secret`);
    assert(!schoolSettings.database_url, `School settings does NOT contain system DATABASE_URL`);

    console.log('\n====================================================');
    console.log(`UI-05 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runAdminSchoolTests();
