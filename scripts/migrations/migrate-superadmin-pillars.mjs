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
  console.error('❌ Error: DIRECT_URL atau DATABASE_URL tidak ditemukan di .env.local atau environment variables.');
  process.exit(1);
}

async function runSuperAdminMigration() {
  console.log('--- Memulai Migrasi 6 Pilar Super Admin (Dinas Pendidikan) ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    await client.query('BEGIN;');

    // 1. Create table system_settings
    console.log('1. Creating table system_settings...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(50) PRIMARY KEY,
        value_json JSONB NOT NULL,
        description TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // 2. Add npsn and rayon to schools
    console.log('2. Updating table schools (npsn, rayon)...');
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'npsn') THEN
          ALTER TABLE schools ADD COLUMN npsn VARCHAR(20);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schools' AND column_name = 'rayon') THEN
          ALTER TABLE schools ADD COLUMN rayon VARCHAR(50) DEFAULT 'Rayon 1 - Pusat';
        END IF;
      END $$;
    `);

    // 3. Add is_regional and parent_exam_id to exams (Pillar 2)
    console.log('3. Updating table exams (is_regional, parent_exam_id)...');
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'is_regional') THEN
          ALTER TABLE exams ADD COLUMN is_regional BOOLEAN DEFAULT FALSE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'parent_exam_id') THEN
          ALTER TABLE exams ADD COLUMN parent_exam_id UUID REFERENCES exams(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // 4. Add curation_status to question_banks (Pillar 3)
    console.log('4. Updating table question_banks (curation_status)...');
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'curation_status') THEN
          ALTER TABLE question_banks ADD COLUMN curation_status VARCHAR(20) DEFAULT 'APPROVED';
        END IF;
      END $$;
    `);

    // 5. Seed / update system_settings defaults
    console.log('5. Seeding default system_settings...');
    const settings = [
      {
        key: 'operational_mode',
        value: { mode: 'NORMAL', announcement: 'Sistem ujian Sagaya beroperasi normal untuk seluruh sekolah.' },
        desc: 'Mode operasional wilayah: NORMAL, PEKAN_UJIAN_WILAYAH, atau MAINTENANCE',
      },
      {
        key: 'integrity_policy',
        value: {
          maxTabSwitch: 3,
          heartbeatIntervalSeconds: 15,
          lateToleranceMinutes: 30,
          forceFullscreen: true,
        },
        desc: 'Standar kebijakan integritas dan anti-kecurangan siswa se-wilayah',
      },
      {
        key: 'scoring_policy',
        value: {
          kkmDefault: 75.0,
          pgComplexMode: 'PARTIAL_CREDIT',
          showScoreDefault: 'AFTER_ALL_DONE',
          gradingScale: 'SCALE_100',
          objectiveWeightPercent: 70,
          essayWeightPercent: 30,
        },
        desc: 'Standar model skoring, KKM/KKTP, dan persentase bobot naskah wilayah',
      },
      {
        key: 'default_quota',
        value: {
          quotaStudents: 500,
          quotaExams: 20,
        },
        desc: 'Batas kuota siswa dan ujian default untuk sekolah baru',
      },
      {
        key: 'agency_branding',
        value: {
          agencyName: 'Dinas Pendidikan dan Kebudayaan',
          regionName: 'Provinsi Jawa Barat',
          headerTitle1: 'PEMERINTAH PROVINSI JAWA BARAT',
          headerTitle2: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
          contactEmail: 'info@disdik.prov.go.id',
        },
        desc: 'Identitas dan legalitas instansi penyelenggara ujian wilayah',
      },
    ];

    for (const s of settings) {
      await client.query(
        `INSERT INTO system_settings (key, value_json, description, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET
           description = EXCLUDED.description;`,
        [s.key, JSON.stringify(s.value), s.desc]
      );
    }

    await client.query('COMMIT;');
    console.log('✅ MIGRASI 6 PILAR SUPER ADMIN BERHASIL 100%!');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ Error during superadmin migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSuperAdminMigration();
