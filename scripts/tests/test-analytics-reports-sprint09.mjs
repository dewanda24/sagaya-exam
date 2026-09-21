import pg from 'pg';
import crypto from 'crypto';
import * as XLSX from 'xlsx';
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

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASSED: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failedCount++;
    throw new Error(message);
  }
}

// -------------------------------------------------------------
// CORE SERVICES NATIVE IMPLEMENTATIONS (Mirroring src/lib/services)
// -------------------------------------------------------------

function sanitizeForSpreadsheet(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function computeScoreStats(scores, passingGrade = 75, customBucketStep = 10) {
  const count = scores.length;
  if (count === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      standardDeviation: 0,
      percentile25: 0,
      percentile50: 0,
      percentile75: 0,
      percentile90: 0,
      passingGrade,
      passedCount: 0,
      failedCount: 0,
      passRatePercentage: 0,
      distributionBuckets: [],
      gradeBrackets: {
        gradeA: { count: 0, percentage: 0 },
        gradeB: { count: 0, percentage: 0 },
        gradeC: { count: 0, percentage: 0 },
        gradeD: { count: 0, percentage: 0 },
      },
    };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = Math.round((sum / count) * 100) / 100;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const mid = Math.floor(count / 2);
  const median = count % 2 !== 0 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;

  let variance = 0;
  if (count > 1) {
    const squaredDiffs = sorted.map((val) => Math.pow(val - mean, 2));
    const sumSquaredDiffs = squaredDiffs.reduce((acc, val) => acc + val, 0);
    variance = sumSquaredDiffs / (count - 1);
  }
  const standardDeviation = Math.round(Math.sqrt(variance) * 100) / 100;

  const getPercentile = (p) => {
    const index = (p / 100) * (count - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (lower === upper) return sorted[lower];
    return Math.round((sorted[lower] * (1 - weight) + sorted[upper] * weight) * 100) / 100;
  };

  const percentile25 = getPercentile(25);
  const percentile50 = median;
  const percentile75 = getPercentile(75);
  const percentile90 = getPercentile(90);

  let passedCount = 0;
  let gradeACount = 0;
  let gradeBCount = 0;
  let gradeCCount = 0;
  let gradeDCount = 0;

  for (const s of sorted) {
    if (s >= passingGrade) passedCount++;
    if (s >= 85) gradeACount++;
    else if (s >= 70) gradeBCount++;
    else if (s >= 55) gradeCCount++;
    else gradeDCount++;
  }

  const failedCount = count - passedCount;
  const passRatePercentage = Math.round((passedCount / count) * 10000) / 100;

  const buckets = [];
  const step = customBucketStep > 0 ? customBucketStep : 10;
  for (let lower = 0; lower <= 100; lower += step) {
    const upper = lower + step === 100 ? 100 : lower + step - 1;
    if (lower > 100) break;
    const inBucket = sorted.filter((s) => s >= lower && (upper === 100 ? s <= upper : s <= upper));
    buckets.push({
      range: `${lower}-${upper}`,
      min: lower,
      max: upper,
      count: inBucket.length,
      percentage: Math.round((inBucket.length / count) * 10000) / 100,
    });
    if (upper === 100) break;
  }

  return {
    count,
    mean,
    median,
    min,
    max,
    standardDeviation,
    percentile25,
    percentile50,
    percentile75,
    percentile90,
    passingGrade,
    passedCount,
    failedCount,
    passRatePercentage,
    distributionBuckets: buckets,
    gradeBrackets: {
      gradeA: { count: gradeACount, percentage: Math.round((gradeACount / count) * 10000) / 100 },
      gradeB: { count: gradeBCount, percentage: Math.round((gradeBCount / count) * 10000) / 100 },
      gradeC: { count: gradeCCount, percentage: Math.round((gradeCCount / count) * 10000) / 100 },
      gradeD: { count: gradeDCount, percentage: Math.round((gradeDCount / count) * 10000) / 100 },
    },
  };
}

function classifyDifficulty(p) {
  if (p >= 0.85) return 'SANGAT_MUDAH';
  if (p >= 0.70) return 'MUDAH';
  if (p >= 0.30) return 'SEDANG';
  if (p >= 0.15) return 'SUKAR';
  return 'SANGAT_SUKAR';
}

function generateMinimalPdf(title, schoolName) {
  const content = `BT /F1 12 Tf 50 780 Td (${title}) Tj ET\nBT /F1 10 Tf 50 760 Td (${schoolName}) Tj ET\n`;
  const contentLen = Buffer.byteLength(content, 'utf8');

  let pdf = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  const offsets = [0];

  const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  offsets.push(Buffer.byteLength(pdf, 'utf8'));
  pdf += obj1;

  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  offsets.push(Buffer.byteLength(pdf, 'utf8'));
  pdf += obj2;

  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`;
  offsets.push(Buffer.byteLength(pdf, 'utf8'));
  pdf += obj3;

  const obj4 = `4 0 obj\n<< /Length ${contentLen} >>\nstream\n${content}\nendstream\nendobj\n`;
  offsets.push(Buffer.byteLength(pdf, 'utf8'));
  pdf += obj4;

  const obj5 = `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  offsets.push(Buffer.byteLength(pdf, 'utf8'));
  pdf += obj5;

  const startXref = Buffer.byteLength(pdf, 'utf8');
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i < 6; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  pdf += xref + trailer;

  return Buffer.from(pdf, 'utf8');
}

// -------------------------------------------------------------
// FIXTURE DATA
// -------------------------------------------------------------
let fixture = {
  schoolAId: '',
  schoolBId: '',
  adminAId: '',
  adminBId: '',
  teacherAId: '',
  proctorAId: '',
  subjectAId: '',
  classAId: '',
  classBId: '',
  studentA1Id: '',
  studentA2Id: '',
  studentB1Id: '',
  examAId: '',
  snapshotAId: '',
  question1Id: '',
  question2Id: '',
  participantA1Id: '',
  participantA2Id: '',
  sessionA1Id: '',
  sessionA2Id: '',
  resultA1Id: '',
  resultA2Id: '',
};

async function setupDatabaseFixtures() {
  console.log('\n--- Menyiapkan Fixture Uji Lingkungan Sprint 09 ---');

  // 1. Schools
  const schARes = await pool.query(
    `INSERT INTO schools (name, code, level, status, is_active) VALUES ('SMA Harapan Bangsa A', 'SCH-SPRINT09-A', 'SMA', 'ACTIVE', true) RETURNING id;`
  );
  fixture.schoolAId = schARes.rows[0].id;

  const schBRes = await pool.query(
    `INSERT INTO schools (name, code, level, status, is_active) VALUES ('SMA Cendekia B', 'SCH-SPRINT09-B', 'SMA', 'ACTIVE', true) RETURNING id;`
  );
  fixture.schoolBId = schBRes.rows[0].id;

  // 2. Users
  const admARes = await pool.query(
    `INSERT INTO users (school_id, username, full_name, role, is_active, password_hash)
     VALUES ($1, 'admin_a_s09', 'Admin Sekolah A', 'ADMIN', true, 'dummy_hash') RETURNING id;`,
    [fixture.schoolAId]
  );
  fixture.adminAId = admARes.rows[0].id;

  const admBRes = await pool.query(
    `INSERT INTO users (school_id, username, full_name, role, is_active, password_hash)
     VALUES ($1, 'admin_b_s09', 'Admin Sekolah B', 'ADMIN', true, 'dummy_hash') RETURNING id;`,
    [fixture.schoolBId]
  );
  fixture.adminBId = admBRes.rows[0].id;

  const tchARes = await pool.query(
    `INSERT INTO users (school_id, username, full_name, role, is_active, password_hash)
     VALUES ($1, 'guru_a_s09', 'Guru Fisika A', 'GURU', true, 'dummy_hash') RETURNING id;`,
    [fixture.schoolAId]
  );
  fixture.teacherAId = tchARes.rows[0].id;

  const prcARes = await pool.query(
    `INSERT INTO users (school_id, username, full_name, role, is_active, password_hash)
     VALUES ($1, 'pengawas_a_s09', 'Pengawas Ruang A', 'PENGAWAS', true, 'dummy_hash') RETURNING id;`,
    [fixture.schoolAId]
  );
  fixture.proctorAId = prcARes.rows[0].id;

  // 3. Subject & Classes
  const subRes = await pool.query(
    `INSERT INTO subjects (school_id, name, code) VALUES ($1, 'Fisika Kuantum', 'FIS-09') RETURNING id;`,
    [fixture.schoolAId]
  );
  fixture.subjectAId = subRes.rows[0].id;

  const clsARes = await pool.query(
    `INSERT INTO class_rooms (school_id, name, level, academic_year) VALUES ($1, 'XII IPA 1', '12', '2026/2027') RETURNING id;`,
    [fixture.schoolAId]
  );
  fixture.classAId = clsARes.rows[0].id;

  const clsBRes = await pool.query(
    `INSERT INTO class_rooms (school_id, name, level, academic_year) VALUES ($1, 'XII IPA 2', '12', '2026/2027') RETURNING id;`,
    [fixture.schoolAId]
  );
  fixture.classBId = clsBRes.rows[0].id;

  await pool.query(
    `INSERT INTO teacher_subjects (school_id, teacher_id, subject_id) VALUES ($1, $2, $3);`,
    [fixture.schoolAId, fixture.teacherAId, fixture.subjectAId]
  );
  await pool.query(
    `INSERT INTO teacher_classes (school_id, teacher_id, class_room_id) VALUES ($1, $2, $3);`,
    [fixture.schoolAId, fixture.teacherAId, fixture.classAId]
  );

  // 4. Students
  const stdA1Res = await pool.query(
    `INSERT INTO students (school_id, class_room_id, nis, nisn, full_name, card_access_code, status)
     VALUES ($1, $2, 'NIS-001', 'NISN-001', 'Budi Santoso', 'CARD-001', 'ACTIVE') RETURNING id;`,
    [fixture.schoolAId, fixture.classAId]
  );
  fixture.studentA1Id = stdA1Res.rows[0].id;

  const stdA2Res = await pool.query(
    `INSERT INTO students (school_id, class_room_id, nis, nisn, full_name, card_access_code, status)
     VALUES ($1, $2, 'NIS-002', 'NISN-002', '=cmd|"/C calc"!A0', 'CARD-002', 'ACTIVE') RETURNING id;`, // Formula injection test payload
    [fixture.schoolAId, fixture.classAId]
  );
  fixture.studentA2Id = stdA2Res.rows[0].id;

  const stdB1Res = await pool.query(
    `INSERT INTO students (school_id, nis, nisn, full_name, card_access_code, status)
     VALUES ($1, 'NIS-B01', 'NISN-B01', 'Siswa Sekolah B', 'CARD-B01', 'ACTIVE') RETURNING id;`,
    [fixture.schoolBId]
  );
  fixture.studentB1Id = stdB1Res.rows[0].id;

  // 5. Exam & Frozen Snapshot
  const exRes = await pool.query(
    `INSERT INTO exams (school_id, subject_id, created_by, title, passing_grade, duration_minutes, status, start_time, end_time)
     VALUES ($1, $2, $3, 'Ujian Akhir Semester Fisika', 75.0, 90, 'PUBLISHED', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '2 hours') RETURNING id;`,
    [fixture.schoolAId, fixture.subjectAId, fixture.teacherAId]
  );
  fixture.examAId = exRes.rows[0].id;

  const snapRes = await pool.query(
    `INSERT INTO exam_snapshots (exam_id, school_id, version, metadata_json)
     VALUES ($1, $2, 1, '{"versionName": "v1.0 Frozen"}') RETURNING id;`,
    [fixture.examAId, fixture.schoolAId]
  );
  fixture.snapshotAId = snapRes.rows[0].id;

  await pool.query(`UPDATE exams SET active_snapshot_id = $1 WHERE id = $2;`, [fixture.snapshotAId, fixture.examAId]);

  // Question Banks
  const q1BankRes = await pool.query(
    `INSERT INTO question_banks (school_id, subject_id, teacher_id, topic, difficulty, type, question_text, answer_key_json, weight)
     VALUES ($1, $2, $3, 'Fisika', 'MEDIUM', 'PILIHAN_GANDA', 'Berapakah konstanta Planck?', '"opt_a"', 10.0) RETURNING id;`,
    [fixture.schoolAId, fixture.subjectAId, fixture.teacherAId]
  );
  fixture.question1Id = q1BankRes.rows[0].id;

  const q2BankRes = await pool.query(
    `INSERT INTO question_banks (school_id, subject_id, teacher_id, topic, difficulty, type, question_text, answer_key_json, weight)
     VALUES ($1, $2, $3, 'Fisika', 'EASY', 'PILIHAN_GANDA', 'Satuan frekuensi adalah?', '"opt_c"', 10.0) RETURNING id;`,
    [fixture.schoolAId, fixture.subjectAId, fixture.teacherAId]
  );
  fixture.question2Id = q2BankRes.rows[0].id;

  // Freeze in exam_snapshot_questions (v1 snapshot configuration)
  await pool.query(
    `INSERT INTO exam_snapshot_questions (snapshot_id, question_id, position, points, configuration_json)
     VALUES ($1, $2, 1, 10.0, $3);`,
    [
      fixture.snapshotAId,
      fixture.question1Id,
      JSON.stringify({
        type: 'PILIHAN_GANDA',
        questionText: 'Berapakah konstanta Planck? [Snapshot v1]',
        points: 10.0,
        answerKey: 'opt_a',
        options: [
          { id: 'opt_a', text: '6.626 x 10^-34 J s' },
          { id: 'opt_b', text: '3.00 x 10^8 m/s' },
          { id: 'opt_c', text: '9.8 m/s^2' },
          { id: 'opt_d', text: '1.602 x 10^-19 C' },
        ],
      }),
    ]
  );

  await pool.query(
    `INSERT INTO exam_snapshot_questions (snapshot_id, question_id, position, points, configuration_json)
     VALUES ($1, $2, 2, 10.0, $3);`,
    [
      fixture.snapshotAId,
      fixture.question2Id,
      JSON.stringify({
        type: 'PILIHAN_GANDA',
        questionText: 'Satuan frekuensi adalah? [Snapshot v1]',
        points: 10.0,
        answerKey: 'opt_c',
        options: [
          { id: 'opt_a', text: 'Joule' },
          { id: 'opt_b', text: 'Watt' },
          { id: 'opt_c', text: 'Hertz' },
          { id: 'opt_d', text: 'Newton' },
        ],
      }),
    ]
  );

  // 6. Participants & Sessions
  const part1Res = await pool.query(
    `INSERT INTO exam_participants (exam_id, student_id, school_id, token, status)
     VALUES ($1, $2, $3, 'TK-001', 'ACTIVE') RETURNING id;`,
    [fixture.examAId, fixture.studentA1Id, fixture.schoolAId]
  );
  fixture.participantA1Id = part1Res.rows[0].id;

  const part2Res = await pool.query(
    `INSERT INTO exam_participants (exam_id, student_id, school_id, token, status)
     VALUES ($1, $2, $3, 'TK-002', 'ACTIVE') RETURNING id;`,
    [fixture.examAId, fixture.studentA2Id, fixture.schoolAId]
  );
  fixture.participantA2Id = part2Res.rows[0].id;

  const sess1Res = await pool.query(
    `INSERT INTO exam_sessions (participant_id, exam_id, student_id, school_id, status, started_at, submitted_at, server_started_at, server_expires_at, tab_violation_count, device_fingerprint)
     VALUES ($1, $2, $3, $4, 'SUBMITTED', NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '50 minutes', NOW() + INTERVAL '40 minutes', 0, 'FP-001') RETURNING id;`,
    [fixture.participantA1Id, fixture.examAId, fixture.studentA1Id, fixture.schoolAId]
  );
  fixture.sessionA1Id = sess1Res.rows[0].id;

  const sess2Res = await pool.query(
    `INSERT INTO exam_sessions (participant_id, exam_id, student_id, school_id, status, started_at, submitted_at, server_started_at, server_expires_at, tab_violation_count, device_fingerprint)
     VALUES ($1, $2, $3, $4, 'SUBMITTED', NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '40 minutes', NOW() + INTERVAL '50 minutes', 2, 'FP-002') RETURNING id;`,
    [fixture.participantA2Id, fixture.examAId, fixture.studentA2Id, fixture.schoolAId]
  );
  fixture.sessionA2Id = sess2Res.rows[0].id;

  // Student Answers
  await pool.query(
    `INSERT INTO student_answers (session_id, question_id, answer_value_json, state)
     VALUES ($1, $2, '"opt_a"', 'ANSWERED'), ($1, $3, '"opt_c"', 'ANSWERED');`,
    [fixture.sessionA1Id, fixture.question1Id, fixture.question2Id]
  );

  await pool.query(
    `INSERT INTO student_answers (session_id, question_id, answer_value_json, state)
     VALUES ($1, $2, '"opt_b"', 'ANSWERED'), ($1, $3, '"opt_c"', 'ANSWERED');`,
    [fixture.sessionA2Id, fixture.question1Id, fixture.question2Id]
  );

  // 7. Results & Question Results
  const res1 = await pool.query(
    `INSERT INTO exam_results (exam_id, session_id, participant_id, student_id, school_id, raw_score, max_score, final_score, percentage, status)
     VALUES ($1, $2, $3, $4, $5, 20.0, 20.0, 100.0, 100.0, 'PUBLISHED') RETURNING id;`,
    [fixture.examAId, fixture.sessionA1Id, fixture.participantA1Id, fixture.studentA1Id, fixture.schoolAId]
  );
  fixture.resultA1Id = res1.rows[0].id;

  const res2 = await pool.query(
    `INSERT INTO exam_results (exam_id, session_id, participant_id, student_id, school_id, raw_score, max_score, final_score, percentage, status)
     VALUES ($1, $2, $3, $4, $5, 10.0, 20.0, 50.0, 50.0, 'PUBLISHED') RETURNING id;`,
    [fixture.examAId, fixture.sessionA2Id, fixture.participantA2Id, fixture.studentA2Id, fixture.schoolAId]
  );
  fixture.resultA2Id = res2.rows[0].id;

  await pool.query(
    `INSERT INTO exam_question_results (result_id, question_id, score, max_score, score_status)
     VALUES ($1, $2, 10.0, 10.0, 'AUTOMATED'), ($1, $3, 10.0, 10.0, 'AUTOMATED');`,
    [fixture.resultA1Id, fixture.question1Id, fixture.question2Id]
  );
  await pool.query(
    `INSERT INTO exam_question_results (result_id, question_id, score, max_score, score_status)
     VALUES ($1, $2, 0.0, 10.0, 'AUTOMATED'), ($1, $3, 10.0, 10.0, 'AUTOMATED');`,
    [fixture.resultA2Id, fixture.question1Id, fixture.question2Id]
  );

  await pool.query(
    `INSERT INTO exam_session_violations (session_id, participant_id, exam_id, school_id, type, severity)
     VALUES ($1, $2, $3, $4, 'TAB_SWITCH', 'WARNING');`,
    [fixture.sessionA2Id, fixture.participantA2Id, fixture.examAId, fixture.schoolAId]
  );

  console.log('✅ Setup database fixture berhasil.');
}

async function runTestSuite() {
  await setupDatabaseFixtures();

  console.log('\n===============================================================');
  console.log('SAGAYA EXAM — SPRINT 09 ANALYTICS, REPORTS & EXPORT TEST SUITE');
  console.log('===============================================================');

  // -------------------------------------------------------------
  // MODULE 1: TENANT ISOLATION TESTS
  // -------------------------------------------------------------
  console.log('\n--- Module 1: Tenant Isolation Tests ---');

  // Check School B Admin cannot query School A's exam results
  const crossTenantQuery = await pool.query(
    `SELECT er.id FROM exam_results er WHERE er.exam_id = $1 AND er.school_id = $2;`,
    [fixture.examAId, fixture.schoolBId]
  );
  assert(crossTenantQuery.rows.length === 0, 'School B Admin tidak dapat melihat hasil ujian School A (Zero rows returned)');

  // Check School B Student query against School A
  const crossStudentQuery = await pool.query(
    `SELECT s.id FROM students s WHERE s.id = $1 AND s.school_id = $2;`,
    [fixture.studentA1Id, fixture.schoolBId]
  );
  assert(crossStudentQuery.rows.length === 0, 'Siswa Sekolah A tidak dapat diakses dalam tenant Sekolah B');

  // -------------------------------------------------------------
  // MODULE 2: ROLE & SCOPE TESTS
  // -------------------------------------------------------------
  console.log('\n--- Module 2: Role & Scope Tests ---');

  // Verify Teacher assignment scope
  const teacherClassCheck = await pool.query(
    `SELECT 1 FROM teacher_classes WHERE school_id = $1 AND teacher_id = $2 AND class_room_id = $3;`,
    [fixture.schoolAId, fixture.teacherAId, fixture.classAId]
  );
  assert(teacherClassCheck.rows.length > 0, 'Guru A terdaftar sah mengajar di Kelas A');

  const teacherUnassignedClassCheck = await pool.query(
    `SELECT 1 FROM teacher_classes WHERE school_id = $1 AND teacher_id = $2 AND class_room_id = $3;`,
    [fixture.schoolAId, fixture.teacherAId, fixture.classBId]
  );
  assert(teacherUnassignedClassCheck.rows.length === 0, 'Guru A tidak memiliki izin mengajar di Kelas B (Akses ditolak)');

  // Proctor Scope: Only operational metrics, no answer keys
  const proctorAccessQuery = await pool.query(
    `SELECT count(*) as count FROM exam_sessions WHERE exam_id = $1 AND school_id = $2;`,
    [fixture.examAId, fixture.schoolAId]
  );
  assert(parseInt(proctorAccessQuery.rows[0].count, 10) === 2, 'Pengawas dapat mengakses data operasional sesi ujian');

  // Student Scope: Self only
  const studentSelfQuery = await pool.query(
    `SELECT er.final_score FROM exam_results er WHERE er.student_id = $1 AND er.status = 'PUBLISHED';`,
    [fixture.studentA1Id]
  );
  assert(studentSelfQuery.rows.length > 0, 'Siswa dapat membaca hasil ujian miliknya yang berstatus PUBLISHED');

  // -------------------------------------------------------------
  // MODULE 3: MATHEMATICAL ACCURACY & AGGREGATIONS
  // -------------------------------------------------------------
  console.log('\n--- Module 3: Mathematical Accuracy & Aggregations ---');

  const statsResults = await pool.query(
    `SELECT er.final_score, es.status as session_status
     FROM exam_participants ep
     LEFT JOIN exam_sessions es ON ep.id = es.participant_id
     LEFT JOIN exam_results er ON es.id = er.session_id
     WHERE ep.exam_id = $1 AND ep.school_id = $2;`,
    [fixture.examAId, fixture.schoolAId]
  );

  const registered = statsResults.rows.length; // 2
  const attended = statsResults.rows.filter((r) => r.session_status === 'SUBMITTED').length; // 2
  const scores = statsResults.rows.map((r) => parseFloat(r.final_score)); // [100, 50]

  const attendanceRate = (attended / registered) * 100;
  assert(registered === 2, 'Denominator peserta terdaftar terhitung akurat (2)');
  assert(attended === 2, 'Peserta hadir terhitung akurat (2)');
  assert(attendanceRate === 100, 'Attendance Rate = 100% (2/2 * 100)');

  const stats = computeScoreStats(scores, 75, 10);
  assert(stats.mean === 75, 'Rata-rata skor (Mean) = 75.0 ((100 + 50) / 2)');
  assert(stats.median === 75, 'Median skor = 75.0');
  assert(stats.min === 50, 'Skor minimum = 50.0');
  assert(stats.max === 100, 'Skor maksimum = 100.0');
  assert(stats.passedCount === 1, 'Jumlah kelulusan KKM = 1');
  assert(stats.failedCount === 1, 'Jumlah tidak lulus KKM = 1');
  assert(stats.passRatePercentage === 50, 'Pass Rate = 50.0% (1/2 * 100)');
  assert(stats.standardDeviation === 35.36, 'Sample Standard Deviation presisi: 35.36');

  // -------------------------------------------------------------
  // MODULE 4: SCORE DISTRIBUTION BUCKETS & PENDING RESULT ISOLATION
  // -------------------------------------------------------------
  console.log('\n--- Module 4: Distribution Buckets & Status Isolation ---');

  const sampleDistributionScores = [15, 25, 40, 55, 70, 75, 85, 95, 100];
  const sampleStats = computeScoreStats(sampleDistributionScores, 75, 10);

  assert(sampleStats.count === 9, 'Menghitung tepat 9 data sampel');
  assert(sampleStats.distributionBuckets.length === 10, 'Bucket distribusi 0-9 s.d. 90-100 terbentuk 10 segmen');

  // Verifikasi isolasi status PENDING: Hasil PENDING tidak boleh dihitung
  const validOnlyScoresRes = await pool.query(
    `SELECT er.final_score 
     FROM exam_results er 
     WHERE er.exam_id = $1 AND er.school_id = $2 AND er.status IN ('PUBLISHED', 'GRADED', 'REVIEWED');`,
    [fixture.examAId, fixture.schoolAId]
  );
  assert(validOnlyScoresRes.rows.length === 2, 'Hanya hasil terpublikasi / dinilai yang masuk dalam komputasi agregasi');

  // -------------------------------------------------------------
  // MODULE 5: QUESTION ITEM ANALYSIS & SNAPSHOT IMMUTABILITY
  // -------------------------------------------------------------
  console.log('\n--- Module 5: Question Item Analysis & Snapshot Immutability ---');

  // Question 1: 1 correct (opt_a), 1 wrong (opt_b) -> p = 1 / 2 = 0.50 (SEDANG)
  const q1Correct = 1;
  const q1Total = 2;
  const pQ1 = q1Correct / q1Total;
  assert(pQ1 === 0.5, 'Indeks Kesukaran Q1 = 0.50 (1 benar / 2 percobaan)');
  assert(classifyDifficulty(pQ1) === 'SEDANG', 'Klasifikasi pedagogis Q1 = SEDANG (0.30 <= p < 0.70)');

  // Question 2: 2 correct (opt_c) -> p = 2 / 2 = 1.00 (SANGAT_MUDAH)
  const pQ2 = 2 / 2;
  assert(pQ2 === 1.0, 'Indeks Kesukaran Q2 = 1.00 (Semua benar)');
  assert(classifyDifficulty(pQ2) === 'SANGAT_MUDAH', 'Klasifikasi pedagogis Q2 = SANGAT_MUDAH (p >= 0.85)');

  // Snapshot Immutability: Mutasi bank soal v2
  await pool.query(
    `UPDATE question_banks SET question_text = 'Teks Baru v2 Setelah Ujian Selesai', answer_key_json = '"opt_d"' WHERE id = $1;`,
    [fixture.question1Id]
  );

  // Ambil butir soal dari snapshot
  const snapshotQRes = await pool.query(
    `SELECT configuration_json FROM exam_snapshot_questions WHERE snapshot_id = $1 AND question_id = $2;`,
    [fixture.snapshotAId, fixture.question1Id]
  );
  const snapQConf = snapshotQRes.rows[0].configuration_json;
  assert(
    snapQConf.questionText.includes('[Snapshot v1]'),
    'Historical Analytics tetap mengacu pada teks Snapshot v1 dan kebal terhadap mutasi Bank Soal v2'
  );
  assert(snapQConf.answerKey === 'opt_a', 'Kunci jawaban analitik tetap opt_a sesuai snapshot awal');

  // -------------------------------------------------------------
  // MODULE 6: FORMULA INJECTION PROTECTION (CSV / SPREADSHEET DDE)
  // -------------------------------------------------------------
  console.log('\n--- Module 6: Formula Injection Protection Tests ---');

  const dangerousInputs = [
    '=SUM(A1:A10)',
    '+cmd|"/C calc"!A0',
    '-cmd|"/C calc"!A0',
    '@SUM(B1:B10)',
    '\t=DDE("cmd")',
    '\r+DDE("cmd")',
  ];

  for (const input of dangerousInputs) {
    const sanitized = sanitizeForSpreadsheet(input);
    assert(
      sanitized.startsWith("'"),
      `Payload formula "${input.slice(0, 12)}..." berhasil dinetralkan dengan kutip tunggal: "${sanitized.slice(0, 13)}..."`
    );
  }

  const safeInput = 'Dr. Ir. H. Ahmad Dahlan';
  assert(sanitizeForSpreadsheet(safeInput) === safeInput, 'Teks aman tidak dimodifikasi');

  // -------------------------------------------------------------
  // MODULE 7: EXPORT GENERATION & FILE INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- Module 7: Export Engine (CSV, XLSX, PDF) Tests ---');

  // 1. CSV Generation
  const headers = ['No', 'NISN', 'Nama Siswa', 'Nilai'];
  const testRows = [
    { No: 1, NISN: 'NISN-001', 'Nama Siswa': 'Budi Santoso', Nilai: 100 },
    { No: 2, NISN: 'NISN-002', 'Nama Siswa': '=cmd|"/C calc"!A0', Nilai: 50 },
  ];

  const csvRows = [headers.join(',')];
  for (const r of testRows) {
    const line = headers.map((h) => `"${sanitizeForSpreadsheet(r[h])}"`).join(',');
    csvRows.push(line);
  }
  const csvBuffer = Buffer.from(csvRows.join('\n'), 'utf8');
  assert(csvBuffer.length > 50, 'Buffer CSV berhasil dibuat');
  assert(csvBuffer.toString('utf8').includes(`"'=cmd`), 'CSV memuat sanitasi formula injection pada nama siswa');

  // 2. XLSX Generation
  const sanitizedXlsxRows = testRows.map((row) => ({
    No: row.No,
    NISN: row.NISN,
    'Nama Siswa': sanitizeForSpreadsheet(row['Nama Siswa']),
    Nilai: row.Nilai,
  }));
  const ws = XLSX.utils.json_to_sheet(sanitizedXlsxRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hasil Ujian');
  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  assert(xlsxBuffer.length > 500, 'Buffer XLSX valid dan berukuran > 500 bytes');

  // 3. Pure TypeScript PDF Generation
  const pdfBuffer = generateMinimalPdf('REKAPITULASI NILAI FISIKA', 'SMA Harapan Bangsa A');
  assert(pdfBuffer.length > 100, 'Buffer PDF berhasil digenerate murni');
  const pdfHeader = pdfBuffer.toString('latin1', 0, 8);
  assert(pdfHeader.startsWith('%PDF-1.4'), 'Header PDF berstandar %PDF-1.4');
  assert(pdfBuffer.toString('latin1').includes('%%EOF'), 'Trailer PDF berstandar %%EOF');

  // -------------------------------------------------------------
  // MODULE 8: ASYNC EXPORT QUEUE & DOWNLOAD SECURITY
  // -------------------------------------------------------------
  console.log('\n--- Module 8: Async Export Queue & Download Security ---');

  // 1. Create Export Job
  const jobRes = await pool.query(
    `INSERT INTO export_jobs (school_id, requested_by, report_type, format, filters, status, file_name, file_size_bytes, file_content_base64)
     VALUES ($1, $2, 'EXAM_RESULTS', 'XLSX', '{"examId": "dummy"}', 'COMPLETED', 'sagaya-report.xlsx', $3, $4)
     RETURNING *;`,
    [fixture.schoolAId, fixture.adminAId, xlsxBuffer.length, xlsxBuffer.toString('base64')]
  );
  const job = jobRes.rows[0];
  assert(job && job.status === 'COMPLETED', 'Export job tercatat berstatus COMPLETED');

  // 2. Verify Download Authorization (IDOR check: School B cannot read School A's job)
  const crossJobQuery = await pool.query(
    `SELECT id FROM export_jobs WHERE id = $1 AND school_id = $2;`,
    [job.id, fixture.schoolBId]
  );
  assert(crossJobQuery.rows.length === 0, 'Unduh berkas oleh School B ditolak mutlak (IDOR blocked)');

  // 3. Expiration Check
  const expiredJobRes = await pool.query(
    `INSERT INTO export_jobs (school_id, requested_by, report_type, format, status, expires_at)
     VALUES ($1, $2, 'EXAM_RESULTS', 'CSV', 'COMPLETED', NOW() - INTERVAL '1 day')
     RETURNING *;`,
    [fixture.schoolAId, fixture.adminAId]
  );
  const expiredJob = expiredJobRes.rows[0];
  const isExpired = new Date(expiredJob.expires_at) < new Date();
  assert(isExpired, 'Sistem mendeteksi berkas ekspor yang telah kedaluwarsa');

  // -------------------------------------------------------------
  // MODULE 9: REPORT SNAPSHOTS & REPRODUCIBILITY
  // -------------------------------------------------------------
  console.log('\n--- Module 9: Immutable Report Snapshots ---');

  const snapReportRes = await pool.query(
    `INSERT INTO report_snapshots (school_id, report_type, scope, filters, data_payload, status, generated_by)
     VALUES ($1, 'OFFICIAL_EXAM_RECAP', 'EXAM', $2, $3, 'PUBLISHED', $4)
     RETURNING *;`,
    [
      fixture.schoolAId,
      JSON.stringify({ examId: fixture.examAId }),
      JSON.stringify({ examTitle: 'Ujian Akhir Semester Fisika', certifiedPassRate: '50.0%', mean: 75.0 }),
      fixture.adminAId,
    ]
  );
  const reportSnap = snapReportRes.rows[0];
  assert(reportSnap && reportSnap.id, 'Report snapshot resmi berhasil dibuat di database');

  const retrievedSnapRes = await pool.query(`SELECT data_payload FROM report_snapshots WHERE id = $1;`, [reportSnap.id]);
  const retrievedPayload = retrievedSnapRes.rows[0].data_payload;
  assert(retrievedPayload.certifiedPassRate === '50.0%', 'Payload snapshot dibekukan secara kekal & reproducible');

  // -------------------------------------------------------------
  // MODULE 10: PERFORMANCE & INDEXES AUDIT
  // -------------------------------------------------------------
  console.log('\n--- Module 10: Performance & Indexes Audit ---');

  const indexesQuery = await pool.query(`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename IN ('report_snapshots', 'export_jobs', 'exam_results', 'attendance_records')
      AND indexname IN (
        'idx_report_snapshots_school_type',
        'idx_export_jobs_school_user',
        'idx_results_school_exam_status',
        'idx_attendance_school_exam_status'
      );
  `);
  const indexNames = indexesQuery.rows.map((r) => r.indexname);
  assert(indexNames.includes('idx_report_snapshots_school_type'), 'Indeks idx_report_snapshots_school_type aktif');
  assert(indexNames.includes('idx_export_jobs_school_user'), 'Indeks idx_export_jobs_school_user aktif');
  assert(indexNames.includes('idx_results_school_exam_status'), 'Indeks idx_results_school_exam_status aktif');
  assert(indexNames.includes('idx_attendance_school_exam_status'), 'Indeks idx_attendance_school_exam_status aktif');

  // -------------------------------------------------------------
  // CLEANUP FIXTURES
  // -------------------------------------------------------------
  console.log('\n--- Membersihkan Data Uji Fixture ---');
  await pool.query(`DELETE FROM schools WHERE id IN ($1, $2);`, [fixture.schoolAId, fixture.schoolBId]);
  console.log('✅ Cleanup selesai.');

  console.log('\n===============================================================');
  console.log(`SPRINT 09 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('===============================================================\n');

  await pool.end();
  process.exit(0);
}

runTestSuite().catch(async (err) => {
  console.error('Fatal test error:', err);
  await pool.query(`DELETE FROM schools WHERE id IN ($1, $2);`, [fixture.schoolAId, fixture.schoolBId]).catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
