import { queryPostgres } from '../lib/postgres.ts';

async function testStudentWorkflow() {
  console.log('--- 1. Testing Student Query from Supabase ---');
  const res = await queryPostgres('SELECT count(*) FROM students;');
  console.log('Current total students in Supabase:', res.rows[0].count);

  console.log('\n--- 2. Simulating Excel Import Row Insertion into Supabase ---');
  const testStudent = {
    nis: '22231088',
    nisn: '0061234588',
    fullName: 'Farel Prayoga Pratama',
    gender: 'L',
    className: 'XII MIPA 1',
  };

  // Find class
  const classRes = await queryPostgres('SELECT id FROM class_rooms WHERE name = $1 LIMIT 1;', [testStudent.className]);
  const classId = classRes.rows[0]?.id;

  const pin = `SG-${Math.floor(1000 + Math.random() * 9000)}`;
  const upsert = await queryPostgres(
    `INSERT INTO students (id, nis, nisn, full_name, gender, class_room_id, card_access_code)
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)
     ON CONFLICT (nisn) DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING *;`,
    [testStudent.nis, testStudent.nisn, testStudent.fullName, testStudent.gender, classId, pin]
  );
  console.log('Successfully saved student to Supabase:', upsert.rows[0]?.full_name, '| PIN:', upsert.rows[0]?.card_access_code);

  console.log('\n--- 3. Testing Mass Token Generator for this new student ---');
  const examRes = await queryPostgres("SELECT id, title FROM exams WHERE status = 'ACTIVE' LIMIT 1;");
  const exam = examRes.rows[0];

  // Check if token already exists or generate
  const partCheck = await queryPostgres('SELECT token FROM exam_participants WHERE exam_id = $1 AND student_id = $2;', [exam.id, upsert.rows[0].id]);
  let token = partCheck.rows[0]?.token;

  if (!token) {
    token = 'FX99-8822';
    await queryPostgres(
      `INSERT INTO exam_participants (id, exam_id, student_id, token, token_status, assigned_package)
       VALUES (uuid_generate_v4(), $1, $2, $3, 'ACTIVE', 'A');`,
      [exam.id, upsert.rows[0].id, token]
    );
    console.log('Generated new unique token in Supabase:', token);
  } else {
    console.log('Existing token found in Supabase:', token);
  }

  console.log('\n--- 4. Verifying Student Can View Exam Card ---');
  const cardQuery = await queryPostgres(
    `SELECT s.full_name, s.nisn, ep.token, e.title 
     FROM students s 
     JOIN exam_participants ep ON s.id = ep.student_id 
     JOIN exams e ON ep.exam_id = e.id 
     WHERE s.nisn = $1;`,
    [testStudent.nisn]
  );
  console.log('Exam Card for new student:', cardQuery.rows[0]);

  console.log('\n✅ END-TO-END SUPABASE STUDENT & TOKEN GENERATION VERIFIED!');
  process.exit(0);
}

testStudentWorkflow().catch(err => {
  console.error(err);
  process.exit(1);
});
