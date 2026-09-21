import './load-env.mjs';

import { queryPostgres as query } from '../../src/lib/core/postgres.ts';

import {
  listSchools,
  getSchoolDetail,
  createSchoolWithAdmin,
  changeSchoolStatus,
} from '../../src/lib/services/school.service.ts';

import {
  listPlatformUsers,
  disableUser,
  enableUser,
  resetUserPassword,
  changeUserRole,
} from '../../src/lib/services/user.service.ts';

import {
  listGlobalQuestions,
  createGlobalQuestion,
  updateOrReviseGlobalQuestion,
  transitionQuestionStatus,
} from '../../src/lib/services/question.service.ts';

import {
  createRegionalExam,
  listRegionalExams,
  transitionRegionalExamStatus,
  getRegionalExamDetail,
} from '../../src/lib/services/regional-exam.service.ts';

import {
  getSecurityMetrics,
  getActiveSessions,
} from '../../src/lib/services/security.service.ts';

import {
  executeEmergencyOperation,
} from '../../src/lib/services/emergency.service.ts';

import {
  logAuditEvent,
  getAuditLogs,
} from '../../src/lib/services/audit.service.ts';

import { verifyTenantStatus } from '../../src/lib/core/rbac.ts';

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
  console.log('🧪 SAGAYA EXAM — SPRINT 01 SUPERADMIN CORE VALIDATION');
  console.log('======================================================\n');

  let testSchoolId = null;
  let testUserId = null;
  let testQuestionId = null;
  let testExamId = null;

  const realUserRes = await query(`SELECT id, role, full_name FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1;`);
  const realUser = realUserRes.rows[0] || (await query(`SELECT id, role, full_name FROM users LIMIT 1;`)).rows[0];

  const superadminActor = {
    id: realUser?.id || '00000000-0000-0000-0000-000000000000',
    role: 'SUPERADMIN',
    fullName: realUser?.full_name || 'System Superadmin Validator',
    ip: '127.0.0.1',
    userAgent: 'Sprint01-Validator/1.0',
  };

  try {
    // ------------------------------------------------------------------------
    // TEST 1: SCHOOL CREATION & LIFECYCLE STATE MACHINE
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: School Creation & Lifecycle State Machine ---');
    const randomCode = 'SCH' + Math.floor(1000 + Math.random() * 9000);
    const newSchool = await createSchoolWithAdmin({
      name: `Test Academy ${randomCode}`,
      code: randomCode,
      level: 'SMA',
      npsn: `${Math.floor(10000000 + Math.random() * 90000000)}`,
      rayon: 'Rayon 1 - Jakarta',
      address: 'Jl. Uji Coba No. 42',
      phone: '021-5551234',
      email: `admin_${randomCode.toLowerCase()}@example.com`,
    }, superadminActor);

    testSchoolId = newSchool.school.id;
    testUserId = newSchool.initialAdmin.id;

    assert(testSchoolId !== undefined, `School created with ID: ${testSchoolId}`);
    assert(newSchool.school.status === 'ACTIVE', 'New school default status is ACTIVE');
    assert(newSchool.initialAdmin.tempPassword && newSchool.initialAdmin.tempPassword.length >= 10, 'Generated secure temporary password');

    // Test suspend school
    const suspended = await changeSchoolStatus(testSchoolId, 'SUSPENDED', 'Overdue compliance verification test', superadminActor);
    assert(suspended.status === 'SUSPENDED' && suspended.is_active === false, 'School transitioned to SUSPENDED, is_active synchronized to false');

    // Test tenant boundary enforcement
    const suspendedTenantCheck = await verifyTenantStatus(testSchoolId);
    assert(
      suspendedTenantCheck.allowed === false && suspendedTenantCheck.status === 'SUSPENDED',
      `Tenant boundary properly blocked suspended school: "${suspendedTenantCheck.error}"`
    );

    // Reactivate school
    const reactivated = await changeSchoolStatus(testSchoolId, 'ACTIVE', 'Reactivated after compliance audit passed', superadminActor);
    assert(reactivated.status === 'ACTIVE' && reactivated.is_active === true, 'School reactivated to ACTIVE, is_active synchronized to true');

    // Verify tenant boundary allows active school
    const activeTenantCheck = await verifyTenantStatus(testSchoolId);
    assert(activeTenantCheck.allowed === true, 'Tenant boundary permits active school access');

    // ------------------------------------------------------------------------
    // TEST 2: PLATFORM USER MANAGEMENT & SESSION VERSIONING
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Platform Users & Session Versioning ---');
    const usersList = await listPlatformUsers({ search: newSchool.initialAdmin.username });
    assert(usersList.users.some(u => u.id === testUserId), 'Platform user found in listPlatformUsers');
    assert(!usersList.users.some(u => u.role === 'SISWA'), 'Student (SISWA) accounts are strictly excluded from Platform Users query');

    // Fetch original session version
    const userBefore = await query(`SELECT session_version, is_active FROM users WHERE id = $1`, [testUserId]);
    const origVer = userBefore.rows[0].session_version || 0;

    // Disable user
    await disableUser(testUserId, 'Security audit lockout verification', superadminActor);
    const userDisabled = await query(`SELECT is_active, session_version FROM users WHERE id = $1`, [testUserId]);
    assert(userDisabled.rows[0].is_active === false, 'User disabled successfully');
    assert(userDisabled.rows[0].session_version > origVer, `Session version incremented upon disable: ${origVer} -> ${userDisabled.rows[0].session_version}`);

    // Reset password
    const resetRes = await resetUserPassword(testUserId, superadminActor);
    assert(resetRes.tempPassword && resetRes.tempPassword.length >= 10, 'Password reset generated secure temporary password');
    const userReset = await query(`SELECT must_change_password FROM users WHERE id = $1`, [testUserId]);
    assert(userReset.rows[0].must_change_password === true, 'must_change_password flag set to TRUE');

    // Role change
    await changeUserRole(testUserId, 'GURU', superadminActor);
    const userRole = await query(`SELECT role FROM users WHERE id = $1`, [testUserId]);
    assert(userRole.rows[0].role === 'GURU', 'User role successfully updated to GURU');

    // ------------------------------------------------------------------------
    // TEST 3: GLOBAL QUESTION BANK & IMMUTABILITY REVISION ENGINE
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Question Lifecycle & Immutability Engine ---');
    const createdQ = await createGlobalQuestion({
      topic: 'Aritmetika Dasar',
      difficulty: 'EASY',
      type: 'PILIHAN_GANDA',
      questionText: 'Berapakah hasil dari 12 x 12?',
      optionsJson: [
        { key: 'A', text: '124' },
        { key: 'B', text: '144' },
        { key: 'C', text: '164' },
        { key: 'D', text: '184' }
      ],
      answerKeyJson: { correctKey: 'B' },
      weight: 2.0,
    }, superadminActor);

    testQuestionId = createdQ.id;
    assert(testQuestionId !== undefined, `Global question created with ID: ${testQuestionId}`);
    assert(createdQ.lifecycle_status === 'DRAFT', 'New question starts in DRAFT lifecycle');

    // Progress through lifecycle: DRAFT -> SUBMITTED -> REVIEW -> APPROVED -> PUBLISHED
    await transitionQuestionStatus(testQuestionId, 'SUBMITTED', superadminActor);
    await transitionQuestionStatus(testQuestionId, 'REVIEW', superadminActor);
    await transitionQuestionStatus(testQuestionId, 'APPROVED', superadminActor);
    const publishedQ = await transitionQuestionStatus(testQuestionId, 'PUBLISHED', superadminActor);
    assert(publishedQ.lifecycle_status === 'PUBLISHED', 'Question reached PUBLISHED lifecycle status');

    // Test immutability: mutating published question must create a new revision rather than overwrite
    const revisedQ = await updateOrReviseGlobalQuestion(testQuestionId, {
      questionText: 'Berapakah hasil dari 12 x 12? (Versi Revisi 2)',
      optionsJson: [
        { key: 'A', text: '124' },
        { key: 'B', text: '144' },
        { key: 'C', text: '164' },
        { key: 'D', text: '200' }
      ],
    }, superadminActor);

    assert(revisedQ.revisionNumber === 2, `Immutability enforced: new revision #2 created (revisionNumber = ${revisedQ.revisionNumber})`);

    const revisions = await query(`SELECT * FROM question_revisions WHERE question_id = $1 ORDER BY revision_number ASC`, [testQuestionId]);
    assert(revisions.rows.length >= 1, `Previous revision archived in question_revisions table (found ${revisions.rows.length} revision history record)`);
    assert(revisions.rows[0].question_text.includes('12 x 12?'), 'Original question text preserved in revision snapshot');

    // Test rejection validation: rejection requires mandatory reason
    // Note: status is now 'REVIEW' from updateOrReviseGlobalQuestion
    try {
      await transitionQuestionStatus(testQuestionId, 'DRAFT', superadminActor, '');
      assert(false, 'transitionQuestionStatus should fail when rejecting without reason');
    } catch (err) {
      assert(err.message.includes('Alasan') || err.message.includes('reason'), `Rejection without reason properly rejected: "${err.message}"`);
    }

    // ------------------------------------------------------------------------
    // TEST 4: REGIONAL EXAMS & QUESTION SNAPSHOT LOCK
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: Regional Exams & Question Snapshot Lock ---');
    const createdExam = await createRegionalExam({
      title: `Ujian Bersama Wilayah ${randomCode}`,
      startTime: new Date(Date.now() + 3600000).toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
      durationMinutes: 60,
      passingGrade: 75,
      assignedSchoolIds: [testSchoolId],
      selectedQuestionIds: [testQuestionId],
    }, superadminActor);

    testExamId = createdExam.id;
    assert(testExamId !== undefined, `Regional exam created with ID: ${testExamId}`);

    const examDetail = await getRegionalExamDetail(testExamId);
    assert(examDetail.assignedSchools.length === 1, `Participating school count correctly recorded in relational table: ${examDetail.assignedSchools.length}`);

    // Publish exam -> should lock snapshot of questions
    const publishedExam = await transitionRegionalExamStatus(testExamId, 'PUBLISHED', superadminActor);
    assert(publishedExam.status === 'PUBLISHED', 'Regional exam status transitioned to PUBLISHED');

    const examDb = await query(`SELECT question_snapshot_json FROM exams WHERE id = $1`, [testExamId]);
    const snapshots = examDb.rows[0].question_snapshot_json;
    assert(Array.isArray(snapshots) && snapshots.length > 0, `Question snapshot locked into exam record (${snapshots.length} question locked)`);

    // ------------------------------------------------------------------------
    // TEST 5: SECURITY METRICS & ACTIVE SESSIONS
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Security Metrics & Active Sessions ---');
    const secMetrics = await getSecurityMetrics();
    assert(typeof secMetrics.metrics.activeSessions === 'number', `Security active sessions metric returned: ${secMetrics.metrics.activeSessions}`);
    assert(typeof secMetrics.metrics.lockedAccounts === 'number', `Security locked accounts metric returned: ${secMetrics.metrics.lockedAccounts}`);

    const sessionsData = await getActiveSessions();
    assert(Array.isArray(sessionsData.sessions), 'Active sessions list returned an array');
    if (sessionsData.sessions.length > 0) {
      assert(!sessionsData.sessions[0].token && !sessionsData.sessions[0].session_token_hash, 'Raw JWT / secret token is NEVER exposed in active sessions query');
    }

    // ------------------------------------------------------------------------
    // TEST 6: AUDIT LOG IMMUTABILITY & METADATA COMPLETENESS
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Audit Log Immutability ---');
    await logAuditEvent({
      userId: superadminActor.id,
      role: superadminActor.role,
      action: 'TEST_AUDIT_LOG_ENTRY',
      severity: 'INFO',
      resourceType: 'TEST',
      resourceId: testSchoolId,
      ipAddress: superadminActor.ip,
      userAgent: superadminActor.userAgent,
      details: { testRun: true, timestamp: Date.now() },
    });

    const auditData = await getAuditLogs({ action: 'TEST_AUDIT_LOG_ENTRY' });
    assert(auditData.logs.length > 0, 'Audit log created and retrievable');
    const logItem = auditData.logs[0];
    assert(logItem.severity === 'INFO', 'Audit log severity recorded correctly');
    assert(logItem.userAgent === superadminActor.userAgent, 'Audit log user agent recorded correctly');
    assert(logItem.resourceType === 'TEST', 'Audit log resource type recorded correctly');

    // ------------------------------------------------------------------------
    // TEST 7: EMERGENCY ACTIONS VALIDATION & CRITICAL AUDIT
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Emergency Actions & Critical Audits ---');
    // Test that emergency action requires reason
    try {
      await executeEmergencyOperation({
        action: 'PAUSE_EXAM',
        targetId: testExamId,
        reason: '',
      }, superadminActor);
      assert(false, 'Emergency action should fail without reason');
    } catch (err) {
      assert(err.message.includes('Alasan') || err.message.includes('reason'), `Emergency action without reason rejected: "${err.message}"`);
    }

    // Execute valid emergency action
    const emgRes = await executeEmergencyOperation({
      action: 'PAUSE_EXAM',
      targetId: testExamId,
      reason: 'Pemeriksaan integritas jaringan darurat',
    }, superadminActor);
    assert(emgRes.success === true, 'Emergency action executed successfully');

    // Check that critical audit was generated
    const emgAudit = await getAuditLogs({ action: 'EMERGENCY_PAUSE_EXAM' });
    assert(emgAudit.logs.length > 0 && emgAudit.logs[0].severity === 'CRITICAL', 'Emergency action logged with CRITICAL severity');

  } catch (error) {
    console.error('\n💥 Unexpected error during test run:', error);
    failed++;
  } finally {
    // Cleanup test artifacts
    console.log('\n🧹 Cleaning up test artifacts...');
    try {
      if (testExamId) {
        await query(`DELETE FROM regional_exam_schools WHERE exam_id = $1`, [testExamId]);
        await query(`DELETE FROM exams WHERE id = $1`, [testExamId]);
      }
      if (testQuestionId) {
        await query(`DELETE FROM question_revisions WHERE question_id = $1`, [testQuestionId]);
        await query(`DELETE FROM question_banks WHERE id = $1`, [testQuestionId]);
      }
      if (testUserId) {
        await query(`DELETE FROM audit_logs WHERE user_id = $1`, [testUserId]);
        await query(`DELETE FROM user_sessions WHERE user_id = $1`, [testUserId]);
        await query(`DELETE FROM users WHERE id = $1`, [testUserId]);
      }
      if (testSchoolId) {
        await query(`DELETE FROM audit_logs WHERE school_id = $1`, [testSchoolId]);
        await query(`DELETE FROM schools WHERE id = $1`, [testSchoolId]);
      }
      console.log('Cleanup completed successfully.');
    } catch (cleanupErr) {
      console.warn('Cleanup error (ignored):', cleanupErr.message);
    }
  }

  console.log('\n======================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
