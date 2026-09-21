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
  console.log('--- [MIGRATION 003] Memulai Migrasi Authentication & Login Core ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    await client.query('BEGIN;');

    // 1. Users table additions: status, failed_login_attempts, locked_until
    console.log('1. Updating users table (status, failed_login_attempts, locked_until)...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'status'
        ) THEN
          ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE';
          -- Backfill status based on is_active
          UPDATE users SET status = CASE WHEN is_active = false THEN 'INACTIVE' ELSE 'ACTIVE' END;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'failed_login_attempts'
        ) THEN
          ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'locked_until'
        ) THEN
          ALTER TABLE users ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
    `);

    // 2. User sessions table additions: expires_at, revoked_at, device_name, session_version
    console.log('2. Updating user_sessions table (expires_at, revoked_at, device_name, session_version)...');
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

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'user_sessions' AND column_name = 'expires_at'
        ) THEN
          ALTER TABLE user_sessions ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days');
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'user_sessions' AND column_name = 'revoked_at'
        ) THEN
          ALTER TABLE user_sessions ADD COLUMN revoked_at TIMESTAMP WITH TIME ZONE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'user_sessions' AND column_name = 'device_name'
        ) THEN
          ALTER TABLE user_sessions ADD COLUMN device_name VARCHAR(100);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'user_sessions' AND column_name = 'session_version'
        ) THEN
          ALTER TABLE user_sessions ADD COLUMN session_version INT DEFAULT 0;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_revoked, last_activity_at);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup ON user_sessions(user_id, is_revoked, expires_at);
    `);

    // 3. Password reset tokens table
    console.log('3. Creating password_reset_tokens table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_pwd_reset_token_hash ON password_reset_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_pwd_reset_user_id ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_pwd_reset_valid ON password_reset_tokens(token_hash, used_at, expires_at);
    `);

    await client.query('COMMIT;');
    console.log('✅ [MIGRATION 003] Authentication & Login Core Migration SUCCEEDED 100%!');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
