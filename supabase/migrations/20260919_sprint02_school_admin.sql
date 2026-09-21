-- =========================================================
-- SAGAYA EXAM - SPRINT 02 SCHOOL ADMIN OPERATIONS MIGRATION
-- Tanggal: 2026-09-19
-- =========================================================

-- 1. Academic Years (Tahun Ajaran)
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

-- 2. Semesters (Semester 1 & 2 per Tahun Ajaran)
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

-- 3. Teacher Subjects (Relasi Guru - Mata Pelajaran)
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

-- 4. Teacher Classes (Relasi Guru - Kelas - Mata Pelajaran)
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

-- 5. Exam Questions (Pemetaan Soal ke Ujian & Snapshot Versi)
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

-- 6. Ekstensi Kolom Tabel Schools
ALTER TABLE schools ADD COLUMN IF NOT EXISTS nss VARCHAR(50);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS village VARCHAR(100);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS province VARCHAR(100);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS website VARCHAR(150);

-- 7. Ekstensi Kolom Tabel Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS nuptk VARCHAR(50);

-- 8. Ekstensi Kolom Tabel Students
ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_place VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS entry_year VARCHAR(10);
ALTER TABLE students ADD COLUMN IF NOT EXISTS rombel VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';

-- 9. Ekstensi Kolom Tabel Class Rooms
ALTER TABLE class_rooms ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL;
ALTER TABLE class_rooms ADD COLUMN IF NOT EXISTS homeroom_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE class_rooms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 10. Ekstensi Kolom Tabel Subjects
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS level VARCHAR(20);
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'UMUM';
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 11. Ekstensi Kolom Tabel Exams
ALTER TABLE exams ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES semesters(id) ON DELETE SET NULL;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS target_class_ids UUID[] DEFAULT '{}';

-- 12. Composite Indexes untuk Performa Multi-Tenant
CREATE INDEX IF NOT EXISTS idx_students_tenant_status ON students(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_students_tenant_class ON students(school_id, class_room_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(school_id, role, is_active);
CREATE INDEX IF NOT EXISTS idx_exams_tenant_status ON exams(school_id, status);
CREATE INDEX IF NOT EXISTS idx_question_banks_tenant ON question_banks(school_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_exam_participants_tenant ON exam_participants(exam_id, student_id);
