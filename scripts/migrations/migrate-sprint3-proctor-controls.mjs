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

async function runSprint3Migration() {
  console.log('--- Migrasi Database Sprint 3: Kendali Token Dinamis & Broadcast Hari-H ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✓ Terhubung ke PostgreSQL');

    // 1. Tambah kolom release_token, token_released_at, token_expires_at, active_broadcast_message ke tabel exams
    await client.query(`
      ALTER TABLE exams 
      ADD COLUMN IF NOT EXISTS release_token VARCHAR(10),
      ADD COLUMN IF NOT EXISTS token_released_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS active_broadcast_message TEXT,
      ADD COLUMN IF NOT EXISTS active_broadcast_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log('✓ Kolom token rilis dinamis dan broadcast pesan kilat berhasil ditambahkan ke tabel exams');

    // 2. Set default initial token untuk ujian yang berstatus ACTIVE atau SCHEDULED
    await client.query(`
      UPDATE exams 
      SET release_token = 'SG' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
          token_released_at = NOW(),
          token_expires_at = NOW() + INTERVAL '120 minutes'
      WHERE release_token IS NULL AND status IN ('ACTIVE', 'SCHEDULED', 'PUBLISHED');
    `);
    console.log('✓ Inisialisasi token awal untuk ujian aktif berhasil disiapkan');

    console.log('🎉 Migrasi Sprint 3 Selesai dengan Sukses!');
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat migrasi Sprint 3:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSprint3Migration();
