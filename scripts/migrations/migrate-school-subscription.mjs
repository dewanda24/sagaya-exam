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

async function runMigration() {
  console.log('--- Migrasi: Lisensi & Masa Aktif Sekolah (Subscription) ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // 1. Tambah kolom subscription di tabel schools
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'subscription_tier') THEN
          ALTER TABLE schools ADD COLUMN subscription_tier VARCHAR(30) DEFAULT 'TAHUNAN';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'subscription_expires_at') THEN
          ALTER TABLE schools ADD COLUMN subscription_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '365 days');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'subscription_status') THEN
          ALTER TABLE schools ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'ACTIVE';
        END IF;
      END $$;
    `);

    // Pastikan seluruh sekolah eksisting memiliki tanggal aktif terisi
    await client.query(`
      UPDATE schools 
      SET subscription_expires_at = NOW() + INTERVAL '365 days'
      WHERE subscription_expires_at IS NULL;
    `);

    console.log('✅ Kolom subscription berhasil ditambahkan dan disinkronkan ke tabel schools.');
  } catch (err) {
    console.error('❌ Gagal menjalankan migrasi:', err);
  } finally {
    await client.end();
  }
}

runMigration();
