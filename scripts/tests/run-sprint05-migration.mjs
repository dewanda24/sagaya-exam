import pg from 'pg';
import fs from 'fs';
import path from 'path';
import './load-env.mjs';

const { Client } = pg;
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DIRECT_URL atau DATABASE_URL tidak ditemukan.');
  process.exit(1);
}

async function runSprint05Migration() {
  console.log('--- Migrasi Database Sprint 05: Proctor Core ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260920_sprint05_proctor_core.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query('BEGIN;');
    await client.query(sql);
    await client.query('COMMIT;');

    console.log('✅ Migrasi Sprint 05 berhasil diaplikasikan ke database!');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ Gagal menjalankan migrasi Sprint 05:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSprint05Migration();
