# SPRINT 09 — CHANGES LOG

## 1. Migrasi Database
- **File**: `supabase/migrations/20260920_sprint09_analytics_reports_export.sql`
  - Membuat tabel `report_snapshots`: menyimpan dokumen resmi hasil evaluasi yang dibekukan secara permanen (`id`, `school_id`, `report_type`, `scope`, `filters`, `data_payload`, `data_version`, `scoring_version`, `status`, `storage_reference`, `generated_by`, `generated_at`).
  - Membuat tabel `export_jobs`: antrian pemrosesan berkas ekspor asinkron untuk dataset berskala besar (`id`, `school_id`, `requested_by`, `report_type`, `format`, `filters`, `status`, `file_name`, `file_size_bytes`, `file_content_base64`, `error_message`, `expires_at`).
  - Menambahkan indeks optimasi performa komposit:
    - `report_snapshots(school_id, report_type)`
    - `report_snapshots(school_id, generated_at DESC)`
    - `export_jobs(school_id, requested_by)`
    - `export_jobs(status, created_at DESC)`
    - `exam_results(school_id, exam_id, status)`
    - `exam_results(school_id, student_id, status)`
    - `exam_sessions(school_id, exam_id, status)`
    - `attendance_records(school_id, exam_id, status)`
    - `exam_session_violations(school_id, exam_id, type)`
    - `exam_question_results(result_id, score, max_score)`

## 2. Core Service Baru & Diperbarui
1. **`src/lib/services/analytics.service.ts`**:
   - `getExamAnalytics()`: Metrik komprehensif kehadiran, penyelesaian, mean, median, min, max, standard deviation, kuartil (P25, P50, P75, P90), distribusi bucket 0-9 s.d. 90-100, grade brackets A-D, durasi pengerjaan, dan ringkasan pelanggaran.
   - `getStudentAnalytics()`: Riwayat nilai, persentase kelulusan, dan analitik per mata pelajaran untuk siswa.
   - `getClassAnalytics()`: Agregasi pencapaian kompetensi dan statistik nilai per rombel belajar.
   - `getSubjectAnalytics()`: Evaluasi performa ujian per mata pelajaran.
   - `getTeacherAnalytics()`: Beban evaluasi dan pencapaian ujian yang dibuat guru.
   - `getAttendanceAnalytics()`: Rekapitulasi kehadiran peserta.
   - `getViolationAnalytics()`: Agregasi insiden integritas peserta berdasarkan tingkat keparahan.
   - `getSchoolAnalytics()`: Rekapitulasi KPI eksekutif sekolah.
   - `getPlatformAnalytics()`: Ringkasan makro performa lintas sekolah untuk Superadmin.
   - `computeScoreStats()`: Utilitas komputasi statistik deterministik berstandar evaluasi pendidikan.
2. **`src/lib/services/question-analytics.service.ts`**:
   - `getExamQuestionAnalytics()`: Evaluasi butir soal berbasis snapshot beku (`ExamSnapshot`).
   - Perhitungan **Indeks Kesukaran ($p$-value)**: $p = \text{benar} / \text{valid attempts}$ beserta klasifikasi pedagogis.
   - Perhitungan **Daya Pembeda ($d$-value)**: diskriminasi kelompok atas 27% vs kelompok bawah 27%.
   - Analisis frekuensi opsi jawaban dan efisiensi distraktor/pengecoh untuk soal pilihan ganda.
3. **`src/lib/services/export.service.ts`**:
   - `sanitizeForSpreadsheet()`: Perlindungan server-side terhadap serangan Formula Injection (CSV / Spreadsheet DDE) dengan sanitasi prefix kutip tunggal (`'`).
   - `generateCsvBuffer()`, `generateXlsxBuffer()`, `generateReportPdf()`.
   - `exportExamResults()`: Ekspor langsung sinkron format CSV, XLSX, dan PDF.
   - `createExportJob()`, `processExportJob()`, `downloadExportJob()`: Manajemen antrian ekspor asinkron dengan deteksi kedaluwarsa berkas.
4. **`src/lib/services/pdf-generator.service.ts`**:
   - Generator dokumen PDF-1.4 murni tanpa dependensi eksternal yang mendukung Kop Surat sekolah, tabel data terstruktur, kotak ringkasan KPI, dan penomoran halaman otomatis.
5. **`src/lib/services/report-snapshot.service.ts`**:
   - Layanan pembekuan laporan resmi agar kebal terhadap perubahan data historis dan siap diaudit.
6. **`src/lib/services/analytics-cache.service.ts`**:
   - Manajemen cache in-memory berbasis tenant (`analytics:{schoolId}:{reportType}:{hash}:{version}`) untuk optimasi performa query analitik berat.
7. **`src/lib/core/analytics-auth.ts`**:
   - Otorisasi terpusat dan verifikasi IDOR / batasan penugasan guru, pengawas, dan siswa.
8. **`src/lib/core/permissions.ts`**:
   - Penambahan permission `analytics.read`, `analytics.export`, `analytics.platform`, `reports.snapshot.create`, `reports.snapshot.read`, dan `analytics.operational.read`.

## 3. Endpoint API Baru
- `GET /api/analytics/exams/[examId]`: Endpoint metrik analitik ujian.
- `GET /api/analytics/exams/[examId]/questions`: Endpoint analisis butir soal berbasis snapshot.
- `GET /api/analytics/classes/[classId]`: Endpoint analitik kelas.
- `GET /api/analytics/subjects/[subjectId]`: Endpoint analitik mata pelajaran.
- `GET /api/analytics/students/[studentId]`: Endpoint analitik siswa (dengan proteksi IDOR).
- `GET /api/analytics/attendance`: Endpoint analitik presensi peserta.
- `GET /api/analytics/violations`: Endpoint analitik anomali integritas.
- `GET /api/analytics/school`: Endpoint rekapitulasi sekolah.
- `GET /api/analytics/platform`: Endpoint analitik platform superadmin.
- `GET` & `POST /api/reports/snapshots`: Endpoint daftar dan pembekuan snapshot resmi.
- `GET /api/reports/snapshots/[id]`: Endpoint pembacaan snapshot beku.
- `GET /api/export`: Endpoint ekspor langsung (CSV, XLSX, PDF).
- `POST /api/export`: Endpoint pembuatan antrian ekspor asinkron.
- `GET /api/export/jobs`: Endpoint daftar antrian ekspor.
- `GET /api/export/jobs/[id]`: Endpoint status pemrosesan ekspor.
- `GET /api/export/download/[id]`: Endpoint unduh berkas ekspor aman.

## 4. Antarmuka Pengguna (Frontend UI)
- **`src/app/admin/analytics/page.tsx`**:
  - Dashboard analitik interaktif dengan 5 tab: Ringkasan Eksekutif, Distribusi Nilai (histogram), Analisis Butir Soal (indeks kesukaran & efisiensi pengecoh), Pelanggaran & Integritas, dan Arsip Snapshot Resmi.
  - Opsi ekspor langsung format XLSX dan PDF, serta tombol aksi "Bekukan Snapshot".

## 5. Script & Pengujian Otomatis
- **`scripts/tests/run-sprint09-migration.mjs`**: Runner migrasi DDL database PostgreSQL.
- **`scripts/tests/test-analytics-reports-sprint09.mjs`**: Test suite komprehensif 10 modul mencakup 48 pengujian:
  1. Isolasi tenant (School A vs School B)
  2. Batasan scope role (Admin, Guru, Pengawas, Siswa)
  3. Akurasi matematika & denominator metrik
  4. Distribusi nilai & isolasi status PENDING
  5. Analisis butir soal & imutabilitas snapshot
  6. Proteksi formula injection spreadsheet
  7. Integritas format ekspor (CSV, XLSX, PDF)
  8. Antrian ekspor asinkron & otorisasi unduh
  9. Reproduktifitas report snapshot
  10. Verifikasi indeks performa database
