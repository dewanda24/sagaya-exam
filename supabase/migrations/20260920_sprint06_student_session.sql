-- =========================================================
-- SAGAYA EXAM - SPRINT 06 STUDENT SESSION & AUTHENTICATION MIGRATION
-- Tanggal: 2026-09-20
-- =========================================================

-- 1. Perbarui exam_participants untuk mendukung hashing token, attempt tracking, dan multi-tenant
ALTER TABLE exam_participants 
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS attempt_number INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS eligible BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';

-- Backfill school_id dan token_hash pada exam_participants jika belum terisi
UPDATE exam_participants ep
SET school_id = e.school_id
FROM exams e
WHERE ep.exam_id = e.id AND ep.school_id IS NULL;

UPDATE exam_participants
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token IS NOT NULL AND token_hash IS NULL;

-- Indeks performa untuk verifikasi partisipan
CREATE INDEX IF NOT EXISTS idx_participants_exam_student ON exam_participants(exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_participants_school_status ON exam_participants(school_id, status);
CREATE INDEX IF NOT EXISTS idx_participants_token_hash ON exam_participants(token_hash);

-- 2. Perbarui exam_sessions untuk melengkapi state machine Sprint 06
ALTER TABLE exam_sessions
    ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS attempt_number INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS session_version INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Backfill relasi data yang ada pada exam_sessions
UPDATE exam_sessions es
SET exam_id = ep.exam_id,
    student_id = ep.student_id,
    school_id = ep.school_id,
    started_at = COALESCE(es.started_at, es.server_started_at),
    expires_at = COALESCE(es.expires_at, es.server_expires_at),
    device_id = COALESCE(es.device_id, es.device_fingerprint)
FROM exam_participants ep
WHERE es.participant_id = ep.id AND (es.exam_id IS NULL OR es.school_id IS NULL);

-- Perbarui CHECK constraint status pada exam_sessions
DO $$
BEGIN
    -- Normalisasi status lama sebelum mengubah constraint
    UPDATE exam_sessions SET status = 'CREATED' WHERE status = 'NOT_STARTED';
    UPDATE exam_sessions SET status = 'TIMEOUT' WHERE status = 'EXPIRED';
    UPDATE exam_sessions SET status = 'TERMINATED' WHERE status = 'LOCKED';

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'exam_sessions' AND constraint_name = 'exam_sessions_status_check'
    ) THEN
        ALTER TABLE exam_sessions DROP CONSTRAINT exam_sessions_status_check;
    END IF;

    ALTER TABLE exam_sessions ADD CONSTRAINT exam_sessions_status_check 
        CHECK (status IN ('CREATED', 'READY', 'IN_PROGRESS', 'DISCONNECTED', 'SUBMITTED', 'TIMEOUT', 'TERMINATED', 'INVALIDATED'));
END $$;

-- Pastikan hanya ada 1 sesi aktif per participant (Atomic Single-Active-Session Constraint)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_participant_session 
    ON exam_sessions (participant_id) 
    WHERE status IN ('READY', 'IN_PROGRESS', 'DISCONNECTED');

-- Indeks performa exam_sessions
CREATE INDEX IF NOT EXISTS idx_sessions_student_id ON exam_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exam_id ON exam_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_sessions_school_id ON exam_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON exam_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_heartbeat ON exam_sessions(last_heartbeat_at);

-- 3. Perbarui student_answers untuk mendukung idempotency & optimistic versioning
ALTER TABLE student_answers
    ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_student_answers_session_q ON student_answers(session_id, question_id);

-- 4. Buat tabel exam_session_violations (Server-Authoritative Violation Tracking)
CREATE TABLE IF NOT EXISTS exam_session_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES exam_participants(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- TAB_SWITCH, FOCUS_LOST, FULLSCREEN_EXIT, NETWORK_DISCONNECT, DEVICE_MISMATCH, SUSPICIOUS_RECONNECT
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_violations_sess ON exam_session_violations(session_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_violations_part_exam ON exam_session_violations(participant_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_session_violations_exam_created ON exam_session_violations(exam_id, created_at DESC);
