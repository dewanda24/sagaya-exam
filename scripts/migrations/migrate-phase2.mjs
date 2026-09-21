import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

function loadEnv() {
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
}

loadEnv();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DIRECT_URL atau DATABASE_URL tidak ditemukan.');
  process.exit(1);
}

async function runPhase2Migration() {
  console.log('--- Migrasi Database Fase 2 (Pilar 2 & 3: Standar Ujian & Kurasi MGMP) ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    await client.query('BEGIN;');

    // 1. Add curation fields and taxonomy to question_banks
    console.log('1. Updating question_banks columns for MGMP Curation...');
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'curation_status') THEN
          ALTER TABLE question_banks ADD COLUMN curation_status VARCHAR(30) DEFAULT 'APPROVED_REGIONAL';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'curation_notes') THEN
          ALTER TABLE question_banks ADD COLUMN curation_notes TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'curated_by') THEN
          ALTER TABLE question_banks ADD COLUMN curated_by VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'curated_at') THEN
          ALTER TABLE question_banks ADD COLUMN curated_at TIMESTAMP WITH TIME ZONE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'cognitive_level') THEN
          ALTER TABLE question_banks ADD COLUMN cognitive_level VARCHAR(50) DEFAULT 'L2_PENERAPAN';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'competence_code') THEN
          ALTER TABLE question_banks ADD COLUMN competence_code VARCHAR(100);
        END IF;
      END $$;
    `);

    // 2. Index for quick curation filtering
    console.log('2. Creating index on question_banks curation_status and is_shared...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_qb_curation ON question_banks (curation_status, is_shared);
      CREATE INDEX IF NOT EXISTS idx_exams_parent_regional ON exams (parent_exam_id, is_regional);
    `);

    // 3. Mark existing questions with valid default curation_status
    console.log('3. Updating null curation_status in existing questions...');
    await client.query(`
      UPDATE question_banks 
      SET curation_status = 'APPROVED_REGIONAL' 
      WHERE curation_status IS NULL;
    `);

    await client.query('COMMIT;');
    console.log('✅ Migrasi Fase 2 Selesai dengan Sukses!');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ Error during phase 2 migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runPhase2Migration();
