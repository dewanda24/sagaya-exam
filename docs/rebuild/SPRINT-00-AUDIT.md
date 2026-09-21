# SPRINT-00-AUDIT: Sagaya Exam Security & Architecture Audit

> **Tanggal Audit:** 2026-09-19
> **Auditor:** Antigravity AI
> **Scope:** Full source code analysis — semua temuan berdasarkan source code aktual
> **Status:** AUDITED — lihat status masing-masing temuan (FIXED / NOT FIXED / PARTIALLY FIXED)

---

## A. Current Architecture

### Framework & Stack

| Komponen | Detail |
|---|---|
| Framework | Next.js ^15.1.7 (App Router) |
| Language | TypeScript ^5.7.3 |
| Styling | TailwindCSS ^3.4.19 |
| Database | Supabase PostgreSQL (via pg / node-postgres) |
| Authentication | Custom HMAC-SHA256 JWT (bukan library standard) |
| Deployment Target | Vercel / Node.js |

### Alur Request

`
REQUEST
  -> Next.js Middleware (src/middleware.ts)
  -> verifySessionToken via cookie sagaya_session
  -> ROUTE HANDLER (API Route)
  -> manual cookie read + verifySessionToken (DUPLIKASI)
  -> AUTHORIZATION CHECK (inline atau via requireApiAuth)
  -> TENANT CHECK (via getTenantContext)
  -> DATABASE (via queryPostgres / db-service)
  -> RESPONSE
`

### Struktur Role Aktual

`
SUPER_ADMIN  -> Global, semua sekolah
ADMIN        -> Sekolah sendiri
GURU         -> Sebagian admin endpoint
PENGAWAS     -> print-cards, proctor monitoring & recovery
`

### File Utama

- src/lib/core/auth.ts — Token creation, password hashing, session verify
- src/lib/core/rbac.ts — requireApiAuth() helper
- src/lib/core/tenant.ts — getTenantContext()
- src/lib/core/types.ts — Shared TypeScript types
- src/lib/core/postgres.ts — PostgreSQL connection pool
- src/lib/school/db-service.ts — Domain DB operations (1089 baris)
- src/middleware.ts — Next.js middleware

---

## B. Authentication

### Implementasi Aktual

- Session token: Custom HMAC-SHA256 dengan Base64URL encode/decode
- Format: base64url(payload).base64url(signature)
- Secret: Dari process.env.AUTH_SECRET dengan HARDCODED FALLBACK
- Cookie: sagaya_session, httpOnly, SameSite=lax, TTL 7 hari

### Temuan

| ID | Severity | Status | Deskripsi |
|---|---|---|---|
| B-001 | P0 | NOT FIXED | AUTH_SECRET memiliki hardcoded fallback string |
| B-002 | P1 | NOT FIXED | Tidak ada session versioning |
| B-003 | P1 | NOT FIXED | SHA-256 bukan algoritma KDF untuk password (bukan Argon2id) |
| B-004 | P1 | NOT FIXED | verifyPassword() sync menerima plaintext dan hash_xxx |
| B-005 | P2 | NOT FIXED | Duplikasi verifikasi token (middleware + route) |
| B-006 | P2 | NOT FIXED | secure: false pada cookie di development |
| B-007 | P3 | NOT FIXED | Tidak ada force logout / session revocation server-side |

---

## C. Authorization

### Temuan

| ID | Severity | Status | Deskripsi |
|---|---|---|---|
| C-001 | P0 | NOT FIXED | GURU diizinkan POST /api/admin/exams — dapat membuat ujian |
| C-002 | P1 | NOT FIXED | Tidak ada permission layer granular |
| C-003 | P1 | NOT FIXED | ADMIN dapat mengubah isActive school sendiri |
| C-004 | P2 | NOT FIXED | GURU diizinkan POST /api/admin/scores tanpa ownership check |
| C-005 | P2 | NOT FIXED | requireApiAuth tidak dipanggil di semua endpoint |

---

## D. Tenant Isolation

### Temuan

| ID | Severity | Status | Deskripsi |
|---|---|---|---|
| D-001 | P0 | NOT FIXED | POST /api/admin/students: jika user.schoolId null, fallback ke LIMIT 1 (school acak) |
| D-002 | P1 | NOT FIXED | POST /api/admin/exams: masalah sama |
| D-003 | P1 | NOT FIXED | generate-tokens tidak validasi student dari sekolah ADMIN |
| D-004 | P2 | NOT FIXED | Cookie sagaya_active_school_id tidak divalidasi ke DB |

---

## E. Session Management

### Temuan

| ID | Severity | Status | Deskripsi |
|---|---|---|---|
| E-001 | P1 | NOT FIXED | Logout hanya hapus cookie client — token bocor tetap valid 7 hari |
| E-002 | P1 | NOT FIXED | Tidak ada session_version di users table |
| E-003 | P2 | NOT FIXED | TTL 7 hari terlalu panjang untuk platform CBT |
| E-004 | P3 | NOT FIXED | Tidak ada device trust |

---

## F. Password Security

### Temuan

| ID | Severity | Status | Deskripsi |
|---|---|---|---|
| F-001 | P0 | NOT FIXED | verifyPasswordAsync() menerima plaintext match (line 93) |
| F-002 | P0 | NOT FIXED | admin/schools POST: password_hash = 'hash_admin123' — credential terprediksi! |
| F-003 | P1 | NOT FIXED | SHA-256 tanpa KDF — tidak ada cost factor |
| F-004 | P1 | NOT FIXED | verifyPassword() sync tidak handle sha256$ format |
| F-005 | P2 | AUDITED | superadmin/schools sudah pakai hashPassword() yang benar |

---

## G. API Security — Endpoint Inventory

### /api/auth/login — POST
- P1 NOT FIXED: Tidak ada rate limiting — brute force bebas
- P2 NOT FIXED: Error message tidak konsisten

### /api/auth/logout — POST
- P2 NOT FIXED: Tidak require autentikasi

### /api/student/validate-token — POST
- P1 NOT FIXED: Tidak ada rate limiting

### /api/student/check-card — POST
- P0 NOT FIXED: Endpoint terbuka tanpa autentikasi
- P1 NOT FIXED: Tidak ada rate limiting — enumeration NISN mudah
- P1 NOT FIXED: Response berisi token ujian aktif siswa

### /api/student/confirm-session — POST
- P0 NOT FIXED: Endpoint terbuka tanpa autentikasi
- P0 NOT FIXED: IDOR — sessionId tidak diverifikasi ke pemilik

### /api/student/session/[sessionId] — GET
- P0 NOT FIXED: IDOR — siapapun dengan sessionId bisa baca soal ujian orang lain

### /api/student/session/[sessionId]/autosave — POST
- P0 NOT FIXED: IDOR — bisa menulis jawaban ke session orang lain
- P1 NOT FIXED: questionId tidak divalidasi terhadap snapshot ujian

### /api/student/session/[sessionId]/heartbeat — POST
- P1 NOT FIXED: IDOR — manipulasi tab_violation_count orang lain
- P2 NOT FIXED: tabViolations dikirim client — bisa bernilai negatif

### /api/student/session/[sessionId]/submit — POST
- P0 NOT FIXED: IDOR — attacker bisa submit ujian orang lain

### /api/admin/upload — POST
- P1 NOT FIXED: Folder path dari client tanpa whitelist — path traversal
- P1 NOT FIXED: Tidak ada MIME type validation
- P1 NOT FIXED: Tidak ada max file size
- P2 NOT FIXED: Fallback ke public/uploads/ dengan extension asli

---

## H. Student Exam Security — Masalah Fundamental

Seluruh endpoint student session TIDAK MEMILIKI credential binding.

Setelah validate-token, server mengembalikan sessionId.
Tidak ada JWT/cookie khusus siswa yang mengikat identitas ke session tersebut.
Siapapun yang tahu sessionId bisa: baca soal, tulis jawaban, submit, manipulasi violation.

| ID | Severity | Status |
|---|---|---|
| H-001 | P0 | NOT FIXED — IDOR pada 4 student session endpoints |
| H-002 | P0 | NOT FIXED — check-card terbuka |
| H-003 | P0 | NOT FIXED — confirm-session terbuka + IDOR |
| H-004 | P1 | NOT FIXED — device fingerprint tidak diverifikasi di autosave/submit |
| H-005 | P1 | NOT FIXED — tabViolations client-controlled |
| H-006 | P1 | NOT FIXED — questionId di autosave tidak divalidasi |

---

## I. Database Security

### Temuan

| ID | Severity | Status | Deskripsi |
|---|---|---|---|
| I-001 | P1 | NOT FIXED | users table tidak punya session_version |
| I-002 | P1 | NOT FIXED | audit_logs tidak punya user_agent field |
| I-003 | P1 | NOT FIXED | audit_logs school_id tidak selalu diisi |
| I-004 | P2 | NOT FIXED | Index pada users.username perlu konfirmasi |
| I-005 | P2 | NOT FIXED | student_answers.question_id tidak punya FK ke question_banks |
| I-006 | P2 | NOT FIXED | students tidak punya index pada school_id |
| I-007 | P3 | NOT FIXED | settings JSONB tanpa schema validation |
| I-008 | P2 | AUDITED | supabase/schema.sql out-of-date vs database aktual |

---

## J. File Upload Security

| ID | Severity | Status | Deskripsi |
|---|---|---|---|
| J-001 | P1 | NOT FIXED | Folder path dari client tanpa validasi — path traversal |
| J-002 | P1 | NOT FIXED | Tidak ada MIME type validation |
| J-003 | P1 | NOT FIXED | Tidak ada ukuran file maksimum |
| J-004 | P1 | NOT FIXED | Extension dari nama file asli tanpa MIME cross-check |
| J-005 | P2 | NOT FIXED | public/uploads/ bisa diakses publik langsung |
| J-006 | P2 | NOT FIXED | Upload tidak validasi ownership folder |

---

## K. Audit Logging

Tabel audit_logs ada tapi hanya digunakan di 1 endpoint (proctor/recovery).
Login, logout, password reset, school mutasi — tidak diaudit sama sekali.

| ID | Severity | Status | Deskripsi |
|---|---|---|---|
| K-001 | P1 | NOT FIXED | Login events tidak diaudit |
| K-002 | P1 | NOT FIXED | School create/suspend/delete tidak diaudit |
| K-003 | P1 | NOT FIXED | User create/disable/role-change tidak diaudit |
| K-004 | P1 | NOT FIXED | Exam create/publish/stop tidak diaudit |
| K-005 | P2 | NOT FIXED | audit_logs tidak punya user_agent column |
| K-006 | P2 | NOT FIXED | Tidak ada standard event constants |

---

## L. Rate Limiting

TIDAK ADA RATE LIMITING di seluruh aplikasi.

| ID | Severity | Status | Deskripsi |
|---|---|---|---|
| L-001 | P0 | NOT FIXED | /api/auth/login — brute force bebas |
| L-002 | P1 | NOT FIXED | /api/student/validate-token — brute force token ujian |
| L-003 | P1 | NOT FIXED | /api/student/check-card — enumeration NISN mudah |
| L-004 | P2 | NOT FIXED | Semua API sensitif lainnya tanpa rate limit |

---

## M. Secrets / Environment

| ID | Severity | Status | Deskripsi |
|---|---|---|---|
| M-001 | P0 | NOT FIXED | AUTH_SECRET hardcoded fallback di auth.ts:1 |
| M-002 | P0 | AUDITED | .env.local berisi credential DB production — ROTATE SEGERA |
| M-003 | P1 | NOT FIXED | Supabase service key fallback mock-service-key |
| M-004 | P1 | NOT FIXED | Tidak ada startup validation env vars wajib |
| M-005 | P1 | AUDITED | .env.local ada di repo — cek .gitignore |

---

## N. Technical Debt

| ID | Area | Deskripsi |
|---|---|---|
| TD-001 | Architecture | db-service.ts 1089 baris — tidak modular |
| TD-002 | Auth | Custom JWT — risiko implementasi bug |
| TD-003 | AuthZ | Tidak ada permission layer |
| TD-004 | API Pattern | Tidak konsisten requireApiAuth vs manual cookie |
| TD-005 | Types | Penggunaan any berlebihan |
| TD-006 | Schema | supabase/schema.sql out-of-date |
| TD-007 | Testing | Test tidak terintegrasi di CI/CD |
| TD-008 | Migration | Tidak ada formal migration versioning |
| TD-009 | Error | error.message langsung ke client — info disclosure |
| TD-010 | SSL | rejectUnauthorized: false di postgres pool |

---

## O. P0 Critical Findings Summary

### P0-1: AUTH_SECRET Hardcoded Fallback
File: src/lib/core/auth.ts
Impact: Token dapat di-forge jika AUTH_SECRET env tidak di-set
Status: FIXED (Fallback dihapus, startup check via env.ts diwajibkan)

### P0-2: Default Admin Password hash_admin123
File: src/app/api/admin/schools/route.ts
Impact: Semua sekolah baru dapat di-login dengan admin123
Status: FIXED (Menggunakan hashPassword() dengan random salt unik sha256$ format)

### P0-3: IDOR Student Session Endpoints (4 endpoints)
Files: session/route.ts, autosave/route.ts, heartbeat/route.ts, submit/route.ts
Impact: Siswa A bisa baca/tulis/submit session Siswa B
Status: FIXED (HMAC student session token binding via cookie sagaya_student_session, verifyStudentSessionAccess di semua 4 endpoints)

### P0-4: /api/student/check-card Terbuka
File: src/app/api/student/check-card/route.ts
Impact: Data siswa + token ujian aktif bocor tanpa autentikasi
Status: FIXED (Rate limiting 20 req/min/IP + mask token & access code jika pencarian hanya menggunakan NISN publik)

### P0-5: /api/student/confirm-session Terbuka + IDOR
File: src/app/api/student/confirm-session/route.ts
Impact: Confirm session orang lain jika tahu sessionId
Status: FIXED (IDOR verifyStudentSessionAccess + IP rate limiting)

### P0-6: Plaintext Password Match
File: src/lib/core/auth.ts
Impact: Login berhasil jika DB berisi plaintext password
Status: FIXED (Hanya format sha256$salt$hash yang valid, plaintext & hash_xxx ditolak)

### P0-7: Login Brute Force (No Rate Limit)
File: src/app/api/auth/login/route.ts
Impact: Unlimited attempts — credential stuffing mudah
Status: FIXED (Rate limiting sliding window per IP & per username + audit logging)

### P0-8: .env.local Credential Production
File: .env.local
Impact: URL + password database Supabase production terekspos
Status: AUDITED — Developer harus me-rotate credential database

---

## P. Recommended Migration Order

Sprint 00 (Selesai):
1. [DONE] Fix AUTH_SECRET — hapus fallback, wajibkan env
2. [DONE] Fix hash_admin123 di admin/schools route
3. [DONE] Fix verifyPasswordAsync() — hapus plaintext match + hash_xxx
4. [DONE] Tambah session_version ke users table + SQL migration & requireApiAuth server-side revocation check
5. [DONE] Tambah user_agent & school_id ke audit_logs + login audit
6. [DONE] IDOR protection student session endpoints (HMAC student session token & cookie binding)
7. [DONE] Rate limiting login + validate-token
8. [DONE] Fix upload: whitelist folder, validasi MIME, max size, random UUID filename, requireApiAuth
9. [DONE] Fix check-card: rate limit, jangan bocorkan token aktif tanpa cardAccessCode
10. [DONE] Startup validation env vars wajib (src/lib/core/env.ts)

Sprint 01 (Selanjutnya): SUPERADMIN Core
Sprint 02: Admin Refactor + Tenant Isolation
Sprint 03: Student Engine Rebuild + Session Binding
