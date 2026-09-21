-- =========================================================
-- SAGAYA EXAM - SPRINT 04 GURU / TEACHER CORE MIGRATION
-- Tanggal: 2026-09-19
-- =========================================================

-- 1. Tambah kolom permissions, phone, dan email pada users untuk profil dan granular permission
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);

-- 2. Tambah kolom author_id dan explanation pada question_banks
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS explanation TEXT;

-- Update author_id dari teacher_id jika belum terisi
UPDATE question_banks SET author_id = teacher_id WHERE author_id IS NULL AND teacher_id IS NOT NULL;

-- 3. Tambah kolom explanation pada question_revisions
ALTER TABLE question_revisions ADD COLUMN IF NOT EXISTS explanation TEXT;

-- 4. Tambah kolom untuk Penilaian Essay dan Rubrik pada student_answers
ALTER TABLE student_answers ADD COLUMN IF NOT EXISTS teacher_internal_note TEXT;
ALTER TABLE student_answers ADD COLUMN IF NOT EXISTS rubric_scores_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE student_answers ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE student_answers ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP WITH TIME ZONE;

-- 5. Tambah kolom publication_status pada exam_participants
ALTER TABLE exam_participants ADD COLUMN IF NOT EXISTS publication_status VARCHAR(20) DEFAULT 'DRAFT';

-- 6. Tambah kolom publication_status pada exams jika belum ada
ALTER TABLE exams ADD COLUMN IF NOT EXISTS result_publication_status VARCHAR(20) DEFAULT 'DRAFT';

-- 7. Composite Indexes untuk Performa Query Guru
CREATE INDEX IF NOT EXISTS idx_question_banks_teacher_status ON question_banks(school_id, teacher_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_question_banks_subject ON question_banks(school_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_lookup ON teacher_classes(school_id, teacher_id, class_room_id);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_lookup ON teacher_subjects(school_id, teacher_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_graded ON student_answers(graded_by, graded_at);
