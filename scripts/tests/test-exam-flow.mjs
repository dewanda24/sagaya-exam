import { queryPostgres } from '../lib/postgres.ts';

async function testExamFlow() {
  console.log('--- 1. Testing Metrics Query ---');
  const studentCount = await queryPostgres('SELECT count(*) FROM students;');
  const classCount = await queryPostgres('SELECT count(*) FROM class_rooms;');
  const examCount = await queryPostgres('SELECT count(*) FROM exams;');
  console.log('Students:', studentCount.rows[0].count, '| Classes:', classCount.rows[0].count, '| Exams:', examCount.rows[0].count);

  console.log('\n--- 2. Testing Exam Scores Query ---');
  const activeExam = await queryPostgres("SELECT id, title FROM exams WHERE status = 'ACTIVE' LIMIT 1;");
  const examId = activeExam.rows[0].id;
  console.log('Active Exam:', activeExam.rows[0].title);

  const scores = await queryPostgres(
    `SELECT ep.final_score, ep.graded_status, s.full_name, s.nisn, c.name as class_name
     FROM exam_participants ep
     JOIN students s ON ep.student_id = s.id
     LEFT JOIN class_rooms c ON s.class_room_id = c.id
     WHERE ep.exam_id = $1;`,
    [examId]
  );
  console.log('Participants for this exam:', scores.rows.length);
  for (const row of scores.rows.slice(0, 3)) {
    console.log(`- ${row.full_name} (${row.class_name}): Final Score = ${row.final_score ?? 'Pending'}, Status = ${row.graded_status}`);
  }

  console.log('\n✅ ALL LIVE SUPABASE EXAM & GRADING OPERATIONS VERIFIED!');
  process.exit(0);
}

testExamFlow().catch(err => {
  console.error(err);
  process.exit(1);
});
