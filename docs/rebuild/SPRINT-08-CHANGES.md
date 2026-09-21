# SPRINT 08 — CHANGES LOG

## 1. Migrasi Database
- **File**: `supabase/migrations/20260920_sprint08_scoring_results.sql`
  - Membuat tabel `exam_results`: menyimpan hasil nilai final ujian, nilai mentah, nilai terkalibrasi, status publikasi (`PENDING`, `PARTIALLY_GRADED`, `GRADED`, `REVIEWED`, `PUBLISHED`, `VOID`), dan timestamp publikasi.
  - Membuat tabel `exam_question_results`: rincian evaluasi dan skor per butir soal untuk setiap sesi ujian.
  - Membuat tabel `essay_gradings`: pencatatan histori penilaian manual essay oleh guru dengan kriteria rubrik bertingkat dan catatan internal.
  - Membuat tabel `result_corrections`: pencatatan audit log penyesuaian nilai ujian oleh admin sekolah dengan pencatatan alasan wajib.
  - Membuat tabel `regrade_jobs`: antrian pemrosesan hitung ulang nilai massal.
  - Menambahkan indeks optimasi pada `exam_results(session_id)`, `exam_results(exam_id, status)`, `exam_results(student_id)`, `essay_gradings(answer_id)`, `result_corrections(result_id)`, dan `regrade_jobs(exam_id, status)`.

## 2. Core Service Baru & Diperbarui
1. **`src/lib/services/scoring.service.ts`**:
   - `scoreQuestion()`: Evaluator penilaian server-side untuk 6 tipe soal (`PILIHAN_GANDA`, `PG_KOMPLEKS`, `BENAR_SALAH`, `MENJODOHKAN`, `ISIAN_SINGKAT`, `ESSAY`). Mendukung partial credit, penalti soal salah, evaluasi all-or-nothing, dan toleransi normalisasi string.
   - `calculateRawScore()`: Menghitung total perolehan skor mentah.
   - `calculateNormalizedScore()`: Normalisasi skor ke skala standar (default 100).
   - `calculateFinalScore()`: Kalkulasi skor akhir dengan pengali bobot dan safety clamp nilai non-negatif.
   - `roundScore()`: Pembulatan desimal deterministik.
   - `scoreExamSession()`: Engine penilaian terpusat yang membaca konfigurasi butir soal snapshot, mengevaluasi seluruh jawaban siswa, menyimpan rincian skor per butir soal, dan mengelola transisi status hasil awal (`PARTIALLY_GRADED` jika ada essay, `GRADED` jika otomatis).
2. **`src/lib/services/exam-result.service.ts`**:
   - `getStudentPublishedResult()`: Mengambil hasil ujian siswa dengan verifikasi IDOR dan penyaringan mutlak seluruh data sensitif (zero-leakage).
   - `reviewResult()`: Transisi status hasil ujian ke `REVIEWED` oleh admin sekolah.
   - `publishResult()` & `publishBatchResults()`: Mempublikasikan hasil ujian individu atau massal ke status `PUBLISHED`.
   - `voidResult()`: Membatalkan hasil ujian ke status `VOID`.
   - `correctResult()`: Mengoreksi skor ujian dengan pencatatan audit log `result_corrections`.
   - `regradeExamResults()`: Eksekusi hitung ulang skor massal berbasis snapshot terkunci tanpa merusak nilai essay guru.
   - `exportResultsToCsv()` & `exportResultsToXlsx()`: Generator file ekspor laporan nilai dengan sanitasi injeksi formula spreadsheet (`=`, `+`, `-`, `@`).
3. **`src/lib/services/teacher-grading.service.ts`**:
   - `executeGradeEssay()`: Penilaian essay manual dengan kriteria rubrik bertingkat, validasi nilai maksimum, dan penguncian optimistik (`version` lock) pencegah konflik penilaian ganda.
   - `getPendingEssayGradingQueue()`: Antrian butir essay yang membutuhkan penilaian dengan filter sekolah, ujian, dan butir soal.
4. **`src/lib/services/exam-session-state.service.ts`**:
   - Diperbarui pada fungsi `submit()` untuk memicu pemanggilan otomatis `ScoringService.scoreExamSession()` secara transaksional saat siswa menyelesaikan ujian.
5. **`src/lib/core/permissions.ts`**:
   - Menambahkan permission `results.review`, `results.publish`, `results.correct`, `results.void`, dan `results.regrade` pada `SchoolAdminPermission`, `SUPER_ADMIN_PERMISSIONS`, dan `ADMIN_PERMISSIONS`.

## 3. Endpoint API Baru & Diperbarui
- `GET /api/exam/results/[resultId]`: Endpoint siswa untuk melihat hasil ujian dengan proteksi IDOR dan pencegahan kebocoran kunci jawaban.
- `GET /api/admin/results`: Endpoint admin untuk memuat daftar hasil ujian per ujian dengan filter status.
- `POST /api/admin/results`: Endpoint batch publish hasil ujian.
- `POST /api/admin/results/[resultId]/review`: Endpoint peninjauan hasil ujian oleh admin.
- `POST /api/admin/results/[resultId]/publish`: Endpoint publikasi hasil ujian individu.
- `POST /api/admin/results/[resultId]/correct`: Endpoint koreksi skor hasil ujian dengan pencatatan alasan.
- `POST /api/admin/results/[resultId]/void`: Endpoint pembatalan status hasil ujian.
- `POST /api/admin/results/regrade`: Endpoint pemicu proses regrade massal.
- `GET /api/admin/results/export`: Endpoint ekspor hasil ujian format CSV atau XLSX berproteksi formula injection.
- `GET /api/guru/grading`: Endpoint daftar antrian penilaian essay bagi guru.
- `POST /api/guru/grading/[id]`: Endpoint submit nilai essay guru dengan deteksi konflik `REVIEW_CONFLICT` (HTTP 409).

## 4. Antarmuka Pengguna (Frontend UI)
1. **Siswa (`src/app/exam/result/[resultId]/page.tsx`)**:
   - Tampilan sertifikat/kartu hasil ujian premium dengan badge kelulusan, ringkasan durasi pengerjaan, skor per butir soal (tanpa kunci jawaban), dan animasi perayaan jika lulus KKM.
2. **Guru (`src/app/guru/grading/page.tsx`)**:
   - Antarmuka penilaian essay dengan pembagian kriteria rubrik, indikator versi optimistik, catatan internal privat, dan umpan balik siswa.
3. **Admin Sekolah (`src/app/admin/results/page.tsx`)**:
   - Dashboard pengelolaan hasil ujian lengkap dengan filter status, tombol aksi batch publish, modal koreksi nilai berwajib alasan, tombol batalkan (void), pemicu regrade, dan ekspor CSV/XLSX.

## 5. Script & Pengujian Otomatis
- **`scripts/tests/test-scoring-results-sprint08.mjs`**:
  - Test suite komprehensif 8 modul mencakup 46 pengujian: logika 6 tipe soal, normalisasi & rounding, idempotensi scoring, imutabilitas snapshot, kontrol konkurensi essay, state machine hasil, regrade job, proteksi IDOR, audit zero-leakage, dan sanitasi formula injection.
- **`scripts/tests/run-sprint08-migration.mjs`**:
  - Runner migrasi DDL database PostgreSQL.
