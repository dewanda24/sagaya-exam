import './load-env.mjs';
import { queryPostgres as query } from '../../src/lib/core/postgres.ts';
import {
  listPlatformUsers,
  createPlatformUser,
  updateUserProfile,
  deletePlatformUser,
  getUserAuditTrail,
  listSchoolsSimple,
} from '../../src/lib/services/user.service.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 TESTING USER MANAGEMENT FULL CRUD & AUDIT TRAIL');
  console.log('======================================================\n');

  let testUserId = null;
  let testSchoolId = null;

  const realUserRes = await query(`SELECT id, role, full_name FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1;`);
  const superadminActor = {
    id: realUserRes.rows[0]?.id || 'a0000000-0000-0000-0000-000000000000',
    role: 'SUPERADMIN',
    fullName: realUserRes.rows[0]?.full_name || 'System Superadmin Validator',
    ip: '127.0.0.1',
    userAgent: 'Sprint01-UserMgmtTest/1.0',
  };

  try {
    // 0. Fetch a school for assignment
    const schools = await listSchoolsSimple();
    assert(Array.isArray(schools) && schools.length > 0, `listSchoolsSimple returns active schools (count: ${schools.length})`);
    testSchoolId = schools[0].id;

    // 1. Create User
    console.log('\n--- 1. Testing createPlatformUser ---');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const createRes = await createPlatformUser({
      username: `guru_test_${randomSuffix}`,
      fullName: `Dra. Siti Aminah ${randomSuffix}`,
      role: 'GURU',
      schoolId: testSchoolId,
      nip: `19850101${randomSuffix}2001`,
    }, superadminActor);

    testUserId = createRes.user.id;
    assert(testUserId !== undefined, `User created with ID: ${testUserId}`);
    assert(createRes.tempPassword && createRes.tempPassword.length >= 10, 'Generated secure temporary password');
    assert(createRes.user.role === 'GURU', 'User role is GURU');

    // 2. Edit Profile
    console.log('\n--- 2. Testing updateUserProfile ---');
    const updateRes = await updateUserProfile(testUserId, {
      fullName: `Dra. Siti Aminah M.Pd (Updated ${randomSuffix})`,
      nip: `19850101${randomSuffix}9999`,
    }, superadminActor);

    assert(updateRes.success === true, 'updateUserProfile executed successfully');
    assert(updateRes.user.fullName.includes('M.Pd'), 'Full name updated');
    assert(updateRes.user.nip.includes('9999'), 'NIP updated');

    // 3. User Audit Trail
    console.log('\n--- 3. Testing getUserAuditTrail ---');
    const auditLogs = await getUserAuditTrail(testUserId);
    assert(Array.isArray(auditLogs) && auditLogs.length >= 2, `Audit trail recorded at least 2 events (found: ${auditLogs.length})`);
    assert(auditLogs.some(a => a.action === 'USER_CREATED'), 'Audit trail contains USER_CREATED event');
    assert(auditLogs.some(a => a.action === 'USER_UPDATED'), 'Audit trail contains USER_UPDATED event');

    // 4. List Users includes SUPER_ADMIN
    console.log('\n--- 4. Testing listPlatformUsers with SUPER_ADMIN ---');
    const allUsers = await listPlatformUsers({ role: 'SUPER_ADMIN' });
    assert(allUsers.users.some(u => u.role === 'SUPER_ADMIN'), 'SUPER_ADMIN is now discoverable in listPlatformUsers');

    // 5. Delete User
    console.log('\n--- 5. Testing deletePlatformUser ---');
    const deleteRes = await deletePlatformUser(testUserId, 'Testing cleanup', superadminActor);
    assert(deleteRes.success === true, 'deletePlatformUser executed successfully');

    const checkDeleted = await query(`SELECT id, is_active FROM users WHERE id = $1;`, [testUserId]);
    assert(checkDeleted.rows.length === 0 || checkDeleted.rows[0].is_active === false, 'User record deleted or deactivated');

    const finalAudit = await getUserAuditTrail(testUserId);
    assert(finalAudit.some(a => a.action === 'USER_DELETED'), 'Audit trail contains USER_DELETED event');

    testUserId = null; // Cleaned up
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (testUserId) {
      await query(`DELETE FROM audit_logs WHERE user_id = $1::uuid OR resource_id = $1::text;`, [testUserId]);
      await query(`DELETE FROM user_sessions WHERE user_id = $1;`, [testUserId]);
      await query(`DELETE FROM users WHERE id = $1;`, [testUserId]);
    }
  }

  console.log('\n======================================================');
  console.log(`📊 USER MANAGEMENT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests();
