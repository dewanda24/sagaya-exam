# SAGAYA EXAM — SPRINT 04: GURU CORE FILE CHANGELOG

**Tanggal**: 2026-09-19  
**Sprint**: SPRINT 04 — GURU / TEACHER CORE  

Berikut adalah dokumentasi perubahan berkas (file changes) yang ditambahkan, dimodifikasi, dan diselaraskan selama pelaksanaan Sprint 04.

---

## 1. Database & Migrations
- **[NEW]** `supabase/migrations/20260919_sprint04_guru_core.sql`:
  - Menambahkan kolom `permissions TEXT[]`, `phone VARCHAR(50)`, dan `email VARCHAR(150)` pada tabel `users`.
  - Menambahkan kolom `author_id UUID` dan `explanation TEXT` pada tabel `question_banks`.
  - Menambahkan kolom `explanation TEXT` pada tabel `question_revisions`.
  - Menambahkan kolom `teacher_internal_note TEXT`, `rubric_scores_json JSONB`, `graded_by UUID`, dan `graded_at TIMESTAMPTZ` pada tabel `student_answers`.
  - Menambahkan kolom `publication_status VARCHAR(20)` pada tabel `exam_participants` dan `result_publication_status` pada `exams`.
  - Menambahkan composite index multi-tenant untuk mempercepat filter pencarian soal, penugasan guru, dan antrean koreksi essay.
- **[NEW]** `scripts/tests/run-sprint04-migration.mjs`:
  - Skrip eksekusi migrasi Sprint 04 yang terhubung langsung ke PostgreSQL.

---

## 2. Core Security, RBAC & Question Types
- **[MODIFY]** `src/lib/core/permissions.ts`:
  - Menambahkan tipe perizinan guru `TeacherPermission`.
  - Mendefinisikan array `GURU_PERMISSIONS` standar.
  - Menambahkan helper `hasUserPermission()` untuk evaluasi hak akses berbasis role dan permission overrides.
- **[NEW]** `src/lib/services/teacher-authorization.service.ts`:
  - Layanan otorisasi sentral guru untuk IDOR defense: `canReadQuestion`, `canEditQuestion`, `canDeleteQuestion`, `canSubmitQuestion`, `canReviewQuestion`, `canReadClass`, `canReadStudent`, `canCreateExam`, `canEditExam`, `canPublishExam`, `canReadResult`, `canGradeEssay`.
- **[MODIFY]** `src/middleware.ts`:
  - Mendaftarkan rute `/api/guru/:path*` ke dalam matchers.
  - Mengaktifkan proteksi CSRF dan otorisasi role (`GURU`, `ADMIN`, `SUPER_ADMIN`).
- **[NEW]** `src/lib/core/question-types/types.ts`:
  - Definisi interface `QuestionTypeHandler`, `ValidationResult`, `EvaluationResult`, enum `QuestionType`, dan `ScoringMethod`.
- **[NEW]** `src/lib/core/question-types/multiple-choice.handler.ts`:
  - Handler soal Pilihan Ganda Tunggal (`PILIHAN_GANDA`).
- **[NEW]** `src/lib/core/question-types/complex-multiple-choice.handler.ts`:
  - Handler Pilihan Ganda Kompleks (`PG_KOMPLEKS`) dengan dukungan `ALL_OR_NOTHING` dan `PARTIAL_CREDIT`.
- **[NEW]** `src/lib/core/question-types/true-false.handler.ts`:
  - Handler Benar/Salah (`BENAR_SALAH`) dengan evaluasi murni di sisi server.
- **[NEW]** `src/lib/core/question-types/matching.handler.ts`:
  - Handler Menjodohkan (`MENJODOHKAN`) dengan pengacakan otomatis pasangan untuk siswa.
- **[NEW]** `src/lib/core/question-types/short-answer.handler.ts`:
  - Handler Isian Singkat (`ISIAN_SINGKAT`) dengan normalisasi spasi, tanda baca, dan huruf kapital.
- **[NEW]** `src/lib/core/question-types/essay.handler.ts`:
  - Handler Uraian/Essay (`ESSAY`) dengan validasi rubrik kriteria dan penskoran manual 0–maxScore.
- **[NEW]** `src/lib/core/question-types/index.ts`:
  - `QuestionTypeRegistry` dengan metode `sanitizeQuestionForStudent()` yang membersihkan kunci jawaban dan catatan internal guru secara universal.

---

## 3. Teacher Business Services
- **[NEW]** `src/lib/services/teacher-core.service.ts`:
  - Manajemen profil guru, update nomor kontak dan email terbatas, daftar mata pelajaran yang diampu, daftar kelas yang diampu, serta daftar siswa read-only.
- **[NEW]** `src/lib/services/teacher-question.service.ts`:
  - CRUD bank soal, optimistic concurrency control via `expectedVersion`, pembuatan revisi beruntun di `question_revisions`, pengajuan review, approval reviewer, duplikasi soal dengan UUID independen, sanitasi formula injection pada ekspor CSV.
- **[NEW]** `src/lib/services/teacher-exam.service.ts`:
  - Pembuatan ujian berdasarkan mapel yang diampu, snapshotting soal beku saat dipublikasikan (`publishExam`), penguncian status soal menjadi `LOCKED`, pemantauan peserta real-time yang disanitasi dari kunci jawaban.
- **[NEW]** `src/lib/services/teacher-grading.service.ts`:
  - Pengambilan antrean essay (`pending_essays`), penilaian essay dengan rubrik, validasi batas nilai, pencatatan audit perubahan nilai, dan pemisahan `feedback` siswa vs `teacher_internal_note`.
- **[NEW]** `src/lib/services/teacher-analytics.service.ts`:
  - Analisis butir soal empiris (tingkat kesulitan, daya serap, frekuensi koreksi), distribusi tipe soal, dan komparasi rata-rata nilai antar-kelas yang diampu.

---

## 4. API Endpoints (`/api/guru/*`)
- **[NEW]** `src/app/api/guru/dashboard/route.ts`
- **[NEW]** `src/app/api/guru/profile/route.ts`
- **[NEW]** `src/app/api/guru/subjects/route.ts`
- **[NEW]** `src/app/api/guru/classes/route.ts`
- **[NEW]** `src/app/api/guru/classes/[id]/route.ts`
- **[NEW]** `src/app/api/guru/students/route.ts`
- **[NEW]** `src/app/api/guru/questions/route.ts`
- **[NEW]** `src/app/api/guru/questions/[id]/route.ts`
- **[NEW]** `src/app/api/guru/questions/[id]/versions/route.ts`
- **[NEW]** `src/app/api/guru/questions/[id]/submit/route.ts`
- **[NEW]** `src/app/api/guru/questions/[id]/review/route.ts`
- **[NEW]** `src/app/api/guru/questions/[id]/duplicate/route.ts`
- **[NEW]** `src/app/api/guru/questions/import/route.ts`
- **[NEW]** `src/app/api/guru/questions/export/route.ts`
- **[NEW]** `src/app/api/guru/exams/route.ts`
- **[NEW]** `src/app/api/guru/exams/[id]/route.ts`
- **[NEW]** `src/app/api/guru/exams/[id]/publish/route.ts`
- **[NEW]** `src/app/api/guru/exams/[id]/lock/route.ts`
- **[NEW]** `src/app/api/guru/monitoring/route.ts`
- **[NEW]** `src/app/api/guru/grading/route.ts`
- **[NEW]** `src/app/api/guru/grading/[id]/route.ts`
- **[NEW]** `src/app/api/guru/results/route.ts`
- **[NEW]** `src/app/api/guru/results/export/route.ts`
- **[NEW]** `src/app/api/guru/analytics/route.ts`

---

## 5. Teacher Workspace UI & Pages
- **[MODIFY]** `src/components/admin/AdminSidebar.tsx`:
  - Menambahkan menu navigasi khusus role `GURU` (Dasbor, Profil Saya, Mapel Diampu, Kelas Diampu, Bank Soal, Review Soal, Jadwal Ujian, Monitoring Ujian, Penilaian Essay, Rekap Hasil, dan Analitik Soal).
- **[MODIFY]** `src/app/guru/dashboard/page.tsx`:
  - Dasbor metrik real-time guru berbasis `/api/guru/dashboard`.
- **[NEW]** `src/app/guru/profile/page.tsx`:
  - Halaman profil guru dengan form update nomor kontak dan email terbatas.
- **[NEW]** `src/app/guru/subjects/page.tsx`:
  - Antarmuka daftar mata pelajaran yang ditugaskan kepada guru.
- **[NEW]** `src/app/guru/classes/page.tsx`:
  - Antarmuka daftar kelas yang diampu guru.
- **[NEW]** `src/app/guru/classes/[classId]/page.tsx`:
  - Halaman detail kelas dengan daftar nama siswa dan nomor induk (Read-Only).
- **[NEW]** `src/app/guru/questions/page.tsx`:
  - Halaman katalog bank soal dengan filter multi-kriteria dan aksi cepat (duplikasi, submit review, edit, ekspor).
- **[NEW]** `src/app/guru/questions/create/page.tsx`:
  - Antarmuka pembuatan soal baru dengan form dinamis untuk 6 tipe soal.
- **[NEW]** `src/app/guru/questions/[id]/edit/page.tsx`:
  - Form editor soal dengan concurrency detection dan visualisasi riwayat versi.
- **[NEW]** `src/app/guru/questions/review/page.tsx`:
  - Antarmuka kurasi reviewer untuk menyetujui atau menolak draft soal yang diajukan.
- **[NEW]** `src/app/guru/exams/page.tsx`:
  - Antarmuka manajemen jadwal ujian, pemilihan soal, dan tombol publikasi (snapshot freeze).
- **[NEW]** `src/app/guru/monitoring/page.tsx`:
  - Dasbor live monitoring ruang ujian dengan indikator deteksi pelanggaran tab.
- **[NEW]** `src/app/guru/grading/page.tsx`:
  - Antarmuka antrean koreksi essay dengan rubrik penskoran dan pemisahan catatan internal.
- **[NEW]** `src/app/guru/results/page.tsx`:
  - Rekapitulasi perolehan nilai peserta ujian dan tombol ekspor aman ke CSV.
- **[NEW]** `src/app/guru/analytics/page.tsx`:
  - Grafik distribusi tingkat kesulitan, tipe soal, dan komparasi daya serap kelas.

---

## 6. Automated Testing & Verification
- **[NEW]** `scripts/tests/test-guru-sprint04.mjs`:
  - Suite pengujian otomatis yang mencakup 10 test suite dan 55 skenario pengujian fungsional serta pertahanan keamanan.
  - Hasil eksekusi: **55 Passed, 0 Failed**.
