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
  console.log('--- [MIGRATION 001] Memulai Migrasi Superadmin Core ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    await client.query('BEGIN;');

    // 1. Schools table additions
    console.log('1. Updating schools table (status, sync with is_active)...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'status'
        ) THEN
          ALTER TABLE schools ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE';
          -- Backfill status based on is_active
          UPDATE schools SET status = CASE WHEN is_active = false THEN 'SUSPENDED' ELSE 'ACTIVE' END;
        END IF;
      END $$;
    `);

    // 2. Users table additions
    console.log('2. Updating users table (session_version, must_change_password, last_login_at)...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'session_version'
        ) THEN
          ALTER TABLE users ADD COLUMN session_version INT DEFAULT 0;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'must_change_password'
        ) THEN
          ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_login_at'
        ) THEN
          ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
    `);

    // 3. Audit Logs additions
    console.log('3. Updating audit_logs table (user_agent, resource_type, resource_id, severity)...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'user_agent'
        ) THEN
          ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'resource_type'
        ) THEN
          ALTER TABLE audit_logs ADD COLUMN resource_type VARCHAR(50);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'resource_id'
        ) THEN
          ALTER TABLE audit_logs ADD COLUMN resource_id VARCHAR(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'severity'
        ) THEN
          ALTER TABLE audit_logs ADD COLUMN severity VARCHAR(20) DEFAULT 'INFO';
        END IF;
      END $$;
    `);

    // 4. Create user_sessions table
    console.log('4. Creating user_sessions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_token_hash VARCHAR(64) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        is_revoked BOOLEAN DEFAULT FALSE,
        revoked_reason TEXT,
        last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_revoked, last_activity_at);
    `);

    // 5. Update question_banks & create question_revisions
    console.log('5. Updating question_banks and creating question_revisions...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'question_banks' AND column_name = 'lifecycle_status'
        ) THEN
          ALTER TABLE question_banks ADD COLUMN lifecycle_status VARCHAR(20) DEFAULT 'DRAFT';
          UPDATE question_banks SET lifecycle_status = 'PUBLISHED' WHERE curation_status = 'APPROVED';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'question_banks' AND column_name = 'current_revision_number'
        ) THEN
          ALTER TABLE question_banks ADD COLUMN current_revision_number INT DEFAULT 1;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'question_banks' AND column_name = 'rejection_reason'
        ) THEN
          ALTER TABLE question_banks ADD COLUMN rejection_reason TEXT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'question_banks' AND column_name = 'is_global'
        ) THEN
          ALTER TABLE question_banks ADD COLUMN is_global BOOLEAN DEFAULT FALSE;
          UPDATE question_banks SET is_global = true WHERE is_shared = true;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS question_revisions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        question_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
        revision_number INT NOT NULL,
        topic VARCHAR(100) NOT NULL,
        difficulty VARCHAR(10),
        type VARCHAR(30) NOT NULL,
        question_text TEXT NOT NULL,
        media_url TEXT,
        media_type VARCHAR(20),
        options_json JSONB DEFAULT '[]'::jsonb,
        answer_key_json JSONB NOT NULL,
        rubric_json JSONB DEFAULT '{}'::jsonb,
        weight NUMERIC(5, 2) DEFAULT 1.0,
        tags TEXT[] DEFAULT '{}',
        stimulus_text TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_question_revision UNIQUE (question_id, revision_number)
      );

      CREATE INDEX IF NOT EXISTS idx_question_revisions_qid ON question_revisions(question_id);
    `);

    // 6. Create regional_exam_schools table
    console.log('6. Creating regional_exam_schools table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS regional_exam_schools (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_regional_exam_school UNIQUE (exam_id, school_id)
      );

      CREATE INDEX IF NOT EXISTS idx_reg_exam_schools_exam ON regional_exam_schools(exam_id);
      CREATE INDEX IF NOT EXISTS idx_reg_exam_schools_school ON regional_exam_schools(school_id);
    `);

    await client.query('COMMIT;');
    console.log('✅ [MIGRATION 001] Superadmin Core Database Migration SUCCEEDED 100%!');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
