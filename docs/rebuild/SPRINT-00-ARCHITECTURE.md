# SPRINT-00-ARCHITECTURE: Sagaya Exam Target Architecture

> Dokumen ini menetapkan arsitektur target yang akan dibangun secara bertahap.
> Bukan untuk langsung diimplementasikan semuanya di Sprint 00.

---

## 1. Role Hierarchy Target

`
SUPER_ADMIN
    |
    +-- ADMIN
          |
          +-- GURU
          |
          +-- PENGAWAS
                |
                +-- SISWA (no account — session-based)
`

## 2. Permission Model Target

`
SUPER_ADMIN
  school.*
  user.*
  regional_exam.*
  global_question.*
  security.*
  audit.*
  system.*

ADMIN
  school.read
  school.update (own school only)
  student.*
  teacher.*
  class.*
  subject.*
  school_question.*
  school_exam.*
  result.*
  report.*

GURU
  assigned_subject.question.*
  exam.draft
  grading.*
  analytics.read

PENGAWAS
  exam.monitor
  participant.read
  session.recovery
  session.force_submit
  incident.create

SISWA (no role — session credential only)
  exam.session
  answer.create
  answer.update
  exam.submit
`

## 3. Tenant Model

`
SUPER_ADMIN -> semua school
ADMIN       -> school miliknya (school_id dari token)
GURU        -> school miliknya
PENGAWAS    -> school yang ditugaskan
SISWA       -> participant/session miliknya saja
`

Server TIDAK PERNAH percaya schoolId dari client.
Tenant diambil dari authenticated identity (session token).

## 4. Authentication Architecture Target

`
lib/auth/
  authentication.ts  -- hashPassword, verifyPassword, createSessionToken, verifySessionToken
  authorization.ts   -- requireAuth, requirePermission, requireTenant, requireOwnership
  permissions.ts     -- PERMISSION_MAP per role
  tenant.ts          -- getTenantFromToken (no client trust)
  session.ts         -- session versioning, revocation
  rate-limit.ts      -- in-memory atau Redis rate limiter
`

## 5. Session Versioning Architecture

`sql
ALTER TABLE users ADD COLUMN session_version INT DEFAULT 0;
`

Token payload membawa: { id, role, schoolId, sessionVersion, exp }

Saat verifikasi:
1. Decode token
2. Check exp
3. Query users: SELECT session_version WHERE id = token.id
4. Jika token.sessionVersion < db.session_version -> INVALID (revoked)

Increment session_version pada:
- Password reset
- Role changed
- Account disabled
- Force logout / security reset

## 6. Student Session Security Architecture Target

Flow baru:
`
Student -> POST /api/student/validate-token (8-char token)
        <- { examSessionId, studentSessionToken (HMAC-signed 1hr JWT) }

Semua request berikutnya WAJIB mengirim:
  Authorization: Bearer <studentSessionToken>
  atau Cookie: sagaya_student_session=<token>

Server verify:
  1. studentSessionToken signature valid
  2. sessionId dalam token == sessionId di path param
  3. Status session masih IN_PROGRESS
  4. Device fingerprint match
`

## 7. API Request Flow Target

`
requireAuth(request)         -- verify session token + session version
  |
requirePermission(user, perm) -- check permission map
  |
requireTenant(user, schoolId) -- enforce tenant boundary
  |
requireOwnership(user, resource) -- verify resource ownership
  |
EXECUTE
`

## 8. Upload Security Architecture Target

Allowed folder whitelist:
- logos
- student-photos
- question-media

Allowed MIME types:
- image/jpeg, image/png, image/webp, image/gif
- audio/mpeg, audio/wav, audio/ogg
- video/mp4, video/webm

Max size: 10MB untuk image, 50MB untuk media

Path generation: uuid-based, tidak menggunakan nama file asli

## 9. Audit Log Standard Events

`
LOGIN_SUCCESS | LOGIN_FAILED | LOGOUT | SESSION_REVOKED
USER_CREATED | USER_DISABLED | USER_ROLE_CHANGED | PASSWORD_RESET
SCHOOL_CREATED | SCHOOL_UPDATED | SCHOOL_SUSPENDED
EXAM_CREATED | EXAM_PUBLISHED | EXAM_LOCKED | EXAM_STOPPED
TOKEN_CREATED | TOKEN_REVOKED
DEVICE_CONFLICT | SESSION_CREATED | SESSION_SUBMITTED
IMPERSONATION_STARTED | IMPERSONATION_ENDED
UPLOAD_SUCCESS | UPLOAD_REJECTED
BRUTE_FORCE_DETECTED | RATE_LIMIT_HIT
`

Setiap event: actor, actor_role, school_id, action, resource_type, resource_id, metadata, ip, user_agent, created_at

## 10. Rate Limiting Strategy

`
Login:
  5 attempts / minute / IP
  10 attempts / minute / username
  lockout 15 menit setelah 10 failures

validate-token:
  10 attempts / minute / IP + device
  20 attempts / minute / IP

check-card:
  20 attempts / minute / IP

Rate limiter: in-memory dengan sliding window (dapat diganti Redis)
`

## 11. Database Migration Plan

Sprint 00 schema additions (backward compatible):
1. ALTER TABLE users ADD COLUMN session_version INT DEFAULT 0
2. ALTER TABLE audit_logs ADD COLUMN user_agent TEXT
3. ALTER TABLE audit_logs ADD COLUMN school_id UUID REFERENCES schools(id)
4. CREATE INDEX idx_students_school_id ON students(school_id)
5. CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC)
6. CREATE INDEX idx_audit_logs_actor ON audit_logs(user_id)

Sprint 01+ schema additions:
1. Student session credential table (for IDOR fix)
2. Formal permission table
3. Rate limit tracking table (if not using Redis)
