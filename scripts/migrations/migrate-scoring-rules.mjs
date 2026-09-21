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

async function runScoringMigration() {
  console.log('--- Migrasi Database: Skema & Format Penilaian Ujian (Scoring Rules & KKM) ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✓ Terhubung ke PostgreSQL');

    // Tambah kolom scoring_rules_json dan passing_grade ke tabel exams
    await client.query(`
      ALTER TABLE exams 
      ADD COLUMN IF NOT EXISTS scoring_rules_json JSONB DEFAULT '{"mode":"TYPE_WEIGHTS","typeWeights":{"PILIHAN_GANDA":2,"PG_KOMPLEKS":3,"BENAR_SALAH":2,"MENJODOHKAN":3,"ISIAN_SINGKAT":2,"ESSAY":4},"passingGrade":75}'::jsonb,
      ADD COLUMN IF NOT EXISTS passing_grade NUMERIC(5,2) DEFAULT 75.0;
    `);
    console.log('✓ Kolom scoring_rules_json dan passing_grade berhasil ditambahkan ke tabel exams');

    // Update existing exams with default scoring rules if null
    await client.query(`
      UPDATE exams 
      SET scoring_rules_json = '{"mode":"TYPE_WEIGHTS","typeWeights":{"PILIHAN_GANDA":2,"PG_KOMPLEKS":3,"BENAR_SALAH":2,"MENJODOHKAN":3,"ISIAN_SINGKAT":2,"ESSAY":4},"passingGrade":75}'::jsonb,
          passing_grade = 75.0
      WHERE scoring_rules_json IS NULL OR passing_grade IS NULL;
    `);
    console.log('✓ Nilai default skema penilaian berhasil diinisialisasi untuk seluruh ujian');

    console.log('🎉 Migrasi Skema Penilaian Selesai dengan Sukses!');
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat migrasi skema penilaian:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runScoringMigration();
