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

async function runStimulusMigration() {
  console.log('--- Migrasi Database: Shared Stimulus / Wacana Soal Cerita Bersama ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL.');

    console.log('1. Menambahkan kolom stimulus ke tabel question_banks jika belum ada...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'stimulus_id') THEN
          ALTER TABLE question_banks ADD COLUMN stimulus_id VARCHAR(100);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'stimulus_title') THEN
          ALTER TABLE question_banks ADD COLUMN stimulus_title VARCHAR(255);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'stimulus_text') THEN
          ALTER TABLE question_banks ADD COLUMN stimulus_text TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'stimulus_media_url') THEN
          ALTER TABLE question_banks ADD COLUMN stimulus_media_url TEXT;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_qb_stimulus_id ON question_banks (stimulus_id);
    `);

    console.log('✅ Migrasi kolom stimulus_id, stimulus_title, stimulus_text, stimulus_media_url berhasil!');
  } catch (err) {
    console.error('❌ Gagal menjalankan migrasi:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runStimulusMigration();
