-- =========================================================
-- SAGAYA EXAM - SUPABASE POSTGRESQL SCHEMA
-- Sistem Ujian Online Berbasis Token
-- =========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Schools (Satuan Pendidikan - Multi-Tenant)
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

-- 1. Users (Super Admin, Admin, Guru, Pengawas)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'GURU', 'PENGAWAS')),
    is_active BOOLEAN DEFAULT TRUE,
    session_version INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Class Rooms (Rombel)
CREATE TABLE IF NOT EXISTS class_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    level VARCHAR(10) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Subjects (Mata Pelajaran)
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Students (Siswa - Tanpa Akun Login Permanen)
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    nis VARCHAR(20) NOT NULL,
    nisn VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    gender VARCHAR(1) CHECK (gender IN ('L', 'P')),
    class_room_id UUID REFERENCES class_rooms(id) ON DELETE SET NULL,
    card_access_code VARCHAR(20) NOT NULL, -- PIN / Kode Akses Kartu Ujian
    photo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Question Bank (Bank Soal Guru)
CREATE TABLE IF NOT EXISTS question_banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    topic VARCHAR(100) NOT NULL,
    difficulty VARCHAR(10) CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
    type VARCHAR(30) NOT NULL CHECK (type IN (
        'PILIHAN_GANDA', 
        'PG_KOMPLEKS', 
        'BENAR_SALAH', 
        'MENJODOHKAN', 
        'ISIAN_SINGKAT', 
        'ESSAY'
    )),
    question_text TEXT NOT NULL,
    media_url TEXT,
    media_type VARCHAR(20) CHECK (media_type IN ('IMAGE', 'AUDIO', 'VIDEO', 'NONE')),
    options_json JSONB DEFAULT '[]'::jsonb,      -- Array pilihan jawaban
    answer_key_json JSONB NOT NULL,              -- Kunci jawaban (format sesuai tipe soal)
    rubric_json JSONB DEFAULT '{}'::jsonb,       -- Rubrik penilaian essay
    weight NUMERIC(5, 2) DEFAULT 1.0,
    tags TEXT[] DEFAULT '{}',
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Exams (Ujian & Snapshot Soal)
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE RESTRICT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'PUBLISHED', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'
    )),
    window_mode VARCHAR(20) DEFAULT 'FLEXIBLE' CHECK (window_mode IN ('SIMULTANEOUS', 'FLEXIBLE')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 90,
    randomize_questions BOOLEAN DEFAULT TRUE,
    randomize_options BOOLEAN DEFAULT TRUE,
    show_score_policy VARCHAR(20) DEFAULT 'AFTER_ALL_DONE' CHECK (show_score_policy IN (
        'IMMEDIATELY', 'AFTER_ALL_DONE', 'SCHEDULED', 'NEVER'
    )),
    ip_restricted BOOLEAN DEFAULT FALSE,
    allowed_ip_range TEXT,
    question_snapshot_json JSONB DEFAULT '[]'::jsonb, -- Snapshot soal beku saat PUBLISHED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Exam Participants (Peserta & Token Individual)
CREATE TABLE IF NOT EXISTS exam_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    token VARCHAR(12) NOT NULL,                  -- Format: e.g. A7K9-2M4P (Unik per siswa per ujian)
    token_status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (token_status IN ('ACTIVE', 'REVOKED', 'USED')),
    assigned_package VARCHAR(5) DEFAULT 'A',     -- Paket A, B, C, D
    final_score NUMERIC(5, 2) DEFAULT NULL,
    graded_status VARCHAR(20) DEFAULT 'PENDING' CHECK (graded_status IN ('PENDING', 'PARTIAL', 'GRADED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_participant_exam UNIQUE (exam_id, student_id),
    CONSTRAINT uq_exam_token UNIQUE (exam_id, token)
);

-- 8. Exam Sessions (Sesi Aktif Pengerjaan & Device Binding)
CREATE TABLE IF NOT EXISTS exam_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID UNIQUE REFERENCES exam_participants(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    server_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    server_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'IN_PROGRESS' CHECK (status IN (
        'NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'DISCONNECTED', 'EXPIRED', 'LOCKED'
    )),
    current_question_index INT DEFAULT 0,
    last_heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tab_violation_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Student Answers (Auto-Save Jawaban Peserta)
CREATE TABLE IF NOT EXISTS student_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL,
    answer_value_json JSONB,                     -- Pilihan, teks, atau susunan penjodohan
    is_doubtful BOOLEAN DEFAULT FALSE,           -- Flag ragu-ragu
    auto_score NUMERIC(5, 2) DEFAULT NULL,
    manual_score NUMERIC(5, 2) DEFAULT NULL,
    feedback TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_session_question UNIQUE (session_id, question_id)
);

-- 10. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID,
    role VARCHAR(20),
    action VARCHAR(50) NOT NULL,
    details_json JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for maximum performance
CREATE INDEX IF NOT EXISTS idx_participants_token ON exam_participants(token);
CREATE INDEX IF NOT EXISTS idx_sessions_heartbeat ON exam_sessions(last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON exam_sessions(status);
CREATE INDEX IF NOT EXISTS idx_answers_session ON student_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_students_nisn ON students(nisn);
CREATE INDEX IF NOT EXISTS idx_students_card_code ON students(card_access_code);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON audit_logs(school_id);
