import pg from 'pg';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  env.split('\n').forEach(l => {
    const trimmed = l.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=');
      process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
}

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

import crypto from 'crypto';

async function check() {
  await client.connect();
  const res1 = await client.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_answers' ORDER BY ordinal_position;");
  console.log('STUDENT_ANSWERS:', res1.rows.map(r => `${r.column_name}: ${r.data_type} (${r.udt_name})`));
  const res2 = await client.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exam_sessions' ORDER BY ordinal_position;");
  console.log('EXAM_SESSIONS:', res2.rows.map(r => `${r.column_name}: ${r.data_type} (${r.udt_name})`));
  const res3 = await client.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'exam_participants' ORDER BY ordinal_position;");
  console.log('EXAM_PARTICIPANTS:', res3.rows.map(r => `${r.column_name}: ${r.data_type} (${r.udt_name})`));
  await client.end();
}
check().catch(console.error);
