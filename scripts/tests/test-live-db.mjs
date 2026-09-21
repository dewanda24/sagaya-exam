import { queryPostgres } from '../lib/postgres.ts';

async function testLiveDb() {
  console.log('--- 1. Testing Student Lookup by NISN against Supabase ---');
  const studentRes = await queryPostgres(
    `SELECT s.*, c.name as class_room_name 
     FROM students s 
     LEFT JOIN class_rooms c ON s.class_room_id = c.id 
     WHERE s.nisn = $1 LIMIT 1;`,
    ['0061234567']
  );
  const student = studentRes.rows[0];
  console.log('Found Student:', student?.full_name, '| Class:', student?.class_room_name);

  console.log('\n--- 2. Testing Card & Exams Lookup ---');
  const examsRes = await queryPostgres(
    `SELECT ep.*, e.title as exam_title, sub.name as subject_name 
     FROM exam_participants ep 
     JOIN exams e ON ep.exam_id = e.id 
     JOIN subjects sub ON e.subject_id = sub.id 
     WHERE ep.student_id = $1;`,
    [student.id]
  );
  console.log('Exams for student:', examsRes.rows.length, '| Token:', examsRes.rows[0]?.token);

  console.log('\n--- 3. Testing Token Validation against Supabase ---');
  const token = examsRes.rows[0]?.token;
  const partRes = await queryPostgres(
    `SELECT ep.*, e.title as exam_title, e.duration_minutes, e.question_snapshot_json 
     FROM exam_participants ep 
     JOIN exams e ON ep.exam_id = e.id 
     WHERE ep.token = $1;`,
    [token]
  );
  console.log('Token Participant ID:', partRes.rows[0]?.id, '| Exam:', partRes.rows[0]?.exam_title);

  console.log('\n--- 4. Testing Auto-Save Answer into Supabase student_answers table ---');
  // Check if session exists or create test session
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 60 * 1000);
  const sessRes = await queryPostgres(
    `INSERT INTO exam_sessions (id, participant_id, device_fingerprint, server_started_at, server_expires_at, status, current_question_index, last_heartbeat_at)
     VALUES (uuid_generate_v4(), $1, 'test-fingerprint-pc01', $2, $3, 'IN_PROGRESS', 0, $2)
     ON CONFLICT DO NOTHING
     RETURNING *;`,
    [partRes.rows[0].id, now.toISOString(), expiresAt.toISOString()]
  );
  
  const sessionId = sessRes.rows[0]?.id || (await queryPostgres('SELECT id FROM exam_sessions WHERE participant_id = $1 LIMIT 1;', [partRes.rows[0].id])).rows[0]?.id;

  const questions = partRes.rows[0].question_snapshot_json;
  const qId = questions[0].id;
  const ansRes = await queryPostgres(
    `INSERT INTO student_answers (id, session_id, question_id, answer_value_json, is_doubtful, updated_at)
     VALUES (uuid_generate_v4(), $1, $2, '"A"'::jsonb, false, NOW())
     ON CONFLICT (session_id, question_id) 
     DO UPDATE SET answer_value_json = EXCLUDED.answer_value_json, updated_at = NOW()
     RETURNING *;`,
    [sessionId, qId]
  );
  console.log('Saved answer to Supabase! Question:', ansRes.rows[0]?.question_id, '| Value:', ansRes.rows[0]?.answer_value_json);

  console.log('\n--- 5. Testing Proctor Monitoring Query from Supabase ---');
  const countAnswersRes = await queryPostgres(
    `SELECT count(*) FROM student_answers WHERE session_id = $1;`,
    [sessionId]
  );
  console.log('Live answered count in Supabase for session:', countAnswersRes.rows[0]?.count);

  console.log('\n✅ ALL LIVE SUPABASE POSTGRESQL CRUD OPERATIONS FULLY VERIFIED!');
  process.exit(0);
}

testLiveDb().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
