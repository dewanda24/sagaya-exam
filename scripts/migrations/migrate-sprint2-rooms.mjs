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

async function runSprint2Migration() {
  console.log('--- Migrasi Database Sprint 2: Ruang Ujian, Sesi, & Alokasi Meja ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    await client.query('BEGIN;');

    // 1. Table exam_rooms
    console.log('1. Creating exam_rooms table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_rooms (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        code VARCHAR(30) NOT NULL,
        name VARCHAR(100) NOT NULL,
        capacity INT NOT NULL DEFAULT 30,
        proctor_name VARCHAR(100) DEFAULT '-',
        location VARCHAR(150),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_school_room_code UNIQUE (school_id, code)
      );
    `);

    // 2. Add columns to exam_participants for room & session allocation
    console.log('2. Updating exam_participants with room_id, session_number, and seat_number...');
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_participants' AND column_name = 'room_id') THEN
          ALTER TABLE exam_participants ADD COLUMN room_id UUID REFERENCES exam_rooms(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_participants' AND column_name = 'session_number') THEN
          ALTER TABLE exam_participants ADD COLUMN session_number INT DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_participants' AND column_name = 'seat_number') THEN
          ALTER TABLE exam_participants ADD COLUMN seat_number VARCHAR(10) DEFAULT '01';
        END IF;
      END $$;
    `);

    // 3. Table exam_room_proctors (plotting pengawas ruang per ujian & sesi)
    console.log('3. Creating exam_room_proctors table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_room_proctors (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
        room_id UUID REFERENCES exam_rooms(id) ON DELETE CASCADE,
        session_number INT NOT NULL DEFAULT 1,
        proctor_id UUID REFERENCES users(id) ON DELETE CASCADE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_exam_room_session UNIQUE (exam_id, room_id, session_number)
      );
    `);

    // 4. Seed default rooms for existing schools if none exist
    console.log('4. Seeding default computer labs for schools if empty...');
    await client.query(`
      INSERT INTO exam_rooms (school_id, code, name, capacity, proctor_name, location)
      SELECT s.id, 'LAB-01', 'Lab Komputer 1', 30, 'Teknisi Lab 1', 'Gedung Lab Lantai 2'
      FROM schools s
      WHERE NOT EXISTS (SELECT 1 FROM exam_rooms r WHERE r.school_id = s.id AND r.code = 'LAB-01')
      ON CONFLICT DO NOTHING;

      INSERT INTO exam_rooms (school_id, code, name, capacity, proctor_name, location)
      SELECT s.id, 'LAB-02', 'Lab Komputer 2', 30, 'Teknisi Lab 2', 'Gedung Lab Lantai 2'
      FROM schools s
      WHERE NOT EXISTS (SELECT 1 FROM exam_rooms r WHERE r.school_id = s.id AND r.code = 'LAB-02')
      ON CONFLICT DO NOTHING;
    `);

    // 5. Indexing for high-speed queries during exams
    console.log('5. Creating indexes on exam_participants for room and session queries...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_participants_room ON exam_participants(room_id);
      CREATE INDEX IF NOT EXISTS idx_participants_session ON exam_participants(session_number);
    `);

    await client.query('COMMIT;');
    console.log(' Migrasi Sprint 2 selesai dengan sukses!');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ Gagal menjalankan migrasi Sprint 2:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSprint2Migration();
