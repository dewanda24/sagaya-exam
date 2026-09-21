# SPRINT 07 — CHANGES LOG

## 1. Migrasi Database
- **File**: `supabase/migrations/20260920_sprint07_exam_engine.sql`
  - Membuat tabel `exam_snapshots` untuk menyimpan riwayat snapshot dan konfigurasi beku ujian.
  - Membuat tabel `exam_snapshot_questions` untuk membekukan butir soal, opsi ber-ID stabil, kunci jawaban, dan rubrik penilaian.
  - Membuat tabel `question_order_maps` untuk persistensi urutan soal deterministik per sesi ujian siswa.
  - Membuat tabel `option_order_maps` untuk persistensi urutan opsi deterministik per sesi ujian siswa.
  - Menambahkan kolom `active_snapshot_id` dan `navigation_policy` ('FREE_NAVIGATION', 'LINEAR_NAVIGATION') pada tabel `exams`.
  - Menambahkan kolom `snapshot_id` dan `random_seed` pada tabel `exam_sessions`.
  - Menambahkan kolom `question_version_id`, `state`, dan `marked_for_review` pada tabel `student_answers`.

## 2. Service Baru
1. **`src/lib/services/exam-snapshot.service.ts`**:
   - `createOrLockSnapshot()`: Membekukan seluruh konfigurasi ujian dan butir soal menjadi snapshot immutable.
   - `getActiveSnapshotForExam()`: Mengambil snapshot aktif dengan fallback otomatis.
   - `getSnapshotQuestions()`: Mengambil daftar butir soal snapshot.
   - `normalizeQuestionOptions()`: Menetapkan ID opsi yang stabil (`opt_1`, `opt_2`, dll) untuk menjaga integritas pengacakan.
2. **`src/lib/services/exam-randomization.service.ts`**:
   - `generateSeed()`: Generator seed deterministik berbasis hash SHA-256 sesi.
   - `createMulberry32()`: Generator bilangan acak deterministik 32-bit (PRNG).
   - `deterministicShuffle()`: Pengacakan Fisher-Yates deterministik.
   - `initializeSessionOrdering()`: Inisialisasi urutan soal dan opsi dengan idempotensi penuh (tidak berubah saat reload browser).
   - `getSessionQuestionOrder()` & `getSessionOptionOrder()`: Pembacaan urutan terurut persisten per sesi.
3. **`src/lib/services/question-delivery.service.ts`**:
   - `serializeQuestionForStudent()`: Serializer sentral anti-bocor yang menghapus seluruh kunci jawaban, rubrik penilaian, dan catatan guru.
   - `getSessionQuestions()`: Mengambil daftar soal lengkap yang aman untuk sesi siswa.
   - `getQuestionById()`: Mengambil butir soal tunggal dengan verifikasi IDOR.
   - `sanitizeHtml()`: Sanitasi XSS pada teks soal dan opsi.
4. **`src/lib/services/exam-answer.service.ts`**:
   - `validateAnswerPayload()`: Validasi tipe soal untuk Pilihan Ganda, PG Kompleks, Benar/Salah, Menjodohkan, Isian Singkat, dan Essay.
   - `saveAnswer()`: Menyimpan jawaban dengan versioning optimistik dan submit locking.
   - `toggleMarkForReview()`: Menandai/membatalkan status ragu-ragu tanpa menghapus nilai jawaban.
   - `getAnswerReviewSummary()`: Menghitung statistik ringkasan jawaban untuk modal submit.

## 3. Modifikasi Service Existing
- **`src/lib/services/exam-session-state.service.ts`**:
   - Mengintegrasikan inisialisasi urutan soal deterministik pada `startSession()`.
   - Mengintegrasikan pengambilan soal aman via `QuestionDeliveryService` pada `getCurrentSessionData()`.
   - Mendelegasikan validasi dan penyimpanan autosave ke `ExamAnswerService`.

## 4. Endpoint API Baru & Diperbarui
- `GET /api/exam/session/current`: Diperbarui dengan informasi `navigationPolicy` dan soal tersanitasi.
- `GET /api/exam/session/current/questions`: Endpoint baru untuk mengambil daftar soal aman.
- `GET /api/exam/session/current/questions/[questionId]`: Endpoint baru untuk butir soal tunggal dengan IDOR check.
- `POST /api/exam/session/current/answers`: Endpoint baru penyimpanan jawaban dengan optimistik locking.
- `POST /api/exam/session/current/answers/mark`: Endpoint baru untuk toggle status ragu-ragu.
- `GET /api/exam/session/current/summary`: Endpoint baru untuk ringkasan pengerjaan ujian.
- `GET /api/exam/session/current/media`: Endpoint baru untuk verifikasi otorisasi aset media soal.
- `POST /api/exam/session/autosave`: Kompatibilitas mundur autosave terhubung ke `ExamAnswerService`.

## 5. Antarmuka Siswa (Frontend UI)
- **`src/app/exam/session/page.tsx`**:
  - Implementasi komponen interaktif untuk seluruh 6 tipe soal:
    - Multiple Choice: kartu opsi radio dengan label A/B/C/D dan stable optionId.
    - Complex Multiple Choice: checklist multi-seleksi dengan indikator visual.
    - True / False: tombol aksi Benar dan Salah berkode warna.
    - Matching: pemetaan item kiri dan item kanan via dropdown interaktif.
    - Short Answer: input teks dengan batas maksimum 500 karakter.
    - Essay: textarea dengan penghitung karakter (max 10.000) dan debounced autosave.
  - Komponen media rendering untuk gambar, audio, dan video.
  - Palet navigasi berkode warna (Hijau: Dijawab, Kuning: Ragu-ragu, Outline: Belum dijawab, Ring Biru: Saat ini).
  - Penegakan kebijakan `LINEAR_NAVIGATION`.
  - Tombol aksi: "Tandai Ragu-ragu", "Hapus Jawaban", "Sebelumnya", "Berikutnya", dan "Selesai & Kumpulkan".
  - Modal Konfirmasi Pengumpulan Ujian dengan rincian statistik dan peringatan soal belum terjawab.

## 6. Pengujian & Verifikasi
- **`scripts/tests/run-sprint07-migration.mjs`**: Script migrasi database.
- **`scripts/tests/test-exam-engine-sprint07.mjs`**: Suite pengujian komprehensif (80 pengujian, seluruhnya PASSED).
- **`scripts/tests/test-student-session-sprint06.mjs`**: Regression test Sprint 06 (26 pengujian, seluruhnya PASSED).
- TypeScript Typecheck: 0 error (`npx tsc --noEmit` PASSED).
