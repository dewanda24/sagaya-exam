# SAGAYA EXAM — SPRINT 04: GURU / TEACHER CORE SPECIFICATION & ARCHITECTURE

**Status**: COMPLETED  
**Tanggal Rilis**: 2026-09-19  
**Fokus Utama**: Ruang Kerja Guru (Teacher Workspace), Isolasi Lingkup Akademik, Mesin Soal 6 Tipe, Snapshot Immutability, Penilaian Essay & Rubrik, dan Pemantauan Ujian.

---

## 1. Ringkasan Eksekutif & Tujuan Sprint

Sprint 04 berfokus pada pembangunan ruang kerja Guru (Teacher Workspace) yang aman, granular, dan terisolasi tanpa merusak atau mengubah fondasi keamanan dari Sprint 00, Sprint 01, Sprint 02, dan Sprint 03. Seluruh autentikasi mengandalkan **Universal Authentication Core** dari Sprint 03 (`/api/auth/login`, `requireApiAuth`, `user_sessions`, Argon2id).

### Batasan Kritis yang Dipenuhi
1. **Tidak Ada Sistem Login Baru**: Sepenuhnya menggunakan auth cookie HTTP-Only, proteksi CSRF, dan rotasi sesi terpusat.
2. **Server-Side Filtering**: Tidak ada data yang diambil secara luas (`SELECT *`) lalu disaring di sisi klien/frontend. Seluruh query menggunakan parameterized SQL dengan filter `school_id`, `teacher_id`, serta tabel asosiasi `teacher_classes` dan `teacher_subjects`.
3. **Pemisahan Peran Tegas**: Guru tidak memiliki wewenang Admin Sekolah (tidak dapat mengelola user lain, subscription sekolah, kuota, atau konfigurasi sistem).
4. **Pencegahan Kebocoran Kunci Jawaban**: Mesin serialisasi dan sanitasi menjamin kunci jawaban (`answerKey`, `answer_key_json`), pedoman penskoran internal (`teacher_internal_note`), dan pembahasan (`explanation`) dihapus secara mutlak dari payload siswa.
5. **Freeze & Immutability**: Soal yang telah digunakan dalam ujian yang dipublikasikan terkunci (`LOCKED`). Paket snapshot soal tersimpan permanen dalam kolom `exams.question_snapshot_json`.

---

## 2. Model Penugasan & Otorisasi Guru

### A. Konsep Asosiasi Guru
Guru di SAGAYA EXAM terikat pada dua entitas inti penugasan:
1. **Mata Pelajaran yang Diampu (`teacher_subjects`)**:
   - Guru hanya dapat membuat soal pada mata pelajaran yang ditugaskan kepadanya.
   - Guru hanya dapat membuat paket ujian pada mata pelajaran yang ditugaskan.
2. **Kelas yang Diampu (`teacher_classes`)**:
   - Guru hanya dapat melihat daftar siswa pada kelas yang diampunya.
   - Guru dapat bertindak sebagai pengawas/monitoring pada ujian yang menargetkan kelas yang diampunya.
   - Hak wali kelas (`homeroom_teacher_id` pada `class_rooms`) memberi hak pandang kelas yang bersangkutan.

### B. Matriks Hak Akses (Permission Matrix)
Secara default, akun dengan role `GURU` memiliki default permissions:
```typescript
export const GURU_PERMISSIONS: TeacherPermission[] = [
  'teacher:profile:read',
  'teacher:profile:update_contact',
  'teacher:class:read',
  'teacher:subject:read',
  'teacher:student:read',
  'teacher:question:read',
  'teacher:question:create',
  'teacher:question:update_own',
  'teacher:question:delete_draft',
  'teacher:question:submit_review',
  'teacher:exam:create',
  'teacher:exam:read',
  'teacher:exam:update_own',
  'teacher:exam:monitor',
  'teacher:grading:read',
  'teacher:grading:grade_essay',
  'teacher:result:read',
  'teacher:analytics:read',
];
```

Izin tambahan yang dapat diberikan secara granular oleh Admin Sekolah melalui kolom `users.permissions`:
- `teacher:question:review`: Menjadi kurator/reviewer bank soal untuk menyetujui (`APPROVED`) atau menolak (`REJECT`) soal guru lain dalam mata pelajaran yang sama.
- `teacher:exam:publish`: Mempublikasikan ujian dan membekukan snapshot soal.

---

## 3. Arsitektur Mesin Soal (Question Type Engine)

Dukungan 6 tipe soal dibangun di atas pola polimorfisme `QuestionTypeHandler` dan registri terpusat `QuestionTypeRegistry`:

```
                    QuestionTypeRegistry
                             │
     ┌───────────────┬───────┴───────┬───────────────┐
     ▼               ▼               ▼               ▼
MultipleChoice  ComplexMC        TrueFalse       Matching
 (Single PG)    (Multi-Select)   (Server Only)   (Premise-Target)
                     │                               │
                     ▼                               ▼
                ShortAnswer                        Essay
             (Normalized Match)              (Rubric Evaluation)
```

### 1. Pilihan Ganda (`PILIHAN_GANDA`)
- **Struktur**: 3–5 opsi jawaban dengan 1 kunci jawaban unik.
- **Evaluasi**: Skor penuh jika `userAnswer === answerKey`, 0 jika salah.
- **Sanitasi**: Menghapus `answerKey`, mempertahankan list opsi teracak.

### 2. Pilihan Ganda Kompleks (`PG_KOMPLEKS`)
- **Struktur**: Array opsi dengan multi-kunci jawaban yang benar.
- **Metode Penskoran**:
  - `ALL_OR_NOTHING`: Seluruh pilihan benar harus terpilih tanpa ada pilihan salah.
  - `PARTIAL_CREDIT`: Skor proporsional dihitung berdasarkan `(correctSelected / totalCorrect) * weight` dengan penalti jika memilih opsi yang salah (skor minimal 0).

### 3. Benar / Salah (`BENAR_SALAH`)
- **Struktur**: Format pernyataan dengan nilai kebenaran Boolean (`TRUE`/`FALSE`).
- **Evaluasi**: Evaluasi strictly dilakukan di sisi server; nilai kebenaran tidak pernah dikirim ke klien siswa selama ujian berlangsung.

### 4. Menjodohkan (`MENJODOHKAN`)
- **Struktur**: Pasangan `premise` (kiri) dan `target` (kanan).
- **Evaluasi**: Skor proporsional berdasarkan jumlah pasangan yang dicocokkan dengan benar.
- **Sanitasi**: Premis dan target diacak posisinya di server sebelum disajikan ke siswa.

### 5. Isian Singkat (`ISIAN_SINGKAT`)
- **Struktur**: Teks input dengan daftar kata kunci jawaban alternatif yang valid.
- **Normalisasi Ketat**: Penghilangan spasi ganda, trim, pembersihan tanda baca non-alfanumerik, dan case-insensitivity opsional.

### 6. Uraian / Essay (`ESSAY`)
- **Struktur**: Teks pertanyaan bebas dengan kriteria rubrik penskoran berbobot.
- **Penskoran**: Penskoran manual oleh guru (`0 <= manualScore <= maxScore`) dengan validasi rubrik komponen.

---

## 4. Siklus Hidup Soal, Versi, & Snapshot Immutability

### A. Lifecycle Soal
```
 [DRAFT] ───(submitForReview)───► [SUBMITTED]
    ▲                                  │
    │ (reject)                         ▼ (approve)
    └────────────────────────────── [APPROVED]
                                       │
                                       ▼ (publish exam)
                                    [LOCKED]
```

1. **DRAFT**: Soal baru dibuat oleh guru. Hanya dapat diedit atau dihapus oleh pemiliknya.
2. **SUBMITTED**: Diajukan untuk ditinjau oleh rekan sejawat (Reviewer) atau Admin.
3. **APPROVED**: Telah disetujui kurator dan siap dimasukkan ke dalam paket ujian.
4. **LOCKED**: Terkunci permanen karena telah terikat pada ujian yang berstatus `PUBLISHED`. Soal tidak boleh diedit atau dihapus langsung. Perubahan harus dilakukan melalui mekanisme **Duplikasi** (`duplicateQuestion`) atau pembuatan versi baru.

### B. Optimistic Concurrency Control
Pembaruan bank soal menyertakan parameter `expectedVersion`. Jika nomor revisi di database tidak cocok dengan versi yang dibuka guru di browser:
```typescript
if (data.expectedVersion !== undefined && data.expectedVersion !== existing.current_revision_number) {
  throw new Error('Data telah berubah di perangkat lain. Silakan muat ulang halaman terlebih dahulu.');
}
```

### C. Snapshot Pembekuan Ujian
Ketika ujian dipublikasikan (`publishExam`), sistem mengekstrak data seluruh butir soal aktif dan menyimpannya sebagai JSON snapshot di `exams.question_snapshot_json`. Perubahan apa pun pada bank soal di masa depan tidak akan memengaruhi integritas ujian yang sedang berjalan atau riwayat ujian yang telah selesai.

---

## 5. Sistem Penilaian Essay & Catatan Internal

### Pemisahan Feedback Siswa vs Catatan Internal Guru
Tabel `student_answers` diperluas dengan arsitektur dua jalur catatan:
1. `feedback` (TEXT): Bersifat terbuka dan dapat dilihat oleh siswa setelah hasil ujian dipublikasikan. Berisi masukan konstruktif guru terhadap jawaban siswa.
2. `teacher_internal_note` (TEXT): **Bersifat rahasia** untuk guru dan tim kurator. Tidak pernah dikirimkan ke endpoint atau antarmuka siswa dalam keadaan apa pun.

### Batas Penskoran & Audit Perubahan Nilai
- Skor manual divalidasi ketat: `0 <= manualScore <= maxScore`.
- Setiap kali guru melakukan koreksi atau pembaruan nilai essay, sistem mencatat audit log `GRADING_UPDATED` dengan detail: `answerId`, `oldScore`, `newScore`, `participantId`, dan `schoolId`.
- Status penilaian peserta pada `exam_participants` secara otomatis beralih dari `PARTIAL` menjadi `GRADED` saat seluruh jawaban essay selesai dinilai.

---

## 6. Pertahanan Keamanan Tambahan

### A. Proteksi Serangan Formula Injection (CSV / XLSX)
Pada fitur ekspor bank soal dan nilai peserta (`/api/guru/questions/export`, `/api/guru/results/export`), setiap sel teks yang diawali dengan karakter formula berbahaya (`=`, `+`, `-`, `@`, `\t`, `\r`) secara otomatis di-escape dengan kutip tunggal (`'`).
```typescript
static sanitizeForExport(val: any): string {
  if (val === undefined || val === null) return '';
  let str = val.toString();
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str;
}
```

### B. Pencegahan IDOR (Insecure Direct Object References)
- Setiap endpoint memeriksa kepemilikan tenant: `WHERE id = $1 AND school_id = $2`.
- Akses antar guru di sekolah yang sama dibatasi pada relasi mata pelajaran dan kelas yang diampu. Guru A tidak dapat melihat, mengubah, atau menghapus soal guru B tanpa izin reviewer.

---

## 7. Referensi API Guru (`/api/guru/*`)

| Method | Endpoint | Deskripsi & Otorisasi |
| :--- | :--- | :--- |
| `GET` | `/api/guru/dashboard` | Statistik dasbor guru: jumlah soal, ujian aktif, pending essay, dan kelas |
| `GET` | `/api/guru/profile` | Profil guru lengkap, sekolah, mapel yang diampu, dan kelas yang diampu |
| `PUT` | `/api/guru/profile` | Update data kontak pribadi (phone, email). Role & school_id kebal terhadap perubahan |
| `GET` | `/api/guru/subjects` | Daftar mata pelajaran yang ditugaskan kepada guru |
| `GET` | `/api/guru/classes` | Daftar kelas yang ditugaskan kepada guru |
| `GET` | `/api/guru/classes/[id]` | Detail kelas dan daftar siswa (Read-Only) |
| `GET` | `/api/guru/students` | Daftar seluruh siswa dalam lingkup kelas yang diampu guru |
| `GET` | `/api/guru/questions` | Bank soal guru dengan filter mapel, topik, tipe, tingkat kesulitan, status |
| `POST` | `/api/guru/questions` | Membuat butir soal baru (DRAFT, versi 1) |
| `GET` | `/api/guru/questions/[id]` | Detail lengkap soal dan kunci jawaban untuk guru |
| `PUT` | `/api/guru/questions/[id]` | Update soal dengan Concurrency Check, menaikkan revision number |
| `DELETE` | `/api/guru/questions/[id]` | Menghapus draft soal (hanya jika belum terikat ke ujian aktif) |
| `GET` | `/api/guru/questions/[id]/versions` | Riwayat seluruh revisi soal dari `question_revisions` |
| `POST` | `/api/guru/questions/[id]/submit` | Mengajukan soal untuk kurasi (DRAFT -> SUBMITTED) |
| `POST` | `/api/guru/questions/[id]/review` | Reviewer menyetujui / menolak soal (butuh permission `teacher:question:review`) |
| `POST` | `/api/guru/questions/[id]/duplicate` | Menduplikasi soal menjadi soal baru dengan UUID baru |
| `POST` | `/api/guru/questions/import` | Import massal butir soal via JSON |
| `GET` | `/api/guru/questions/export` | Export bank soal format CSV dengan sanitasi formula injection |
| `GET` | `/api/guru/exams` | Daftar ujian yang dibuat guru atau terkait mapel yang diampu |
| `POST` | `/api/guru/exams` | Membuat jadwal ujian baru (DRAFT) |
| `GET` | `/api/guru/exams/[id]` | Detail konfigurasi ujian dan daftar butir soal |
| `POST` | `/api/guru/exams/[id]/publish` | Mempublikasikan ujian dan membekukan snapshot soal secara permanen |
| `POST` | `/api/guru/exams/[id]/lock` | Menutup atau mengunci sesi ujian secara darurat |
| `GET` | `/api/guru/monitoring` | Live monitor peserta: status online, deteksi tab violation, progres pengerjaan |
| `GET` | `/api/guru/grading` | Antrean jawaban essay yang belum dinilai (`pending_essays`) |
| `POST` | `/api/guru/grading` | Memberikan skor manual essay, catatan internal, dan feedback siswa |
| `GET` | `/api/guru/results` | Rekapitulasi perolehan nilai peserta ujian |
| `GET` | `/api/guru/results/export` | Ekspor nilai peserta format CSV dengan proteksi formula injection |
| `GET` | `/api/guru/analytics` | Analisis butir soal empiris, daya beda, dan komparasi rata-rata nilai kelas |

---

## 8. Verifikasi & Pengujian Otomatis

Seluruh fungsionalitas dan skenario keamanan diverifikasi melalui test suite otomatis `scripts/tests/test-guru-sprint04.mjs`.

### Hasil Pengujian (55 PASSED / 0 FAILED)
- **Suite 1**: Teacher Profile & Tampering Defense (Role, school_id kebal update)
- **Suite 2**: Teacher Class & Student Scope (Guru A terisolasi dari Kelas B)
- **Suite 3**: Question Type Engine (Validasi dan penskoran 6 tipe soal)
- **Suite 4**: Zero Answer Key Leakage (Sanitasi kunci jawaban dan catatan internal guru)
- **Suite 5**: Question CRUD, Concurrency, Review & Duplication (Versi 1 -> 2, UUID baru)
- **Suite 6**: Tenant Isolation & IDOR Defense (Blokir lintas sekolah dan lintas guru)
- **Suite 7**: Exam Creation & Snapshot Freezing (Snapshot soal beku, status LOCKED)
- **Suite 8**: Essay Grading & Audit (Batas skor 0-maxScore, pencatatan audit log)
- **Suite 9**: Formula Injection Defense (Escape karakter `=`, `+`, `-`, `@`)
- **Suite 10**: Teacher Analytics Calculation (Agregasi tingkat kesulitan, tipe, kelas)

### Kompilasi TypeScript
```
npx tsc --noEmit
Exit Code: 0 (No Type Errors)
```
