import pg from 'pg';
import './load-env.mjs';

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const tables = ['users', 'students', 'class_rooms', 'subjects', 'exam_rooms', 'exams'];
  for (const t of tables) {
    const r = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position;", [t]);
    console.log(`\n=== Table: ${t} ===`);
    console.log(r.rows.map(x => `${x.column_name} (${x.data_type})`).join(', '));
  }
  await client.end();
}

main().catch(console.error);
