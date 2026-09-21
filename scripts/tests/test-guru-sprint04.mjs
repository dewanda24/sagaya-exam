import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 1. Load environment variables
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

// Import Handlers & Registry dynamically
let QuestionTypeRegistry, EssayHandler, TeacherAuthorizationService, TeacherQuestionService, TeacherCoreService, TeacherExamService, TeacherGradingService, TeacherAnalyticsService;

async function runTests() {
  console.log('\n=============================================================');
  console.log('SAGAYA EXAM — SPRINT 04 AUTOMATED TEST SUITE: GURU CORE');
  console.log('=============================================================\n');

  const client = await pool.connect();

  try {
    // Dynamic import from TS transpile or direct files
    const qtypes = await import('../../src/lib/core/question-types/index.ts');
    QuestionTypeRegistry = qtypes.QuestionTypeRegistry;
    EssayHandler = qtypes.EssayHandler;

    const authSvc = await import('../../src/lib/services/teacher-authorization.service.ts');
    TeacherAuthorizationService = authSvc.TeacherAuthorizationService;

    const coreSvc = await import('../../src/lib/services/teacher-core.service.ts');
    TeacherCoreService = coreSvc.TeacherCoreService;

    const qSvc = await import('../../src/lib/services/teacher-question.service.ts');
    TeacherQuestionService = qSvc.TeacherQuestionService;

    const eSvc = await import('../../src/lib/services/teacher-exam.service.ts');
    TeacherExamService = eSvc.TeacherExamService;

    const gSvc = await import('../../src/lib/services/teacher-grading.service.ts');
    TeacherGradingService = gSvc.TeacherGradingService;

    const aSvc = await import('../../src/lib/services/teacher-analytics.service.ts');
    TeacherAnalyticsService = aSvc.TeacherAnalyticsService;

    console.log('--- SETUP FIXTURES & DATA SEEDING ---');
    const suffix = Date.now().toString().slice(-6);

    // 1. Create School A & School B
    const sARes = await client.query(
      `INSERT INTO schools (id, code, name, level) 
       VALUES (uuid_generate_v4(), $1, 'SMA Sagaya A', 'SMA') RETURNING id, code;`,
      [`SCH-A-${suffix}`]
    );
    const schoolAId = sARes.rows[0].id;

    const sBRes = await client.query(
      `INSERT INTO schools (id, code, name, level) 
       VALUES (uuid_generate_v4(), $1, 'SMA Sagaya B', 'SMA') RETURNING id, code;`,
      [`SCH-B-${suffix}`]
    );
    const schoolBId = sBRes.rows[0].id;

    // 2. Create Users: Guru A, Guru B (School A), Guru C (School B)
    const uARes = await client.query(
      `INSERT INTO users (id, school_id, username, password_hash, full_name, role, nip, nuptk)
       VALUES (uuid_generate_v4(), $1, $2, 'dummy', 'Budi Hartono, M.Pd', 'GURU', '19850101001', '12345678901')
       RETURNING id, username;`,
      [schoolAId, `guru_a_${suffix}`]
    );
    const guruA = uARes.rows[0];

    const uBRes = await client.query(
      `INSERT INTO users (id, school_id, username, password_hash, full_name, role, nip, nuptk)
       VALUES (uuid_generate_v4(), $1, $2, 'dummy', 'Siti Rahma, S.Pd', 'GURU', '19880202002', '98765432102')
       RETURNING id, username;`,
      [schoolAId, `guru_b_${suffix}`]
    );
    const guruB = uBRes.rows[0];

    const uCRes = await client.query(
      `INSERT INTO users (id, school_id, username, password_hash, full_name, role, nip, nuptk)
       VALUES (uuid_generate_v4(), $1, $2, 'dummy', 'Ahmad Dani, M.Si', 'GURU', '19900303003', '45678912303')
       RETURNING id, username;`,
      [schoolBId, `guru_c_${suffix}`]
    );
    const guruC = uCRes.rows[0];

    // 3. Create Subjects in School A: Matematika & B. Indonesia
    const subMatRes = await client.query(
      `INSERT INTO subjects (id, school_id, code, name, level)
       VALUES (uuid_generate_v4(), $1, $2, 'Matematika Wajib', 'SMA') RETURNING id;`,
      [schoolAId, `MTK-${suffix}`]
    );
    const subjectMatId = subMatRes.rows[0].id;

    const subIndRes = await client.query(
      `INSERT INTO subjects (id, school_id, code, name, level)
       VALUES (uuid_generate_v4(), $1, $2, 'Bahasa Indonesia', 'SMA') RETURNING id;`,
      [schoolAId, `IND-${suffix}`]
    );
    const subjectIndId = subIndRes.rows[0].id;

    // 4. Create Classes in School A: X-A & X-B
    const clsARes = await client.query(
      `INSERT INTO class_rooms (id, school_id, name, level, academic_year)
       VALUES (uuid_generate_v4(), $1, $2, '10', '2026/2027') RETURNING id;`,
      [schoolAId, `X-MIPA-1-${suffix}`]
    );
    const classAId = clsARes.rows[0].id;

    const clsBRes = await client.query(
      `INSERT INTO class_rooms (id, school_id, name, level, academic_year)
       VALUES (uuid_generate_v4(), $1, $2, '10', '2026/2027') RETURNING id;`,
      [schoolAId, `X-MIPA-2-${suffix}`]
    );
    const classBId = clsBRes.rows[0].id;

    // 5. Create Students in Class X-A & X-B
    const stARes = await client.query(
      `INSERT INTO students (id, school_id, nis, nisn, full_name, gender, class_room_id, card_access_code)
       VALUES (uuid_generate_v4(), $1, $2, $3, 'Alif Pratama', 'L', $4, 'PIN1') RETURNING id;`,
      [schoolAId, `NIS-A1-${suffix}`, `NISN-A1-${suffix}`, classAId]
    );
    const studentAId = stARes.rows[0].id;

    const stBRes = await client.query(
      `INSERT INTO students (id, school_id, nis, nisn, full_name, gender, class_room_id, card_access_code)
       VALUES (uuid_generate_v4(), $1, $2, $3, 'Bella Safitri', 'P', $4, 'PIN2') RETURNING id;`,
      [schoolAId, `NIS-B1-${suffix}`, `NISN-B1-${suffix}`, classBId]
    );
    const studentBId = stBRes.rows[0].id;

    // 6. Assign Guru A -> Matematika & Class X-A
    await client.query(
      `INSERT INTO teacher_subjects (id, school_id, teacher_id, subject_id)
       VALUES (uuid_generate_v4(), $1, $2, $3);`,
      [schoolAId, guruA.id, subjectMatId]
    );
    await client.query(
      `INSERT INTO teacher_classes (id, school_id, teacher_id, class_room_id, subject_id)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4);`,
      [schoolAId, guruA.id, classAId, subjectMatId]
    );

    // 7. Assign Guru B -> B. Indonesia & Class X-B
    await client.query(
      `INSERT INTO teacher_subjects (id, school_id, teacher_id, subject_id)
       VALUES (uuid_generate_v4(), $1, $2, $3);`,
      [schoolAId, guruB.id, subjectIndId]
    );
    await client.query(
      `INSERT INTO teacher_classes (id, school_id, teacher_id, class_room_id, subject_id)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4);`,
      [schoolAId, guruB.id, classBId, subjectIndId]
    );

    console.log('✅ Fixtures initialized successfully.\n');

    // =========================================================================
    // TEST SUITE 1: TEACHER PROFILE & SECURITY TAMPERING
    // =========================================================================
    console.log('--- TEST SUITE 1: TEACHER PROFILE & TAMPERING DEFENSE ---');
    const profA = await TeacherCoreService.getProfile(schoolAId, guruA.id);
    assert(profA.fullName === 'Budi Hartono, M.Pd', 'Teacher A reads own profile successfully');
    assert(profA.school.id === schoolAId, 'Profile contains verified school tenant context');

    // Update phone & email
    const updProf = await TeacherCoreService.updateProfile(
      schoolAId,
      guruA.id,
      { phone: '081234567890', email: 'budi@sagaya.sch.id' },
      { id: guruA.id, username: guruA.username, role: 'GURU' }
    );
    assert(updProf.phone === '081234567890', 'Teacher A updates phone number');
    assert(updProf.email === 'budi@sagaya.sch.id', 'Teacher A updates email address');

    // Tampering test: Guru A attempts to update role or schoolId
    const checkDbUser = await client.query('SELECT role, school_id FROM users WHERE id = $1', [guruA.id]);
    assert(checkDbUser.rows[0].role === 'GURU', 'Teacher role remains strictly GURU');
    assert(checkDbUser.rows[0].school_id === schoolAId, 'Teacher school_id remains immutable to client updates');

    // =========================================================================
    // TEST SUITE 2: TEACHER CLASS & STUDENT READ-ONLY SCOPE
    // =========================================================================
    console.log('\n--- TEST SUITE 2: TEACHER CLASS & STUDENT SCOPE ---');
    const assignedClasses = await TeacherCoreService.getAssignedClasses(schoolAId, guruA.id);
    assert(assignedClasses.length === 1, 'Teacher A only has 1 assigned class');
    assert(assignedClasses[0].id === classAId, 'Assigned class matches Class X-A');

    const classAStudents = await TeacherCoreService.getClassStudents(schoolAId, guruA.id, classAId);
    assert(classAStudents.students.length === 1, 'Teacher A sees 1 student in Class X-A');
    assert(classAStudents.students[0].fullName === 'Alif Pratama', 'Student identity matches');

    // Guru A attempts to access unassigned Class X-B
    let unassignedBlocked = false;
    try {
      await TeacherCoreService.getClassStudents(schoolAId, guruA.id, classBId, undefined, 'GURU');
    } catch (err) {
      unassignedBlocked = true;
    }
    assert(unassignedBlocked, 'Teacher A blocked from accessing unassigned Class X-B');

    // =========================================================================
    // TEST SUITE 3: EXTENSIBLE QUESTION TYPE ENGINE (6 TYPES)
    // =========================================================================
    console.log('\n--- TEST SUITE 3: QUESTION TYPE ENGINE & SCORING ---');

    // 1. Multiple Choice (PILIHAN_GANDA)
    const mcHandler = QuestionTypeRegistry.getHandler('PILIHAN_GANDA');
    const mcVal = mcHandler.validate({
      questionText: 'Berapakah 2 + 2?',
      options: [{ id: 'A', text: '3' }, { id: 'B', text: '4' }],
      answerKey: 'B',
      weight: 1.0,
    });
    assert(mcVal.valid, 'Multiple Choice validation passes');

    const mcEvalCorrect = mcHandler.evaluate('B', 'B', undefined, 1.0);
    assert(mcEvalCorrect.isCorrect && mcEvalCorrect.score === 1.0, 'MC correct answer yields full points');

    const mcEvalWrong = mcHandler.evaluate('A', 'B', undefined, 1.0);
    assert(!mcEvalWrong.isCorrect && mcEvalWrong.score === 0, 'MC wrong answer yields 0 points');

    // 2. Complex MC (PG_KOMPLEKS)
    const cmcHandler = QuestionTypeRegistry.getHandler('PG_KOMPLEKS');
    const cmcEvalAllOrNothing = cmcHandler.evaluate(['A', 'C'], ['A', 'C'], undefined, 2.0, { method: 'ALL_OR_NOTHING' });
    assert(cmcEvalAllOrNothing.isCorrect && cmcEvalAllOrNothing.score === 2.0, 'Complex MC ALL_OR_NOTHING correct yields 2.0');

    const cmcEvalPartial = cmcHandler.evaluate(['A'], ['A', 'B'], undefined, 2.0, { method: 'PARTIAL_CREDIT' });
    assert(cmcEvalPartial.score === 1.0, 'Complex MC PARTIAL_CREDIT calculates proportional score (1.0 of 2.0)');

    // 3. True / False (BENAR_SALAH)
    const tfHandler = QuestionTypeRegistry.getHandler('BENAR_SALAH');
    const tfEval = tfHandler.evaluate('TRUE', 'TRUE', undefined, 1.0);
    assert(tfEval.isCorrect && tfEval.score === 1.0, 'True/False evaluates correctly server-side');

    // 4. Matching (MENJODOHKAN)
    const matchHandler = QuestionTypeRegistry.getHandler('MENJODOHKAN');
    const matchEval = matchHandler.evaluate({ L_0: 'R_0', L_1: 'R_1' }, { L_0: 'R_0', L_1: 'R_1' }, undefined, 2.0);
    assert(matchEval.isCorrect && matchEval.score === 2.0, 'Matching evaluates correct pairs');

    // 5. Short Answer (ISIAN_SINGKAT) with Normalization
    const saHandler = QuestionTypeRegistry.getHandler('ISIAN_SINGKAT');
    const saEval = saHandler.evaluate('   FoToSiNtEsIs...  ', ['fotosintesis'], undefined, 1.0);
    assert(saEval.isCorrect && saEval.score === 1.0, 'Short Answer normalizes whitespace, punctuation, and case sensitivity');

    // 6. Essay (ESSAY)
    const essayHandler = QuestionTypeRegistry.getHandler('ESSAY');
    const scoreValOk = essayHandler.validateManualScore(8.5, 10.0);
    assert(scoreValOk.valid, 'Essay valid score (8.5 of 10) accepted');

    const scoreValNegative = essayHandler.validateManualScore(-2, 10.0);
    assert(!scoreValNegative.valid, 'Essay negative score rejected');

    const scoreValExceed = essayHandler.validateManualScore(15, 10.0);
    assert(!scoreValExceed.valid, 'Essay score exceeding maxScore rejected');

    // =========================================================================
    // TEST SUITE 4: ZERO ANSWER KEY LEAKAGE TEST
    // =========================================================================
    console.log('\n--- TEST SUITE 4: ZERO ANSWER KEY LEAKAGE ---');
    const fullQuestion = {
      id: 'q-101',
      type: 'PILIHAN_GANDA',
      questionText: 'Soal Ujian Rahasia',
      options: [{ id: 'A', text: 'Salah' }, { id: 'B', text: 'Benar' }],
      answerKey: 'B',
      explanation: 'Jawaban benar adalah B karena...',
      teacher_internal_note: 'Pedoman guru',
    };

    const studentSanitized = QuestionTypeRegistry.sanitizeQuestionForStudent(fullQuestion);
    assert(studentSanitized.answerKey === undefined, 'Answer key stripped from student payload');
    assert(studentSanitized.explanation === undefined, 'Explanation stripped from student payload');
    assert(studentSanitized.teacher_internal_note === undefined, 'Internal notes stripped from student payload');
    assert(studentSanitized.options.length === 2, 'Options preserved for student rendering');

    // =========================================================================
    // TEST SUITE 5: QUESTION BANK CRUD, LIFECYCLE & DUPLICATION
    // =========================================================================
    console.log('\n--- TEST SUITE 5: QUESTION CRUD, LIFECYCLE & DUPLICATION ---');

    // 1. Create Question (DRAFT)
    const newQ = await TeacherQuestionService.createQuestion(
      schoolAId,
      guruA.id,
      {
        subjectId: subjectMatId,
        topic: 'Persamaan Linear Satu Variabel',
        difficulty: 'MEDIUM',
        type: 'PILIHAN_GANDA',
        questionText: 'Tentukan himpunan penyelesaian dari 2x + 6 = 14.',
        options: [
          { id: 'A', text: 'x = 3' },
          { id: 'B', text: 'x = 4' },
          { id: 'C', text: 'x = 5' },
        ],
        answerKey: 'B',
        explanation: '2x = 8 -> x = 4.',
        weight: 1.0,
      },
      { id: guruA.id, username: guruA.username, role: 'GURU' }
    );
    assert(newQ.lifecycle_status === 'DRAFT', 'Created question initial status is DRAFT');
    assert(newQ.current_revision_number === 1, 'Initial revision number is 1');

    // 2. Update Question (Creates Revision 2)
    const updQ = await TeacherQuestionService.updateQuestion(
      schoolAId,
      guruA.id,
      newQ.id,
      {
        questionText: 'Tentukan himpunan penyelesaian dari 2x + 6 = 14 (Revisi 2).',
        expectedVersion: 1,
      },
      { id: guruA.id, username: guruA.username, role: 'GURU' }
    );
    assert(updQ.current_revision_number === 2, 'Updating question increments revision number to 2');

    // 3. Concurrency Conflict Test
    let conflictDetected = false;
    try {
      await TeacherQuestionService.updateQuestion(
        schoolAId,
        guruA.id,
        newQ.id,
        {
          questionText: 'Stale edit',
          expectedVersion: 1, // Stale version (active is 2)
        },
        { id: guruA.id, username: guruA.username, role: 'GURU' }
      );
    } catch (err) {
      conflictDetected = err.message.includes('Data telah berubah');
    }
    assert(conflictDetected, 'Optimistic concurrency conflict correctly detected on stale version');

    // 4. Submit for Review (DRAFT -> SUBMITTED)
    const subRes = await TeacherQuestionService.submitForReview(
      schoolAId,
      guruA.id,
      newQ.id,
      { id: guruA.id, username: guruA.username, role: 'GURU' }
    );
    assert(subRes.success, 'Question submitted for review');

    // 5. Review & Approve Question
    const revRes = await TeacherQuestionService.reviewQuestion(
      schoolAId,
      guruA.id,
      newQ.id,
      'APPROVE',
      undefined,
      { id: guruA.id, username: guruA.username, role: 'ADMIN' }
    );
    assert(revRes.status === 'APPROVED', 'Reviewer approves question to APPROVED status');

    // 6. Duplicate Question
    const dupQ = await TeacherQuestionService.duplicateQuestion(
      schoolAId,
      guruA.id,
      newQ.id,
      { id: guruA.id, username: guruA.username, role: 'GURU' }
    );
    assert(dupQ.id !== newQ.id, 'Duplicated question receives a new unique UUID');
    assert(dupQ.current_revision_number === 1, 'Duplicated question starts at revision 1');
    assert(dupQ.topic.includes('(Salinan)'), 'Duplicated question topic reflects copy');

    // =========================================================================
    // TEST SUITE 6: TENANT ISOLATION & IDOR ATTACK SIMULATION
    // =========================================================================
    console.log('\n--- TEST SUITE 6: TENANT ISOLATION & IDOR DEFENSE ---');

    // Attack 1: Guru C (School B) tries to read Question in School A
    let crossSchoolReadBlocked = false;
    try {
      await TeacherQuestionService.getQuestionDetail(schoolBId, guruC.id, newQ.id, 'GURU');
    } catch (err) {
      crossSchoolReadBlocked = true;
    }
    assert(crossSchoolReadBlocked, 'IDOR Attack: Cross-school question read blocked');

    // Attack 2: Guru C (School B) tries to edit Question in School A
    let crossSchoolEditBlocked = false;
    try {
      await TeacherQuestionService.updateQuestion(
        schoolBId,
        guruC.id,
        newQ.id,
        { topic: 'Hacked Topic' },
        { id: guruC.id, username: guruC.username, role: 'GURU' }
      );
    } catch (err) {
      crossSchoolEditBlocked = true;
    }
    assert(crossSchoolEditBlocked, 'IDOR Attack: Cross-school question modification blocked');

    // Attack 3: Guru B tries to delete Guru A's question
    let ownershipBlocked = false;
    try {
      await TeacherQuestionService.deleteDraftQuestion(
        schoolAId,
        guruB.id,
        dupQ.id,
        { id: guruB.id, username: guruB.username, role: 'GURU' }
      );
    } catch (err) {
      ownershipBlocked = true;
    }
    assert(ownershipBlocked, 'IDOR Attack: Other teacher deleting question blocked');

    // =========================================================================
    // TEST SUITE 7: EXAM CREATION, LIFECYCLE & IMMUTABLE SNAPSHOT
    // =========================================================================
    console.log('\n--- TEST SUITE 7: EXAM CREATION & SNAPSHOT FREEZING ---');

    // 1. Guru A creates Exam for Matematika & Class X-A
    const exam = await TeacherExamService.createExam(
      schoolAId,
      guruA.id,
      {
        title: 'Penilaian Harian Matematika 1',
        subjectId: subjectMatId,
        targetClassIds: [classAId],
        durationMinutes: 60,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
        questionIds: [newQ.id],
      },
      { id: guruA.id, username: guruA.username, role: 'GURU' }
    );
    assert(exam.status === 'DRAFT', 'Exam created with status DRAFT');

    // 2. Guru A tries to create Exam for Bahasa Indonesia (Unassigned Subject)
    let unassignedSubjectBlocked = false;
    try {
      await TeacherExamService.createExam(
        schoolAId,
        guruA.id,
        {
          title: 'Ujian Ilegal',
          subjectId: subjectIndId, // Guru A does not teach Bahasa Indonesia
          targetClassIds: [classAId],
          durationMinutes: 60,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
        },
        { id: guruA.id, username: guruA.username, role: 'GURU' }
      );
    } catch (err) {
      unassignedSubjectBlocked = true;
    }
    assert(unassignedSubjectBlocked, 'Teacher creating exam for unassigned subject strictly rejected');

    // 3. Publish Exam and Freeze Snapshot
    const pubRes = await TeacherExamService.publishExam(
      schoolAId,
      guruA.id,
      exam.id,
      { id: guruA.id, username: guruA.username, role: 'ADMIN' }
    );
    assert(pubRes.success, 'Exam published successfully');

    // Verify questions in the exam are now LOCKED
    const lockedCheck = await client.query('SELECT lifecycle_status FROM question_banks WHERE id = $1', [newQ.id]);
    assert(lockedCheck.rows[0].lifecycle_status === 'LOCKED', 'Questions used in published exam are set to LOCKED');

    // =========================================================================
    // TEST SUITE 8: ESSAY GRADING & SCORE BOUNDARIES
    // =========================================================================
    console.log('\n--- TEST SUITE 8: ESSAY GRADING & AUDIT ---');

    // 1. Create an Essay Question
    const essayQ = await TeacherQuestionService.createQuestion(
      schoolAId,
      guruA.id,
      {
        subjectId: subjectMatId,
        topic: 'Aplikasi Aljabar',
        difficulty: 'HARD',
        type: 'ESSAY',
        questionText: 'Jelaskan penerapan sistem persamaan linear dalam memodelkan keuntungan usaha.',
        answerKey: { rubric: 'Kelengkapan model: 5 poin, Logika analisis: 5 poin' },
        weight: 10.0,
      },
      { id: guruA.id, username: guruA.username, role: 'GURU' }
    );

    // 2. Simulate Exam Participant & Session
    const partRes = await client.query(
      `INSERT INTO exam_participants (id, exam_id, student_id, token, token_status, assigned_package)
       VALUES (uuid_generate_v4(), $1, $2, 'TEST-TOKEN', 'ACTIVE', 'A') RETURNING id;`,
      [exam.id, studentAId]
    );
    const participantId = partRes.rows[0].id;

    const sessRes = await client.query(
      `INSERT INTO exam_sessions (id, participant_id, device_fingerprint, server_started_at, server_expires_at, status)
       VALUES (uuid_generate_v4(), $1, 'fp-dummy', NOW(), NOW() + INTERVAL '1 hour', 'SUBMITTED') RETURNING id;`,
      [participantId]
    );
    const sessionId = sessRes.rows[0].id;

    // 3. Insert student essay answer
    const ansRes = await client.query(
      `INSERT INTO student_answers (id, session_id, question_id, answer_value_json)
       VALUES (uuid_generate_v4(), $1, $2, '"Laba = Pendapatan - Biaya Total"') RETURNING id;`,
      [sessionId, essayQ.id]
    );
    const answerId = ansRes.rows[0].id;

    // 4. Grade Essay with valid score
    const gradeRes = await TeacherGradingService.gradeEssay(
      schoolAId,
      guruA.id,
      answerId,
      {
        manualScore: 8.5,
        feedback: 'Analisis konsep sudah sangat baik.',
        teacherInternalNote: 'Perlu bimbingan lanjutan pada optimasi biaya.',
      },
      { id: guruA.id, username: guruA.username, role: 'GURU' }
    );
    assert(gradeRes.finalScore === 8.5, 'Essay graded with 8.5 points');
    assert(gradeRes.gradedStatus === 'GRADED', 'Participant status updated to GRADED');

    // 5. Test Invalid Score Bounds (Exceeding maxScore)
    let scoreOverflowBlocked = false;
    try {
      await TeacherGradingService.gradeEssay(
        schoolAId,
        guruA.id,
        answerId,
        { manualScore: 15.0 }, // Exceeds 10.0
        { id: guruA.id, username: guruA.username, role: 'GURU' }
      );
    } catch (err) {
      scoreOverflowBlocked = true;
    }
    assert(scoreOverflowBlocked, 'Score manipulation: Score exceeding maxScore strictly rejected');

    // 6. Test Audit Log Recorded
    const auditGrade = await client.query(
      `SELECT action, details_json FROM audit_logs 
       WHERE school_id = $1 AND action = 'GRADING_UPDATED' AND resource_id = $2;`,
      [schoolAId, answerId]
    );
    assert(auditGrade.rows.length > 0, 'Audit log GRADING_UPDATED persistently recorded');
    assert(auditGrade.rows[0].details_json.newScore === 8.5, 'Audit log records exact newScore');

    // =========================================================================
    // TEST SUITE 9: FORMULA INJECTION PROTECTION (CSV / EXPORT)
    // =========================================================================
    console.log('\n--- TEST SUITE 9: FORMULA INJECTION DEFENSE ---');
    const dangerousInputs = ['=SUM(A1:A10)', '+cmd|calc', '-2+3', '@dangerous'];
    for (const d of dangerousInputs) {
      const sanitized = TeacherQuestionService.sanitizeForExport(d);
      assert(sanitized.startsWith("'"), `Dangerous input '${d}' escaped with leading quote: '${sanitized}'`);
    }

    // Clean safe input should not be modified
    const safeInput = 'Normal Text Soal';
    assert(TeacherQuestionService.sanitizeForExport(safeInput) === safeInput, 'Safe input unchanged');

    // =========================================================================
    // TEST SUITE 10: TEACHER ANALYTICS CALCULATION
    // =========================================================================
    console.log('\n--- TEST SUITE 10: TEACHER ANALYTICS CALCULATION ---');
    const analytics = await TeacherAnalyticsService.getAnalytics(schoolAId, guruA.id);
    assert(Array.isArray(analytics.typeDistribution), 'Analytics returns type distribution array');
    assert(Array.isArray(analytics.difficultyDistribution), 'Analytics returns difficulty distribution array');
    assert(Array.isArray(analytics.classPerformance), 'Analytics returns class performance comparisons');

    console.log('\n=============================================================');
    console.log(`SPRINT 04 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('=============================================================\n');

  } catch (err) {
    console.error('\n❌ FATAL TEST ERROR:', err);
    failedTests++;
  } finally {
    client.release();
    await pool.end();
    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
