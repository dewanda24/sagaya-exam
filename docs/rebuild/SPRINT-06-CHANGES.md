# SPRINT 06 — CHANGES LOG

Tanggal: 2026-09-20  
Modul: Student Exam Authentication & Exam Session Engine  
Status: **COMPLETED (All 26 Tests Passed, Build Succeeded)**

---

## 1. Migrasi Database & Skema
- **`supabase/migrations/20260920_sprint06_student_session.sql`** [NEW]:
  - Menambahkan kolom `exam_id`, `student_id`, `school_id`, `attempt_number`, `started_at`, `expires_at`, `terminated_at`, `device_id`, `session_version`, dan `updated_at` pada tabel `exam_sessions`.
  - Memperbarui CHECK constraint status pada `exam_sessions` menjadi `('CREATED', 'READY', 'IN_PROGRESS', 'DISCONNECTED', 'SUBMITTED', 'TIMEOUT', 'TERMINATED', 'INVALIDATED')`.
  - Menambahkan partial unique index `uq_active_participant_session` pada `(participant_id)` untuk status aktif `('READY', 'IN_PROGRESS', 'DISCONNECTED')` guna mencegah duplikasi sesi aktif dalam kondisi race condition.
  - Menambahkan kolom `school_id`, `token_hash`, `attempt_number`, `eligible`, `assigned_at`, dan `status` pada `exam_participants`.
  - Menambahkan kolom `version` dan `saved_at` pada `student_answers` untuk mendukung optimistic versioning.
  - Membuat tabel `exam_session_violations` beserta indeks performanya.
- **`scripts/tests/run-sprint06-migration.mjs`** [NEW]:
  - Script runner migrasi database PostgreSQL.

---

## 2. Core Security & State Machine
- **`src/lib/school/token-generator.ts`** [MODIFIED]:
  - Menambahkan `hashExamToken()` (SHA-256) untuk normalisasi token dan penyimpanan/lookup hash aman.
- **`src/lib/core/rate-limit.ts`** [MODIFIED]:
  - Menambahkan preset `EXAM_TOKEN_ATTEMPT` untuk proteksi brute force dan enumerasi token.
- **`src/lib/core/auth.ts`** [MODIFIED]:
  - Memperbarui interface `StudentSessionPayload` dengan `schoolId`, `deviceId`, dan `sessionVersion`.
  - Menambahkan interface `StudentAuthContext`.
  - Mengimplementasikan `authenticateStudentSession(req)` yang memverifikasi tanda tangan kriptografis HMAC-SHA256, status database live, kecocokan versi sesi, kecocokan tenant sekolah, hak kepesertaan siswa, dan binding perangkat (anti-IDOR & anti-device mismatch).
  - Memperbarui `verifyStudentSessionAccess()` agar memanfaatkan autentikasi multi-lapis.
- **`src/lib/services/exam-session-state.service.ts`** [NEW]:
  - State Machine Service terpusat mengelola:
    - `authenticateAndCreateSession()`
    - `startSession()`
    - `heartbeat()`
    - `autosave()`
    - `recordViolation()`
    - `getCurrentSessionData()`
    - `recover()`
    - `submit()`
    - `timeout()`
    - `terminate()`
    - `invalidate()`

---

## 3. Rangkaian API Baru (`/api/exam/*`)
- **`src/app/api/exam/authenticate/route.ts`** [NEW]: Autentikasi token ujian dan penerbitan cookie HttpOnly `sagaya_student_session`.
- **`src/app/api/exam/session/current/route.ts`** [NEW]: Pengambilan metadata sesi siswa dan lembar soal aman (tanpa answerKey).
- **`src/app/api/exam/session/start/route.ts`** [NEW]: Transisi sesi ke `IN_PROGRESS` dan penentuan batas waktu server.
- **`src/app/api/exam/session/route.ts`** [NEW]: Endpoint pengerjaan/inisialisasi sesi ujian.
- **`src/app/api/exam/session/heartbeat/route.ts`** [NEW]: Detak jantung liveness dan sinkronisasi timer server.
- **`src/app/api/exam/session/autosave/route.ts`** [NEW]: Penyimpanan otomatis jawaban dengan validasi snapshot soal.
- **`src/app/api/exam/session/violation/route.ts`** [NEW]: Pelaporan pelanggaran siswa berbasis server count.
- **`src/app/api/exam/session/recover/route.ts`** [NEW]: Pemulihan sesi terputus / reload halaman.
- **`src/app/api/exam/session/submit/route.ts`** [NEW]: Penyerahan ujian atomik dan idempoten.
- **`src/app/api/exam/session/terminate/route.ts`** [NEW]: Penghentian sesi darurat oleh pengawas/admin.

---

## 4. Antarmuka Siswa (Frontend Pages)
- **`src/app/exam/page.tsx`** [NEW]: Halaman masuk ujian siswa (`/exam`) dengan input token otomatis `XXXX-XXXX`, device binding, dan desain glassmorphism modern.
- **`src/app/exam/lobby/page.tsx`** [NEW]: Lobi ujian (`/exam/lobby`) menampilkan identitas siswa, jadwal, aturan ujian, status koneksi/perangkat, dan tombol [Mulai Ujian].
- **`src/app/exam/session/page.tsx`** [NEW]: Ruang ujian siswa (`/exam/session`) dengan countdown timer server, autosave indicator, deteksi perpindahan tab/kehilangan fokus, recovery overlay, dan dialog konfirmasi penyerahan ujian.
- **`src/app/ujian/page.tsx`** [MODIFIED]: Mengalihkan `/ujian` ke `/exam` secara mulus.
- **`src/app/guru/monitoring/page.tsx`** [MODIFIED]: Membungkus komponen dengan `<Suspense>` untuk memperbaiki build error Next.js.
- **`src/app/guru/results/page.tsx`** [MODIFIED]: Membungkus komponen dengan `<Suspense>` untuk perbaikan build Next.js.
- **`src/app/pengawas/exams/[examId]/attendance/page.tsx`** [MODIFIED]: Membungkus komponen dengan `<Suspense>` untuk perbaikan build Next.js.

---

## 5. Pengujian & Verifikasi Otomatis
- **`scripts/tests/test-student-session-sprint06.mjs`** [NEW]:
  - Menjalankan 26 skenario pengujian komprehensif.
  - Simulasi Attack 1 s/d Attack 10 terverifikasi ditolak (IDOR, client manipulation, token forgery, double submit, version revocation, timeout).
  - Status: **26 PASSED, 0 FAILED**.
- **`npm run build`**:
  - Kompilasi produksi Next.js 15.5.25 berhasil penuh (Exit code: 0).
