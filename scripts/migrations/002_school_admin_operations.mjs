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

async function runSprint02Migration() {
  console.log('--- [MIGRATION 002] Memulai Migrasi Database Sprint 02: Admin Sekolah ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database successfully.');

    await client.query('BEGIN;');

    // 1. Academic Years table
    console.log('1. Creating academic_years table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_school_academic_year UNIQUE (school_id, name)
      );

      CREATE INDEX IF NOT EXISTS idx_academic_years_school ON academic_years(school_id);
      CREATE INDEX IF NOT EXISTS idx_academic_years_status ON academic_years(school_id, status);
    `);

    // 2. Semesters table
    console.log('2. Creating semesters table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS semesters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_school_year_semester UNIQUE (academic_year_id, name)
      );

      CREATE INDEX IF NOT EXISTS idx_semesters_school ON semesters(school_id);
      CREATE INDEX IF NOT EXISTS idx_semesters_academic_year ON semesters(academic_year_id);
    `);

    // 3. Teacher Subjects table
    console.log('3. Creating teacher_subjects table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS teacher_subjects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_teacher_subject UNIQUE (school_id, teacher_id, subject_id)
      );

      CREATE INDEX IF NOT EXISTS idx_teacher_subjects_school ON teacher_subjects(school_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher ON teacher_subjects(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject ON teacher_subjects(subject_id);
    `);

    // 4. Teacher Classes table
    console.log('4. Creating teacher_classes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS teacher_classes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        class_room_id UUID NOT NULL REFERENCES class_rooms(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_teacher_class_subject UNIQUE (school_id, teacher_id, class_room_id, subject_id)
      );

      CREATE INDEX IF NOT EXISTS idx_teacher_classes_school ON teacher_classes(school_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher ON teacher_classes(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_teacher_classes_class ON teacher_classes(class_room_id);
    `);

    // 5. Exam Questions table
    console.log('5. Creating exam_questions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_questions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        question_id UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
        revision_number INT NOT NULL DEFAULT 1,
        order_index INT NOT NULL DEFAULT 0,
        weight NUMERIC(5,2) DEFAULT 1.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_exam_question UNIQUE (exam_id, question_id)
      );

      CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id);
      CREATE INDEX IF NOT EXISTS idx_exam_questions_question ON exam_questions(question_id);
    `);

    // 6. Extending schools table
    console.log('6. Extending schools table (nss, village, district, city, province, postal_code, website)...');
    await client.query(`
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS nss VARCHAR(50);
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS village VARCHAR(100);
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS district VARCHAR(100);
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS province VARCHAR(100);
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS website VARCHAR(150);
    `);

    // 7. Extending users table
    console.log('7. Extending users table (nuptk)...');
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS nuptk VARCHAR(50);
    `);

    // 8. Extending students table
    console.log('8. Extending students table (birth_place, birth_date, entry_year, rombel, status)...');
    await client.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_place VARCHAR(100);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_date DATE;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS entry_year VARCHAR(10);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS rombel VARCHAR(50);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
    `);

    // 9. Extending class_rooms table
    console.log('9. Extending class_rooms table (academic_year_id, homeroom_teacher_id, is_active)...');
    await client.query(`
      ALTER TABLE class_rooms ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL;
      ALTER TABLE class_rooms ADD COLUMN IF NOT EXISTS homeroom_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE class_rooms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    `);

    // 10. Extending subjects table
    console.log('10. Extending subjects table (level, category, is_active)...');
    await client.query(`
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS level VARCHAR(20);
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'UMUM';
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    `);

    // 11. Extending exams table
    console.log('11. Extending exams table (academic_year_id, semester_id, target_class_ids)...');
    await client.query(`
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL;
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES semesters(id) ON DELETE SET NULL;
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS target_class_ids UUID[] DEFAULT '{}';
    `);

    // 12. Composite Indexes for multi-tenant isolation and fast lookup
    console.log('12. Creating composite multi-tenant indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_tenant_status ON students(school_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_students_tenant_class ON students(school_id, class_room_id);
      CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(school_id, role, is_active);
      CREATE INDEX IF NOT EXISTS idx_exams_tenant_status ON exams(school_id, status);
      CREATE INDEX IF NOT EXISTS idx_question_banks_tenant ON question_banks(school_id, lifecycle_status);
      CREATE INDEX IF NOT EXISTS idx_exam_participants_tenant ON exam_participants(exam_id, student_id);
    `);

    // 13. Seed default academic year and semester for active schools if missing
    console.log('13. Seeding initial academic year & semester for schools...');
    await client.query(`
      DO $$
      DECLARE
        s RECORD;
        new_year_id UUID;
      BEGIN
        FOR s IN SELECT id FROM schools LOOP
          IF NOT EXISTS (SELECT 1 FROM academic_years WHERE school_id = s.id) THEN
            INSERT INTO academic_years (school_id, name, start_date, end_date, status)
            VALUES (s.id, '2026/2027', '2026-07-15', '2027-06-20', 'ACTIVE')
            RETURNING id INTO new_year_id;

            INSERT INTO semesters (academic_year_id, school_id, name, status)
            VALUES 
              (new_year_id, s.id, 'Semester Ganjil', 'ACTIVE'),
              (new_year_id, s.id, 'Semester Genap', 'DRAFT')
            ON CONFLICT DO NOTHING;

            -- Attach to existing classes
            UPDATE class_rooms SET academic_year_id = new_year_id WHERE school_id = s.id AND academic_year_id IS NULL;
          END IF;
        END LOOP;
      END $$;
    `);

    await client.query('COMMIT;');
    console.log('✅ [MIGRATION 002] Migrasi Database Sprint 02 School Admin BERHASIL 100%!');
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSprint02Migration();
