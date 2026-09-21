import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

// Read .env.local or .env if present
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

async function runMigration() {
  console.log('--- Memulai Migrasi Multi-Sekolah & Super Admin ke Supabase ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Wrap in Transaction
    await client.query('BEGIN;');

    // 0. Ensure UUID Extension
    console.log('0. Ensuring uuid-ossp extension...');
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // 1. Create table schools
    console.log('1. Creating table schools...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        level VARCHAR(20) NOT NULL CHECK (level IN ('SD', 'SMP', 'SMA', 'SMK', 'MADRASAH', 'UMUM')),
        address TEXT,
        phone VARCHAR(30),
        email VARCHAR(100),
        principal_name VARCHAR(100),
        principal_nip VARCHAR(50),
        logo_url TEXT,
        header_title_1 VARCHAR(150) DEFAULT 'PEMERINTAH PROVINSI / DAERAH',
        header_title_2 VARCHAR(150) DEFAULT 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
        is_active BOOLEAN DEFAULT TRUE,
        quota_students INT DEFAULT 1000,
        quota_exams INT DEFAULT 50,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. Add school_id to related tables if not exists
    console.log('2. Adding school_id columns to master & transactional tables...');
    
    // Check and add to users
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'school_id') THEN
          ALTER TABLE users ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Update role check on users to include SUPER_ADMIN
    console.log('Updating user role constraint to allow SUPER_ADMIN...');
    await client.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'GURU', 'PENGAWAS'));
    `);

    // Check and add to class_rooms
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'class_rooms' AND column_name = 'school_id') THEN
          ALTER TABLE class_rooms ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Check and add to subjects
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'school_id') THEN
          ALTER TABLE subjects ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Check and add to students
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'school_id') THEN
          ALTER TABLE students ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Check and add to question_banks
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'school_id') THEN
          ALTER TABLE question_banks ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_banks' AND column_name = 'is_shared') THEN
          ALTER TABLE question_banks ADD COLUMN is_shared BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `);

    // Check and add to exams
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'school_id') THEN
          ALTER TABLE exams ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // Check and add to audit_logs
    console.log('Adding school_id to audit_logs...');
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'school_id') THEN
          ALTER TABLE audit_logs ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    // 2.1 Multi-Tenant Performance Indexes
    console.log('2.1 Creating multi-tenant performance indexes on school_id...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
      CREATE INDEX IF NOT EXISTS idx_class_rooms_school_id ON class_rooms(school_id);
      CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id);
      CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
      CREATE INDEX IF NOT EXISTS idx_question_banks_school_id ON question_banks(school_id);
      CREATE INDEX IF NOT EXISTS idx_exams_school_id ON exams(school_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON audit_logs(school_id);
      CREATE INDEX IF NOT EXISTS idx_question_banks_shared ON question_banks(is_shared, school_id);
    `);

    // 3. Seed Default Schools
    console.log('3. Seeding default schools...');
    await client.query(`
      INSERT INTO schools (
        id, code, name, level, address, phone, email, principal_name, principal_nip,
        header_title_1, header_title_2, is_active
      ) VALUES
      (
        '11111111-1111-1111-1111-111111111111',
        'SMAN1-SAGAYA',
        'SMA Negeri 1 Sagaya',
        'SMA',
        'Jl. Pendidikan No. 45, Sagaya, Jawa Barat',
        '(021) 8876-1234',
        'info@sman1sagaya.sch.id',
        'Drs. H. Mulyadi, M.Pd.',
        '19680512 199303 1 004',
        'PEMERINTAH DAERAH PROVINSI JAWA BARAT',
        'DINAS PENDIDIKAN DAN KEBUDAYAAN',
        true
      ),
      (
        '22222222-2222-2222-2222-222222222222',
        'SMK-PRESTASI',
        'SMK TI Prestasi Bangsa',
        'SMK',
        'Jl. Teknologi Raya No. 10, Sentra Digital',
        '(021) 7788-9900',
        'admin@smktiprestasi.sch.id',
        'Ir. Hendra Gunawan, M.Kom.',
        '19750820 200212 1 002',
        'YAYASAN PENDIDIKAN PRESTASI BANGSA',
        'SMK TEKNOLOGI INFORMASI PRESTASI BANGSA',
        true
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        principal_name = EXCLUDED.principal_name,
        principal_nip = EXCLUDED.principal_nip;
    `);

    // 4. Backfill existing records to SMAN 1 Sagaya
    console.log('4. Backfilling existing records to SMAN 1 Sagaya...');
    await client.query(`
      UPDATE users SET school_id = '11111111-1111-1111-1111-111111111111' WHERE school_id IS NULL AND role != 'SUPER_ADMIN';
      UPDATE class_rooms SET school_id = '11111111-1111-1111-1111-111111111111' WHERE school_id IS NULL;
      UPDATE subjects SET school_id = '11111111-1111-1111-1111-111111111111' WHERE school_id IS NULL;
      UPDATE students SET school_id = '11111111-1111-1111-1111-111111111111' WHERE school_id IS NULL;
      UPDATE question_banks SET school_id = '11111111-1111-1111-1111-111111111111' WHERE school_id IS NULL;
      UPDATE exams SET school_id = '11111111-1111-1111-1111-111111111111' WHERE school_id IS NULL;
    `);

    // 5. Seed Super Admin User
    console.log('5. Seeding Super Admin user...');
    await client.query(`
      INSERT INTO users (id, username, password_hash, full_name, role, is_active, school_id)
      VALUES (
        'a0000000-0000-0000-0000-000000000000',
        'superadmin',
        'hash_superadmin123',
        'Super Administrator Sagaya Exam',
        'SUPER_ADMIN',
        true,
        NULL
      )
      ON CONFLICT (username) DO UPDATE SET
        role = 'SUPER_ADMIN',
        full_name = EXCLUDED.full_name;
    `);

    // 6. Setup Supabase Storage Bucket for school-assets
    console.log('6. Setting up Supabase Storage bucket for school assets...');
    await client.query(`
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('school-assets', 'school-assets', true)
      ON CONFLICT (id) DO UPDATE SET public = true;
    `);

    // Create policy for public read, insert, update if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for school-assets'
        ) THEN
          CREATE POLICY "Public Access for school-assets" 
          ON storage.objects FOR SELECT 
          USING (bucket_id = 'school-assets');
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow Upload for school-assets'
        ) THEN
          CREATE POLICY "Allow Upload for school-assets" 
          ON storage.objects FOR INSERT 
          WITH CHECK (bucket_id = 'school-assets');
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow Update for school-assets'
        ) THEN
          CREATE POLICY "Allow Update for school-assets" 
          ON storage.objects FOR UPDATE 
          USING (bucket_id = 'school-assets');
        END IF;
      END $$;
    `);

    // Commit Transaction
    await client.query('COMMIT;');
    console.log('✅ MIGRASI MULTI-SEKOLAH & SUPER ADMIN BERHASIL 100%!');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ Error during migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
