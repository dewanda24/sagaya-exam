import pg from 'pg';
import fs from 'fs';
import path from 'path';
import './load-env.mjs';

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to DB for migration Sprint 04...');
  const sqlFile = path.resolve('supabase/migrations/20260919_sprint04_guru_core.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  await client.query(sql);
  console.log('Migration 20260919_sprint04_guru_core.sql applied successfully!');
  await client.end();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
