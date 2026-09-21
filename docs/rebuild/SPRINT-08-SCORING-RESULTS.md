# SPRINT 08 — SCORING & RESULTS ENGINE

## 1. Scoring Architecture
Sagaya Exam Sprint 08 menghadirkan arsitektur penilaian ujian (*scoring engine*) dan manajemen hasil (*results engine*) yang sepenuhnya terpusat pada server (*server-authoritative*). Klien tidak pernah menghitung, menentukan, ataupun memanipulasi nilai.

```
                  Exam Session Finalize / Submit
                               ↓
                 ScoringService.scoreExamSession()
                               ↓
         [Snapshot Questions & Student Answers Lookup]
                               ↓
                Per-Question Scoring Evaluation
(MC, Complex MC, True/False, Matching, Short Answer, Essay)
                               ↓
               Raw Score & Normalized Score Clamping
                               ↓
       Result Status Check (Pending Essay? -> PARTIALLY_GRADED)
                               ↓
     Atomic Transaction: Upsert exam_results & exam_question_results
                               ↓
                 Teacher Manual Essay Grading
        (Optimistic Locking via version & Rubric Breakdown)
                               ↓
         All Essays Graded? -> Auto-Transition to GRADED
                               ↓
                 School Admin Review -> REVIEWED
                               ↓
                 School Admin Publish -> PUBLISHED
           (Zero-Leakage & IDOR-Protected Student Access)
```

### Prinsip Utama
1. **Server Adalah Sumber Kebenaran**: Seluruh perhitungan nilai mentah, penalti soal salah, bobot, normalisasi skala (0–100), dan pembulatan ditentukan di backend. Nilai dari klien diabaikan secara total.
2. **Snapshot Frozen Questions**: Penilaian mutlak membaca konfigurasi butir soal, kunci jawaban, dan bobot dari `exam_snapshot_questions`. Modifikasi bank soal di kemudian hari tidak berpengaruh pada histori ujian.
3. **Idempotensi Penilaian**: Pemanggilan ulang penilaian untuk sesi yang sama menghasilkan identifikasi hasil yang stabil tanpa duplikasi entri `exam_results`.
4. **Safety Clamp**: Nilai akhir dikunci tidak boleh negatif (`Math.max(0, finalScore)`) kecuali jika konfigurasi ujian mengizinkan nilai minus.

---

## 2. Question Types Scoring Logic
Engine mendukung 6 tipe soal dengan handler yang seragam:

1. **Multiple Choice (`PILIHAN_GANDA`)**:
   - Jawaban benar mendapatkan poin penuh `weight`.
   - Jawaban salah: jika `penalty > 0`, nilai dikurangi sebesar `penalty`.
   - Jawaban kosong / tidak dijawab: skor 0 (penalti tidak berlaku untuk soal yang dikosongkan).

2. **Complex Multiple Choice (`PG_KOMPLEKS`)**:
   - Dua strategi evaluasi:
     - `ALL_OR_NOTHING`: Seluruh himpunan opsi benar harus dipilih tanpa ada opsi salah. Jika cocok sempurna, poin penuh; selain itu, skor 0.
     - `PARTIAL_CREDIT`: Mengkalkulasi rasio opsi benar yang dipilih dikurangi penalti opsi salah yang keliru dipilih. Skor dibatasi pada rentang `[0, weight]`.

3. **True / False (`BENAR_SALAH`)**:
   - Evaluasi boolean toleran string (`opt_true`, `true`, `1`, `benar`, `ya` vs `opt_false`, `false`, `0`, `salah`, `tidak`).
   - Mendukung penalti untuk jawaban keliru.

4. **Matching (`MENJODOHKAN`)**:
   - Pasangan item kiri dan kanan dievaluasi secara individual.
   - Evaluasi `ALL_OR_NOTHING` atau `PARTIAL_CREDIT` berdasarkan jumlah pasangan yang cocok terhadap total pasangan kunci jawaban.

5. **Short Answer (`ISIAN_SINGKAT`)**:
   - Normalisasi teks: pembersihan spasi ganda, trim, dan toleransi tanda baca.
   - Opsi `caseSensitive`: pencocokan case-sensitive atau case-insensitive terhadap daftar kunci jawaban yang diterima.

6. **Essay (`ESSAY`)**:
   - Penilaian manual oleh guru berdasarkan rubrik penilaian bertingkat.
   - Nilai awal default 0 dengan status `PENDING_MANUAL_REVIEW`.
   - Setelah dinilai guru, status menjadi `GRADED`.

---

## 3. Snapshot Immutability Guarantee
- **Tabel Sumber**: `exam_snapshot_questions` yang berelasi dengan `exam_snapshots`.
- **Integritas Historis**: Ketika ujian dipublikasikan atau sesi dimulai, snapshot membekukan butir soal, kunci jawaban, rubrik, dan bobot ke dalam kolom `configuration_json`.
- **Uji Mutasi**: Bahkan jika seorang guru mengubah teks soal atau kunci jawaban di tabel `question_banks`, perhitungan `ScoringService` dan regrading tetap merujuk pada data snapshot yang terkunci secara permanen.

---

## 4. Result Lifecycle State Machine
Siklus hidup hasil ujian diatur oleh state machine yang ketat:

```
PENDING (Baru disubmit / antrian penilaian)
   ↓
[Apakah terdapat soal essay yang memerlukan penilaian manual?]
 ├── Ya ──> PARTIALLY_GRADED
 │              ↓ (Semua essay selesai dinilai)
 └── Tidak ─> GRADED
                ↓ (Admin / Supervisor meninjau nilai)
              REVIEWED
                ↓ (Admin mempublikasikan hasil)
              PUBLISHED
                │
                ├──> VOID (Dibatalkan karena pelanggaran / dispensasi)
                └──> RESULT_CORRECTION (Koreksi nilai dengan audit log)
```

- **Izin Transisi**:
  - Transisi ke `REVIEWED` membutuhkan permission `results.review`.
  - Transisi ke `PUBLISHED` membutuhkan permission `results.publish`.
  - Transisi ke `VOID` membutuhkan permission `results.void`.
  - Koreksi nilai membutuhkan permission `results.correct` dan mewajibkan pencatatan `reason`.
  - Penilaian ulang massal membutuhkan permission `results.regrade`.

---

## 5. Essay Manual Grading & Concurrency Control
- **Pekerjaan Guru (`/guru/grading`)**:
  - Guru dapat memfilter jawaban essay berdasarkan sekolah, ujian, dan butir soal.
  - Form penilaian mencakup kriteria rubrik (`rubric_criteria_scores`) yang menjumlahkan sub-skor secara otomatis.
  - Dilengkapi kolom `feedback_to_student` (dapat dilihat siswa) dan `internal_notes` (catatan privat guru, rahasia).
- **Optimistic Concurrency Control**:
  - Kolom `version` pada `student_answers` bertindak sebagai locking guard.
  - Setiap penilaian mengirimkan `clientVersion`. Jika versi jawaban di database telah berubah (misalnya telah dinilai oleh rekan penguji lain), server menolak dengan kode HTTP 409 `REVIEW_CONFLICT`.
  - Mencegah penulisan ganda (*double grading*) atau overwrite nilai lama secara tidak sengaja.
- **Validasi Nilai**:
  - Nilai manual divalidasi tidak boleh melebihi nilai maksimum (`maxScore`) dari butir soal.

---

## 6. Corrections & Regrade Jobs
1. **Koreksi Nilai (`result_corrections`)**:
   - Admin sekolah dapat melakukan penyesuaian nilai final hasil ujian.
   - Setiap koreksi wajib menyertakan alasan minimal 5 karakter.
   - Perubahan tersimpan di tabel audit `result_corrections` mencakup: `result_id`, `admin_id`, `previous_score`, `new_score`, `reason`, dan timestamp.
2. **Mass Regrade Engine (`regrade_jobs`)**:
   - Jika terdapat ralat kunci jawaban pada snapshot ujian, admin dapat memicu kalkulasi ulang massal.
   - Status job dilacak melalui state: `QUEUED` -> `PROCESSING` -> `COMPLETED` / `FAILED`.
   - Mengkalkulasi ulang seluruh sesi ujian terkait secara transaksional tanpa merusak hasil penilaian essay manual yang telah diberikan guru.

---

## 7. Security, Tenant Isolation & Formula Injection Protection
1. **IDOR & Multi-Tenancy**:
   - Siswa hanya dapat membuka hasil ujian miliknya sendiri (`student_id === authContext.studentId`). Akses lintas siswa ditolak dengan kode 403 `FORBIDDEN`.
   - Guru hanya dapat menilai ujian di dalam sekolah tempat ia mengajar dan mata pelajaran yang ditugaskan.
   - Pengawas (*Proctor*) tidak memiliki wewenang untuk mengubah atau menilai hasil ujian.
2. **Zero Answer Key Leakage**:
   - Endpoint siswa `/api/exam/results/[resultId]` secara mutlak memfilter data sensitif:
     - Dihapus: `answerKey`, `answer_key`, `rubric`, `scoringGuide`, `internal_notes`, `teacherInternalNote`, `grader_id`.
     - Siswa hanya melihat skor yang diperoleh per butir soal, bobot maksimum, dan feedback publik jika diizinkan oleh kebijakan `show_score_policy`.
3. **Formula Injection (CSV / Excel) Protection**:
   - Seluruh sel string pada ekspor CSV dan XLSX yang diawali dengan karakter formula berbahaya (`=`, `+`, `-`, `@`, `\t`, `\r`) secara otomatis dipasangi prefix apostrof (`'`).
   - Mencegah eksekusi formula arbitrer atau eksekusi perintah sistem (DDE attack) saat file dibuka di Microsoft Excel atau Google Sheets.

---

## 8. API Endpoints
| HTTP Method | Path | Deskripsi | Otorisasi |
|---|---|---|---|
| `GET` | `/api/exam/results/:resultId` | Detail hasil ujian siswa (Zero-leakage) | Student (Owner) / Admin |
| `GET` | `/api/admin/results` | Daftar hasil ujian per ujian dengan filter status | School Admin / Superadmin |
| `POST` | `/api/admin/results` | Publikasi batch hasil ujian | School Admin / Superadmin |
| `POST` | `/api/admin/results/:resultId/review` | Menyetujui dan menandai hasil sebagai REVIEWED | School Admin / Superadmin |
| `POST` | `/api/admin/results/:resultId/publish` | Mempublikasikan hasil ujian individu | School Admin / Superadmin |
| `POST` | `/api/admin/results/:resultId/correct` | Koreksi nilai ujian dengan audit log alasan | School Admin / Superadmin |
| `POST` | `/api/admin/results/:resultId/void` | Membatalkan hasil ujian (status VOID) | School Admin / Superadmin |
| `POST` | `/api/admin/results/regrade` | Menjalankan antrian regrading massal | School Admin / Superadmin |
| `GET` | `/api/admin/results/export` | Ekspor hasil ujian ke format CSV atau XLSX aman | School Admin / Superadmin |
| `GET` | `/api/guru/grading` | Antrian jawaban essay yang butuh penilaian | Guru / Teacher |
| `POST` | `/api/guru/grading/:id` | Submit nilai essay dengan versi konkurensi & rubrik | Guru / Teacher |

---

## 9. Database Schema & Indexes
- **`exam_results`**: Tabel utama hasil ujian. Menyimpan `final_score`, `raw_score`, `total_weight`, `scaled_score`, `status`, `published_at`, dan foreign key ke `exam_sessions`.
- **`exam_question_results`**: Rincian penilaian per butir soal. Menyimpan `score`, `max_score`, `is_correct`, `is_partial`, dan metadata evaluasi.
- **`essay_gradings`**: Histori penilaian essay oleh guru dengan kriteria rubrik bertingkat dan catatan internal.
- **`result_corrections`**: Audit log penyesuaian nilai oleh admin sekolah.
- **`regrade_jobs`**: Antrian proses hitung ulang nilai massal.
- **Indexes**:
  - `idx_exam_results_session_id` pada `exam_results(session_id)`
  - `idx_exam_results_exam_status` pada `exam_results(exam_id, status)`
  - `idx_exam_results_student_id` pada `exam_results(student_id)`
  - `idx_essay_gradings_answer_id` pada `essay_gradings(answer_id)`
  - `idx_result_corrections_result_id` pada `result_corrections(result_id)`
  - `idx_regrade_jobs_exam_status` pada `regrade_jobs(exam_id, status)`

---

## 10. Test Matrix & Coverage
Test suite `scripts/tests/test-scoring-results-sprint08.mjs` mengevaluasi 8 modul komprehensif:
1. **Module 1**: Logika penilaian 6 tipe soal (MC, Complex MC all-or-nothing & partial credit, True/False, Matching, Short Answer sanitasi, Essay pending status). (10 skenario)
2. **Module 2**: Normalisasi skala 0–100, pembulatan deterministik 2 desimal, safety clamping nilai minimum 0. (4 skenario)
3. **Module 3**: Finalisasi sesi ujian, perhitungan raw score otomatis, idempotensi penilaian mencegah duplikasi hasil. (8 skenario)
4. **Module 4**: Jaminan imutabilitas snapshot ketika bank soal asal diubah. (1 skenario)
5. **Module 5**: Penilaian manual essay guru, update otomatis status hasil ke GRADED, proteksi optimistic locking (409 conflict). (6 skenario)
6. **Module 6**: State machine siklus hasil: REVIEWED -> PUBLISHED -> VOID -> Koreksi nilai dengan alasan audit. (5 skenario)
7. **Module 7**: Pencatatan dan eksekusi mass regrade job. (1 skenario)
8. **Module 8**: Verifikasi keamanan: ownership check, proteksi IDOR, audit zero answer key leakage, pembatasan sekolah guru, sanitasi formula injection pada CSV & XLSX. (11 skenario)

**Hasil Pengujian**: 46 PASSED, 0 FAILED.
