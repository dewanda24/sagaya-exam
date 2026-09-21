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
  console.log('--- Migrasi: Tabel broadcast_announcements ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS broadcast_announcements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'INFO' CHECK (priority IN ('INFO', 'WARNING', 'URGENT')),
        target_audience VARCHAR(30) DEFAULT 'ALL' CHECK (target_audience IN ('ALL', 'ADMIN_ONLY', 'STUDENT_ONLY', 'SPECIFIC_SCHOOL')),
        target_school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT TRUE,
        start_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Add index for active broadcasts query
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_broadcast_active 
      ON broadcast_announcements (is_active, start_at, expires_at);
    `);

    console.log('✅ Tabel broadcast_announcements berhasil dibuat / diverifikasi.');
  } catch (err) {
    console.error('❌ Gagal menjalankan migrasi:', err);
  } finally {
    await client.end();
  }
}

runMigration();
