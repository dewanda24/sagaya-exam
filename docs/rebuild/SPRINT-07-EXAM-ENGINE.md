# SPRINT 07 — EXAM ENGINE & QUESTION DELIVERY

## 1. Exam Engine Architecture
Sagaya Exam Sprint 07 menghadirkan arsitektur pengerjaan ujian berbasis *immutable snapshot*, *deterministic randomization*, dan *zero-trust question delivery*. Server bertindak sebagai satu-satunya *source of truth* untuk seluruh state soal, urutan, navigasi, timer, dan validasi jawaban.

```
Exam Configuration
       ↓
Exam Snapshot (Immutable Freeze)
       ↓
Student Exam Session
       ↓
Deterministic Randomization (Seed Server-Side)
       ↓
Question Delivery (Safe Serializer, Zero-Leakage)
       ↓
Student Answer State Machine (Autosave & Versioning)
       ↓
Review Modal & Idempotent Submit Lock
```

## 2. Snapshot Architecture
- **Tujuan**: Mencegah perubahan bank soal oleh guru mempengaruhi ujian yang sedang atau telah dipublikasikan/dikerjakan.
- **Tabel**: `exam_snapshots` dan `exam_snapshot_questions`.
- **Immutability Guarantee**: Butir soal yang masuk snapshot dibekukan secara lengkap (`configuration_json` mencakup konten, opsi dengan stable ID, kunci jawaban, rubrik, dan bobot). Jika seorang guru mengedit teks atau kunci jawaban di `question_banks` setelah snapshot dibuat, snapshot tidak berubah sedikit pun.
- **Foreign Key Constraint**: Relasi ketat antara snapshot, ujian, dan sekolah dengan cascade/restrict yang aman.

## 3. Question Delivery
- **Centralized Serializer**: Dikelola oleh `QuestionDeliveryService.serializeQuestionForStudent()`. Tidak ada endpoint yang merangkai payload siswa secara ad-hoc.
- **Zero Answer Key Leakage**: Serializer membuang secara mutlak seluruh field sensitif sebelum data meninggalkan server:
  - `answerKey`, `answer_key`, `answer_key_json`
  - `rubric`, `rubric_json`
  - `explanation`
  - `teacher_internal_note`, `internal_note`
  - `scoring_guide`, `expectedAnswer`, `isCorrect`
- **Data Minimization**: Siswa hanya menerima apa yang mutlak diperlukan untuk menjawab soal: ID, nomor urut, tipe soal, teks/konten tersanitasi, opsi dengan label tampilan ('A', 'B', 'C'...), media tersertifikasi, dan bobot.

## 4. Question Types
Mendukung 6 tipe butir soal dengan extensible handler architecture:
1. **Multiple Choice (`PILIHAN_GANDA`)**: Pilihan tunggal dengan identifier opsi yang stabil (`opt_1`, `opt_2`...).
2. **Complex Multiple Choice (`PG_KOMPLEKS`)**: Pilihan ganda kompleks yang mengizinkan multi-seleksi dengan validasi array ID opsi.
3. **True / False (`BENAR_SALAH`)**: Pilihan Benar (`opt_true`) dan Salah (`opt_false`).
4. **Matching (`MENJODOHKAN`)**: Pemetaan pasangan item kiri (`leftItems`) ke item kanan (`rightItems`) berformat dictionary `{ [leftId]: rightId }`.
5. **Short Answer (`ISIAN_SINGKAT`)**: Input teks berbatas karakter maksimum 500 karakter dengan sanitasi string.
6. **Essay (`ESSAY`)**: Uraian panjang dengan limit 10.000 karakter, debounced autosave, dan penghitung karakter/kata real-time.

## 5. Randomization & Order Persistence
- **Server Seed**: Setiap sesi ujian menghasilkan random seed 32-bit deterministik dari hash `sessionId + examId + participantId`.
- **Mulberry32 PRNG & Fisher-Yates**: Pengacakan urutan soal dan opsi dilakukan melalui algoritma Mulberry32 dan Fisher-Yates shuffle yang terbukti uniform dan deterministik.
- **Order Persistence**:
  - Urutan soal disimpan pada tabel `question_order_maps` (`session_id`, `question_id`, `display_position`).
  - Urutan opsi disimpan pada tabel `option_order_maps` (`session_id`, `question_id`, `option_id`, `display_position`).
- **Refresh Stability**: Jika siswa me-refresh browser, terputus jaringan, atau kembali masuk sesi, urutan soal dan urutan opsi dijamin 100% identik tanpa pengacakan ulang.

## 6. Navigation
Mendukung dua kebijakan navigasi ujian (`navigation_policy`):
1. **`FREE_NAVIGATION`**: Siswa bebas berpindah ke soal sebelumnya, berikutnya, atau melompat langsung via nomor navigator.
2. **`LINEAR_NAVIGATION`**: Siswa hanya dapat melompat ke soal berikutnya jika soal saat ini telah dijawab. Melompat jauh ke depan diblokir.
- **Question Navigator**: Kotak palet nomor soal dengan indikator warna:
  - Hijau (`ANSWERED`): Sudah dijawab
  - Kuning / Ikon Bendera (`MARKED` / `isDoubtful`): Ditandai ragu-ragu
  - Outline Abu-abu (`UNANSWERED`): Belum dijawab
  - Ring Biru (`CURRENT`): Soal yang sedang aktif dibuka

## 7. Answer State
State machine jawaban siswa pada tabel `student_answers`:
- `UNANSWERED`: Soal belum dijawab.
- `ANSWERED`: Jawaban valid tersimpan.
- `CLEARED`: Siswa menghapus jawaban (nilai kembali null).
- **Mark for Review**: Flag `marked_for_review` / `is_doubtful` dapat diaktifkan/dinonaktifkan secara independen tanpa menghapus nilai jawaban yang tersimpan.

## 8. Autosave & Concurrency Protection
- **Optimistic Concurrency Control**: Setiap mutasi jawaban mencakup nomor versi inkremental (`version + 1`). Jika rekues yang datang membawa `clientVersion < serverVersion` (misal dari packet buffer jaringan yang tertunda), server menolak overwrite dengan kode 409 `CONCURRENCY_CONFLICT`.
- **Submit Lock**: Jika status sesi adalah `SUBMITTED`, `TIMEOUT`, atau `TERMINATED`, seluruh operasi simpan jawaban otomatis ditolak dengan kode 403 `EXAM_LOCKED`.

## 9. Media Access Security
- Media yang disertakan dalam butir soal (gambar, audio, video) diverifikasi kepemilikannya melalui `GET /api/exam/session/current/media`.
- Siswa hanya diizinkan mengakses aset media yang terdaftar pada snapshot sesi ujian aktif milik siswa tersebut. Akses langsung ke media dari sekolah atau ujian lain ditolak.

## 10. Security
- **IDOR Protection**: Siswa tidak dapat mengakses atau mengirimkan jawaban untuk soal ujian dari paket ujian lain atau sekolah lain (Cross-Exam Attack pencegahan via `question_order_maps` ownership verification).
- **Tenant Isolation**: Batas sekolah (`school_id`) diverifikasi di seluruh query.
- **XSS Protection**: Sanitasi HTML diterapkan pada konten butir soal serta input jawaban essay dan isian singkat untuk mencegah injeksi script berbahaya (`<script>`, `onerror`, `javascript:`).
- **Multi-Tab Policy**: Event perpindahan tab dan kehilangan fokus dideteksi dan dilaporkan secara otomatis ke proctor monitoring.

## 11. API Endpoints
1. `GET /api/exam/session/current`: Metadata sesi, informasi navigasi ujian, ringkasan durasi, dan daftar butir soal aman.
2. `GET /api/exam/session/current/questions`: Mengambil seluruh daftar butir soal aman dalam urutan sesi terurut.
3. `GET /api/exam/session/current/questions/:questionId`: Mengambil detail butir soal tunggal dengan verifikasi IDOR.
4. `POST /api/exam/session/current/answers`: Menyimpan atau memperbarui jawaban siswa dengan validasi skema tipe soal dan kontrol konkurensi.
5. `POST /api/exam/session/current/answers/mark`: Toggle status ragu-ragu (Mark for Review).
6. `GET /api/exam/session/current/summary`: Mengambil statistik ringkasan pengerjaan (total, dijawab, belum dijawab, ragu-ragu) untuk modal submit.
7. `GET /api/exam/session/current/media`: Verifikasi otorisasi media soal.

## 12. Database Schema
- File migrasi: `supabase/migrations/20260920_sprint07_exam_engine.sql`.
- Tabel baru:
  - `exam_snapshots`: snapshot metadata dan versi ujian.
  - `exam_snapshot_questions`: butir soal beku immutable.
  - `question_order_maps`: urutan soal deterministik per sesi.
  - `option_order_maps`: urutan opsi deterministik per sesi.
- Tabel termodifikasi:
  - `exams` (kolom `active_snapshot_id`, `navigation_policy`).
  - `exam_sessions` (kolom `snapshot_id`, `random_seed`).
  - `student_answers` (kolom `question_version_id`, `state`, `marked_for_review`).

## 13. Testing Results
- Suite pengujian: `scripts/tests/test-exam-engine-sprint07.mjs`.
- Total test cases: **80 PASSED, 0 FAILED**.
- Regression test Sprint 06: **26 PASSED, 0 FAILED**.
- Zero Answer Key Leakage: Terbukti 100% bersih dari seluruh 6 butir soal.

## 14. Known Issues & Sprint 08 Recommendations
- **Rekomendasi Sprint 08 (Scoring & Grading Engine)**:
  - Mengintegrasikan mesin penilaian otomatis untuk seluruh tipe soal objektif (Multiple Choice, Complex MC, True/False, Matching, Short Answer).
  - Menyediakan workspace penilaian essay untuk Guru dengan rubrik interaktif dari snapshot.
  - Mengimplementasikan penalti salah/benar (negative marking) dan bobot granular per indikator kompetensi.
