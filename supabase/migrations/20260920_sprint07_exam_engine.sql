-- =========================================================
-- SAGAYA EXAM - SPRINT 07 EXAM ENGINE & QUESTION DELIVERY MIGRATION
-- Tanggal: 2026-09-20
-- =========================================================

-- 1. Tabel exam_snapshots: Menyimpan snapshot spesifikasi & konfigurasi ujian yang beku (immutable)
CREATE TABLE IF NOT EXISTS exam_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_exam_snapshot_version UNIQUE (exam_id, version)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_exam_id ON exam_snapshots(exam_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_school_id ON exam_snapshots(school_id);

-- 2. Tabel exam_snapshot_questions: Butir soal beku dalam snapshot (termasuk kunci, rubrik, opsi stabil)
CREATE TABLE IF NOT EXISTS exam_snapshot_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id UUID NOT NULL REFERENCES exam_snapshots(id) ON DELETE CASCADE,
    question_id UUID REFERENCES question_banks(id) ON DELETE SET NULL,
    question_version_id UUID,
    position INT NOT NULL,
    section VARCHAR(50) DEFAULT 'MAIN',
    points NUMERIC(5,2) DEFAULT 1.0,
    configuration_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_snapshot_question_pos UNIQUE (snapshot_id, position)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_questions_snap ON exam_snapshot_questions(snapshot_id, position);
CREATE INDEX IF NOT EXISTS idx_snapshot_questions_qid ON exam_snapshot_questions(question_id);

-- 3. Tabel question_order_maps: Urutan soal deterministik per sesi ujian (tetap stabil saat refresh)
CREATE TABLE IF NOT EXISTS question_order_maps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    snapshot_question_id UUID NOT NULL REFERENCES exam_snapshot_questions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL,
    display_position INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_session_display_pos UNIQUE (session_id, display_position),
    CONSTRAINT uq_session_qmap UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_q_order_session_pos ON question_order_maps(session_id, display_position);

-- 4. Tabel option_order_maps: Urutan opsi jawaban deterministik per sesi ujian (tetap stabil saat refresh)
CREATE TABLE IF NOT EXISTS option_order_maps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL,
    option_id VARCHAR(100) NOT NULL,
    display_position INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_session_q_opt UNIQUE (session_id, question_id, option_id),
    CONSTRAINT uq_session_q_display_pos UNIQUE (session_id, question_id, display_position)
);

CREATE INDEX IF NOT EXISTS idx_opt_order_session_q ON option_order_maps(session_id, question_id, display_position);

-- 5. Tambah kolom active_snapshot_id dan navigation_policy pada exams
ALTER TABLE exams
    ADD COLUMN IF NOT EXISTS active_snapshot_id UUID REFERENCES exam_snapshots(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS navigation_policy VARCHAR(30) DEFAULT 'FREE_NAVIGATION';

-- Tambahkan constraint CHECK navigation_policy jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'exams_navigation_policy_check'
    ) THEN
        ALTER TABLE exams ADD CONSTRAINT exams_navigation_policy_check 
            CHECK (navigation_policy IN ('FREE_NAVIGATION', 'LINEAR_NAVIGATION'));
    END IF;
END $$;

-- 6. Tambah kolom snapshot_id dan random_seed pada exam_sessions
ALTER TABLE exam_sessions
    ADD COLUMN IF NOT EXISTS snapshot_id UUID REFERENCES exam_snapshots(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS random_seed VARCHAR(64);

-- 7. Tambah kolom pada student_answers untuk mendukung state machine pengerjaan soal
ALTER TABLE student_answers
    ADD COLUMN IF NOT EXISTS question_version_id UUID,
    ADD COLUMN IF NOT EXISTS state VARCHAR(20) DEFAULT 'UNANSWERED',
    ADD COLUMN IF NOT EXISTS marked_for_review BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'student_answers_state_check'
    ) THEN
        ALTER TABLE student_answers ADD CONSTRAINT student_answers_state_check 
            CHECK (state IN ('UNANSWERED', 'ANSWERED', 'CLEARED'));
    END IF;
END $$;

-- Sinkronkan state awal pada student_answers jika answer_value_json terisi
UPDATE student_answers
SET state = 'ANSWERED'
WHERE answer_value_json IS NOT NULL AND state = 'UNANSWERED';

UPDATE student_answers
SET marked_for_review = is_doubtful
WHERE marked_for_review IS FALSE AND is_doubtful IS TRUE;
