-- =========================================================
-- SAGAYA EXAM - SPRINT 09 ANALYTICS, REPORTS & EXPORT MIGRATION
-- Tanggal: 2026-09-20
-- =========================================================

-- 1. Tabel report_snapshots: Menyimpan salinan dokumen laporan resmi yang dibekukan secara permanen
CREATE TABLE IF NOT EXISTS report_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL, -- EXAM_SUMMARY, CLASS_PERFORMANCE, SUBJECT_ANALYSIS, ITEM_ANALYSIS, ATTENDANCE_SUMMARY, VIOLATION_SUMMARY, SCHOOL_RECAP
    scope VARCHAR(50) NOT NULL DEFAULT 'SCHOOL', -- SCHOOL, CLASS, EXAM, SUBJECT, STUDENT, GLOBAL
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    scoring_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    storage_reference TEXT,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_snapshots_school_type ON report_snapshots(school_id, report_type);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_generated ON report_snapshots(school_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_snapshots_status ON report_snapshots(status);

-- 2. Tabel export_jobs: Antrian & riwayat pembuatan berkas ekspor asinkron untuk dataset besar
CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL,
    format VARCHAR(10) NOT NULL CHECK (format IN ('CSV', 'XLSX', 'PDF')),
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED')),
    storage_reference TEXT,
    file_name VARCHAR(255),
    file_size_bytes BIGINT DEFAULT 0,
    file_content_base64 TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_school_user ON export_jobs(school_id, requested_by);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires_at ON export_jobs(expires_at);

-- 3. Composite Performance Indexes untuk Agregasi Cepat Analytics
CREATE INDEX IF NOT EXISTS idx_results_school_exam_status ON exam_results(school_id, exam_id, status);
CREATE INDEX IF NOT EXISTS idx_results_school_student_status ON exam_results(school_id, student_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_school_exam_status ON exam_sessions(school_id, exam_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_school_exam_status ON attendance_records(school_id, exam_id, status);
CREATE INDEX IF NOT EXISTS idx_session_violations_exam_type ON exam_session_violations(school_id, exam_id, type);
CREATE INDEX IF NOT EXISTS idx_q_results_result_score ON exam_question_results(result_id, score, max_score);
