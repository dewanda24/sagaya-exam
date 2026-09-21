import pg from 'pg';
import './load-env.mjs';

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const q = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('ALL PUBLIC TABLES:');
  console.log(q.rows.map(r => r.table_name).join(', '));

  const questionsCols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'question_banks' ORDER BY ordinal_position;");
  console.log('\n=== question_banks columns ===');
  console.log(questionsCols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  const qr = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'question_revisions' ORDER BY ordinal_position;");
  console.log('\n=== question_revisions columns ===');
  console.log(qr.rows.map(x => `${x.column_name} (${x.data_type})`).join(', '));


  await client.end();
}

main().catch(console.error);
