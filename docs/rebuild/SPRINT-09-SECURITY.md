# SPRINT 09 — SECURITY & AUTHORIZATION SPECIFICATION

## 1. Role Scoping & Permission Enforcement

Semua endpoint dan layanan analitik mengikuti hierarki keamanan berlapis:
```text
Authenticated User
        ↓
Role Verification (SUPER_ADMIN, ADMIN, GURU, PENGAWAS, SISWA)
        ↓
Permission Check (analytics.read, analytics.export, analytics.platform, etc.)
        ↓
School / Tenant Scope Assertion
        ↓
Resource Assignment Check (Subject / Class / Exam Ownership)
        ↓
Execution / Query
```

### Aturan Batasan Hak Akses:
1. **SUPER_ADMIN**:
   - Memiliki visibilitas makro platform (`/api/analytics/platform`).
   - Dapat berpindah konteks sekolah untuk keperluan audit teknis.
2. **ADMIN (Sekolah)**:
   - Terisolasi ketat pada `user.schoolId`.
   - Dapat melihat seluruh ujian, kelas, guru, dan peserta di sekolahnya.
   - Dilarang mengakses data sekolah lain (dicegah dengan `AnalyticsAuthService.assertSchoolScope()`).
3. **GURU**:
   - Hanya dapat mengakses analitik pada **mata pelajaran yang ditugaskan** (`teacher_subjects`), **kelas yang diajar** (`teacher_classes`), dan **ujian yang dibuat** (`exams.created_by = user.id`).
   - Upaya mengakses kelas atau ujian guru lain menghasilkan error otorisasi (HTTP 403).
4. **PENGAWAS**:
   - Terbatas pada data operasional presensi (`attendance_records`) dan log pelanggaran (`exam_session_violations`).
   - **Zero Answer Key Leakage**: Dilarang mengakses analisis butir soal, kunci jawaban, dan konfigurasi penskoran privat.
5. **SISWA**:
   - Hanya dapat melihat analitik dirinya sendiri (`studentId === context.studentId`).
   - Hanya dapat melihat ujian yang berstatus `PUBLISHED`.

---

## 2. Pencegahan IDOR (Insecure Direct Object Reference)

Tidak ada endpoint analitik atau ekspor yang mempercayai parameter URL secara mentah:
- `examId`: Diverifikasi keberadaannya di dalam sekolah pengguna dan penugasan guru/pengawas.
- `studentId`: Diverifikasi apakah siswa terdaftar di sekolah dan kelas kewenangan pengguna.
- `classId` & `subjectId`: Diverifikasi relasi kepemilikan dan penugasannya.
- `exportJobId`: Pengunduhan berkas memeriksa kecocokan `school_id` dan pembuat berkas.

---

## 3. Formula Injection (Spreadsheet DDE Defense)

Input yang berpotensi berbahaya (`=`, `+`, `-`, `@`, `\t`, `\r`) pada seluruh kolom teks ekspor disanitasi dengan menambahkan awalan kutip tunggal (`'`). Spreadsheet memperlakukannya sebagai string murni dan mematikan eksekusi kode dinamis.

---

## 4. Audit Trail Integration

Event audit yang dicatat secara permanen:
- `REPORT_VIEWED`: Saat laporan/analitik ujian dibaca oleh pengguna.
- `REPORT_EXPORTED`: Saat berkas ekspor diunduh atau digenerate langsung.
- `EXPORT_CREATED`: Saat antrian ekspor asinkron dibuat.
- `EXPORT_COMPLETED`: Saat pemrosesan ekspor selesai.
- `EXPORT_FAILED`: Saat terjadi kegagalan pemrosesan berkas ekspor.
- `REPORT_SNAPSHOT_CREATED`: Saat laporan resmi dibekukan ke dalam snapshot kekal.
