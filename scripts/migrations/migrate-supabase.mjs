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

async function runMigration() {
  console.log('Connecting to Supabase PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL successfully!');

    // Read schema.sql
    const schemaPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Verifying & executing schema.sql DDL...');
    await client.query(sql);
    console.log('Schema DDL verified successfully!');

    // 1. Insert Users (Admin, Guru, Pengawas)
    await client.query(`
      INSERT INTO users (id, username, password_hash, full_name, role) VALUES
      ('a1111111-1111-1111-1111-111111111111', 'admin', 'hash_admin123', 'Administrator Sagaya', 'ADMIN'),
      ('a2222222-2222-2222-2222-222222222222', 'budi.guru', 'hash_guru123', 'Drs. Budi Setiawan, M.Pd.', 'GURU'),
      ('a3333333-3333-3333-3333-333333333333', 'pengawas1', 'hash_pengawas123', 'Pengawas Ruang 01 (Ibu Ratna)', 'PENGAWAS')
      ON CONFLICT (username) DO NOTHING;
    `);

    // 2. Insert Classes
    await client.query(`
      INSERT INTO class_rooms (id, name, level, academic_year) VALUES
      ('c1111111-1111-1111-1111-111111111111', 'XII MIPA 1', '12', '2025/2026'),
      ('c2222222-2222-2222-2222-222222222222', 'XII MIPA 2', '12', '2025/2026'),
      ('c3333333-3333-3333-3333-333333333333', 'XII IPS 1', '12', '2025/2026')
      ON CONFLICT DO NOTHING;
    `);

    // 3. Insert Subjects (Using valid hex UUIDs)
    await client.query(`
      INSERT INTO subjects (id, code, name) VALUES
      ('b1111111-1111-1111-1111-111111111111', 'MAT-12', 'Matematika Wajib'),
      ('b2222222-2222-2222-2222-222222222222', 'BIN-12', 'Bahasa Indonesia'),
      ('b3333333-3333-3333-3333-333333333333', 'BIO-12', 'Biologi')
      ON CONFLICT (code) DO NOTHING;
    `);

    // 4. Insert Students
    await client.query(`
      INSERT INTO students (id, nis, nisn, full_name, gender, class_room_id, card_access_code) VALUES
      ('d1111111-1111-1111-1111-111111111111', '22231001', '0061234567', 'Ahmad Fauzi', 'L', 'c1111111-1111-1111-1111-111111111111', 'SG-9921'),
      ('d2222222-2222-2222-2222-222222222222', '22231002', '0061234568', 'Siti Aisyah Nur', 'P', 'c1111111-1111-1111-1111-111111111111', 'SG-9922'),
      ('d3333333-3333-3333-3333-333333333333', '22231003', '0061234569', 'Budi Santoso', 'L', 'c1111111-1111-1111-1111-111111111111', 'SG-9923'),
      ('d4444444-4444-4444-4444-444444444444', '22231004', '0061234570', 'Dewi Sartika Putri', 'P', 'c1111111-1111-1111-1111-111111111111', 'SG-9924')
      ON CONFLICT (nisn) DO NOTHING;
    `);

    // 5. Insert Question Bank items (6 types)
    await client.query(`
      INSERT INTO question_banks (id, subject_id, teacher_id, topic, difficulty, type, question_text, options_json, answer_key_json, weight)
      VALUES
      (
        'e1111111-1111-1111-1111-111111111111',
        'b1111111-1111-1111-1111-111111111111',
        'a2222222-2222-2222-2222-222222222222',
        'Turunan Fungsi Aljabar',
        'MEDIUM',
        'PILIHAN_GANDA',
        'Turunan pertama dari fungsi f(x) = 3x³ - 5x² + 4x - 7 adalah...',
        '[{"id":"A","text":"f''(x) = 9x² - 10x + 4"},{"id":"B","text":"f''(x) = 6x² - 10x + 4"},{"id":"C","text":"f''(x) = 9x² - 5x + 4"},{"id":"D","text":"f''(x) = 3x² - 10x + 4"},{"id":"E","text":"f''(x) = 9x² - 10x - 7"}]'::jsonb,
        '"A"'::jsonb,
        10
      ),
      (
        'e2222222-2222-2222-2222-222222222222',
        'b1111111-1111-1111-1111-111111111111',
        'a2222222-2222-2222-2222-222222222222',
        'Statistika & Peluang',
        'HARD',
        'PG_KOMPLEKS',
        'Diberikan data nilai: 6, 7, 8, 8, 9, 10. Manakah pernyataan berikut yang bernilai BENAR? (Pilih semua yang sesuai)',
        '[{"id":"A","text":"Rata-rata (mean) data adalah 8,0"},{"id":"B","text":"Median data tersebut adalah 8,0"},{"id":"C","text":"Modus data adalah 8"},{"id":"D","text":"Jangkauan (range) data adalah 5"}]'::jsonb,
        '["A", "B", "C"]'::jsonb,
        15
      ),
      (
        'e3333333-3333-3333-3333-333333333333',
        'b1111111-1111-1111-1111-111111111111',
        'a2222222-2222-2222-2222-222222222222',
        'Trigonometri',
        'EASY',
        'BENAR_SALAH',
        'Pernyataan: Nilai dari sin(30°) sama dengan cos(60°), yaitu 1/2.',
        '[]'::jsonb,
        '"BENAR"'::jsonb,
        10
      ),
      (
        'e4444444-4444-4444-4444-444444444444',
        'b1111111-1111-1111-1111-111111111111',
        'a2222222-2222-2222-2222-222222222222',
        'Matriks & Transformasi',
        'MEDIUM',
        'MENJODOHKAN',
        'Jodohkan istilah matriks pada kolom kiri dengan deskripsinya yang tepat pada kolom kanan:',
        '[]'::jsonb,
        '{"Matriks Identitas": "Elemen diagonal utama 1 dan lainnya 0", "Matriks Transpose": "Pertukaran posisi baris menjadi kolom", "Determinan = 0": "Matriks Singular (tidak punya invers)"}'::jsonb,
        20
      ),
      (
        'e5555555-5555-5555-5555-555555555555',
        'b1111111-1111-1111-1111-111111111111',
        'a2222222-2222-2222-2222-222222222222',
        'Barisan dan Deret',
        'MEDIUM',
        'ISIAN_SINGKAT',
        'Suku ke-10 dari barisan aritmetika 3, 7, 11, 15, ... adalah (tuliskan angka saja):',
        '[]'::jsonb,
        '["39"]'::jsonb,
        15
      ),
      (
        'e6666666-6666-6666-6666-666666666666',
        'b1111111-1111-1111-1111-111111111111',
        'a2222222-2222-2222-2222-222222222222',
        'Aplikasi Turunan',
        'HARD',
        'ESSAY',
        'Sebuah kawat sepanjang 100 meter akan dibuat menjadi sebuah persegi panjang. Jelaskan langkah-langkah penentuan ukuran panjang dan lebar agar luas persegi panjang tersebut maksimum, serta hitung luas maksimum yang dihasilkan!',
        '[]'::jsonb,
        '"Panjang = 25m, Lebar = 25m, Luas Maksimum = 625 m²"'::jsonb,
        30
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    // 6. Insert Active Exam with Snapshot
    const questionsRows = await client.query('SELECT * FROM question_banks;');
    const snapshotJson = JSON.stringify(questionsRows.rows.map(r => ({
      id: r.id,
      subjectId: r.subject_id,
      topic: r.topic,
      difficulty: r.difficulty,
      type: r.type,
      questionText: r.question_text,
      options: r.options_json,
      answerKey: r.answer_key_json,
      weight: parseFloat(r.weight)
    })));

    const now = new Date();
    const startTime = new Date(now.getTime() - 1000 * 60 * 30).toISOString();
    const endTime = new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString();

    await client.query(`
      INSERT INTO exams (id, title, subject_id, created_by, status, window_mode, start_time, end_time, duration_minutes, question_snapshot_json)
      VALUES (
        'f1111111-1111-1111-1111-111111111111',
        'Penilaian Sumatif Akhir Semester (PSAS) - Matematika Wajib',
        'b1111111-1111-1111-1111-111111111111',
        'a2222222-2222-2222-2222-222222222222',
        'ACTIVE',
        'FLEXIBLE',
        $1,
        $2,
        90,
        $3::jsonb
      )
      ON CONFLICT (id) DO NOTHING;
    `, [startTime, endTime, snapshotJson]);

    // 7. Insert Exam Participants with Tokens
    await client.query(`
      INSERT INTO exam_participants (id, exam_id, student_id, token, token_status, assigned_package)
      VALUES
      ('00000000-0000-0000-0000-000000000001', 'f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'A7K9-2M4P', 'ACTIVE', 'A'),
      ('00000000-0000-0000-0000-000000000002', 'f1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222', 'B4X8-9L2K', 'ACTIVE', 'B'),
      ('00000000-0000-0000-0000-000000000003', 'f1111111-1111-1111-1111-111111111111', 'd3333333-3333-3333-3333-333333333333', 'C3M7-5P1R', 'ACTIVE', 'C'),
      ('00000000-0000-0000-0000-000000000004', 'f1111111-1111-1111-1111-111111111111', 'd4444444-4444-4444-4444-444444444444', 'D8F2-4W9Q', 'ACTIVE', 'D')
      ON CONFLICT DO NOTHING;
    `);

    console.log('All Supabase tables and seed data created successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
