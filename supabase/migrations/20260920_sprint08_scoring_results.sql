-- =========================================================
-- SAGAYA EXAM - SPRINT 08 SCORING & RESULTS ENGINE MIGRATION
-- Tanggal: 2026-09-20
-- =========================================================

-- 1. Tabel exam_results: Agregasi hasil ujian siswa secara server-authoritative
CREATE TABLE IF NOT EXISTS exam_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES exam_participants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    raw_score NUMERIC(7,2) NOT NULL DEFAULT 0.0,
    max_score NUMERIC(7,2) NOT NULL DEFAULT 0.0,
    normalized_score NUMERIC(7,2) NOT NULL DEFAULT 0.0,
    final_score NUMERIC(7,2) NOT NULL DEFAULT 0.0,
    percentage NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'PARTIALLY_GRADED', 'GRADED', 'REVIEWED', 'PUBLISHED', 'VOID')
    ),
    scoring_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    breakdown_json JSONB DEFAULT '{}'::jsonb,
    graded_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    voided_at TIMESTAMP WITH TIME ZONE,
    void_reason TEXT,
    voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_exam_result_session UNIQUE (session_id),
    CONSTRAINT uq_exam_result_participant UNIQUE (exam_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_results_school_id ON exam_results(school_id);
CREATE INDEX IF NOT EXISTS idx_results_exam_id ON exam_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_results_student_id ON exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_status ON exam_results(status);
CREATE INDEX IF NOT EXISTS idx_results_published_at ON exam_results(published_at);

-- 2. Tabel exam_question_results: Rincian hasil penilaian butir soal individual
CREATE TABLE IF NOT EXISTS exam_question_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL REFERENCES exam_results(id) ON DELETE CASCADE,
    question_id UUID NOT NULL,
    question_version_id UUID,
    answer JSONB,
    score NUMERIC(7,2) NOT NULL DEFAULT 0.0,
    max_score NUMERIC(7,2) NOT NULL DEFAULT 0.0,
    score_status VARCHAR(30) NOT NULL DEFAULT 'AUTOMATED' CHECK (
        score_status IN ('AUTOMATED', 'PENDING_MANUAL_REVIEW', 'MANUALLY_GRADED', 'REGRADED', 'VOID')
    ),
    grader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    graded_at TIMESTAMP WITH TIME ZONE,
    rubric_scores_json JSONB DEFAULT '{}'::jsonb,
    feedback TEXT,
    teacher_internal_note TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_result_question UNIQUE (result_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_q_results_result_id ON exam_question_results(result_id);
CREATE INDEX IF NOT EXISTS idx_q_results_qid ON exam_question_results(question_id);
CREATE INDEX IF NOT EXISTS idx_q_results_status ON exam_question_results(score_status);
CREATE INDEX IF NOT EXISTS idx_q_results_grader ON exam_question_results(grader_id);

-- 3. Tabel essay_gradings: Riwayat koreksi manual essay dan optimistik concurrency lock
CREATE TABLE IF NOT EXISTS essay_gradings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_result_id UUID NOT NULL REFERENCES exam_question_results(id) ON DELETE CASCADE,
    grader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rubric_scores_json JSONB DEFAULT '{}'::jsonb,
    total_score NUMERIC(7,2) NOT NULL,
    max_score NUMERIC(7,2) NOT NULL,
    feedback TEXT,
    internal_note TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_essay_gradings_qres ON essay_gradings(question_result_id);
CREATE INDEX IF NOT EXISTS idx_essay_gradings_grader ON essay_gradings(grader_id);

-- 4. Tabel result_corrections: Audit jejak rekam koreksi nilai hasil ujian yang telah dipublikasikan
CREATE TABLE IF NOT EXISTS result_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL REFERENCES exam_results(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    old_score NUMERIC(7,2) NOT NULL,
    new_score NUMERIC(7,2) NOT NULL,
    reason TEXT NOT NULL,
    corrected_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corrections_result_id ON result_corrections(result_id);
CREATE INDEX IF NOT EXISTS idx_corrections_school_id ON result_corrections(school_id);

-- 5. Tabel regrade_jobs: Riwayat kalkulasi ulang nilai ujian (Regrading)
CREATE TABLE IF NOT EXISTS regrade_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    old_scoring_version VARCHAR(50) NOT NULL,
    new_scoring_version VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    affected_count INT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regrade_jobs_exam ON regrade_jobs(exam_id);
CREATE INDEX IF NOT EXISTS idx_regrade_jobs_school ON regrade_jobs(school_id);
