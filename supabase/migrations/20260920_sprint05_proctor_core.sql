-- =========================================================
-- SAGAYA EXAM - SPRINT 05 PENGAWAS / PROCTOR CORE MIGRATION
-- Tanggal: 2026-09-20
-- =========================================================

-- 1. Attendance Records (Presensi Peserta Ujian per Ruang)
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES exam_rooms(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES exam_participants(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
    marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_exam_participant_attendance UNIQUE (exam_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_exam_room ON attendance_records(exam_id, room_id);
CREATE INDEX IF NOT EXISTS idx_attendance_school ON attendance_records(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_participant ON attendance_records(participant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);

-- 2. Exam Violations (Catatan Kejadian / Pelanggaran Siswa)
CREATE TABLE IF NOT EXISTS exam_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    room_id UUID REFERENCES exam_rooms(id) ON DELETE SET NULL,
    participant_id UUID NOT NULL REFERENCES exam_participants(id) ON DELETE CASCADE,
    session_id UUID REFERENCES exam_sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- TAB_SWITCH, FULLSCREEN_EXIT, FOCUS_LOST, RECONNECT, DISCONNECT, DEVICE_ISSUE, TIMEOUT, FORCED_TERMINATION
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    description TEXT,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_violations_exam_room ON exam_violations(exam_id, room_id);
CREATE INDEX IF NOT EXISTS idx_violations_participant ON exam_violations(participant_id);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON exam_violations(severity);
CREATE INDEX IF NOT EXISTS idx_violations_created_at ON exam_violations(created_at DESC);

-- 3. Exam Incidents (Pelaporan Kendala & Insiden Operasional)
CREATE TABLE IF NOT EXISTS exam_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    room_id UUID REFERENCES exam_rooms(id) ON DELETE SET NULL,
    participant_id UUID REFERENCES exam_participants(id) ON DELETE SET NULL,
    reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('NETWORK_ISSUE', 'DEVICE_ISSUE', 'PARTICIPANT_ISSUE', 'ROOM_ISSUE', 'OTHER')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    description TEXT NOT NULL,
    action_taken TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_exam_room ON exam_incidents(exam_id, room_id);
CREATE INDEX IF NOT EXISTS idx_incidents_school_status ON exam_incidents(school_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_reported_by ON exam_incidents(reported_by);

-- 4. Proctor Notes (Catatan Pengawas Kontekstual per Siswa / Ruang)
CREATE TABLE IF NOT EXISTS proctor_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    room_id UUID REFERENCES exam_rooms(id) ON DELETE SET NULL,
    participant_id UUID REFERENCES exam_participants(id) ON DELETE SET NULL,
    proctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proctor_notes_exam_room ON proctor_notes(exam_id, room_id);
CREATE INDEX IF NOT EXISTS idx_proctor_notes_participant ON proctor_notes(participant_id);
CREATE INDEX IF NOT EXISTS idx_proctor_notes_proctor ON proctor_notes(proctor_id);

-- 5. Proctor Monitoring Sessions (Pelacakan Sesi Pengawasan Ruang)
CREATE TABLE IF NOT EXISTS proctor_monitoring_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES exam_rooms(id) ON DELETE CASCADE,
    proctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'MONITORING' CHECK (status IN ('MONITORING', 'ENDED')),
    checklist_json JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proctor_sessions_exam_room ON proctor_monitoring_sessions(exam_id, room_id, proctor_id);
CREATE INDEX IF NOT EXISTS idx_proctor_sessions_status ON proctor_monitoring_sessions(status);

-- 6. Multi-Proctor Support: Update exam_room_proctors constraint
DO $$
BEGIN
    -- Drop old single-proctor constraint if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'exam_room_proctors' AND constraint_name = 'uq_exam_room_session'
    ) THEN
        ALTER TABLE exam_room_proctors DROP CONSTRAINT uq_exam_room_session;
    END IF;

    -- Add composite unique constraint allowing multiple proctors per room/session
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'exam_room_proctors' AND constraint_name = 'uq_exam_room_session_proctor'
    ) THEN
        ALTER TABLE exam_room_proctors ADD CONSTRAINT uq_exam_room_session_proctor UNIQUE (exam_id, room_id, session_number, proctor_id);
    END IF;
END $$;

-- 7. Composite Indexes for Fast Proctor Query & Real-time Aggregation
CREATE INDEX IF NOT EXISTS idx_exam_room_proctors_proctor ON exam_room_proctors(proctor_id, exam_id, room_id);
CREATE INDEX IF NOT EXISTS idx_exam_participants_room_exam ON exam_participants(exam_id, room_id);
