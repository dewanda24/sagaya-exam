-- =========================================================
-- SAGAYA EXAM - SPRINT 00 SECURITY FOUNDATION MIGRATION
-- Tanggal: 2026-09-19
-- =========================================================

-- 1. Tambahkan session_version pada tabel users untuk revocability token
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INT DEFAULT 0;

-- 2. Tambahkan user_agent dan school_id pada tabel audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- 3. Tambahkan indexes performa & foreign key lookups
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
