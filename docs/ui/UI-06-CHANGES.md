# SAGAYA EXAM — UI-06 CHANGELOG & VERIFICATION RECORD

## Sprint Overview
- **Sprint**: UI-06 — Guru Experience
- **Focus**: Rebuild Guru (Teacher) Experience based on UI-01 Design System, covering Guru App Shell, Dashboard, Teaching Modules (Mata Pelajaran, Kelas & Siswa), Question Bank & Multi-Type Authoring, Exam Management & Immutable Snapshot Publishing, Live Monitoring Radar (scoped to teacher), Essay Grading & Rubrics, Exam Results, Analytics, and Official Question Printing.
- **Tenant & Assignment Isolation**: Strictly bound to `authenticatedUser.school_id` and the teacher's assigned subjects (`teacher_subjects`) and classes (`teacher_classes`). Zero leak of sensitive credentials, student tokens, or passwords.
- **Strict Role Boundaries**: Guru is NOT School Administrator. Platform settings, user management, and emergency controls remain strictly restricted to Admin/Superadmin.
- **Source of Truth**: Core backend Sprint 00–11, RBAC permissions, and PostgreSQL database schema.

---

## 1. Codebase Changes

### 1.1. Guru App Shell & Navigation
- `src/components/guru/GuruSidebar.tsx`:
  - Hierarki navigasi terpadu berbasis peran Pengajar:
    - **Dashboard**: `/guru/dashboard`, `/guru`
    - **Mengajar**: Mata Pelajaran (`/guru/subjects`), Kelas & Siswa (`/guru/classes`)
    - **Bank Soal**: Semua Soal (`/guru/question-bank`), Draft (`?status=DRAFT`), Antrean Review (`/guru/question-bank/review`), Published (`?status=PUBLISHED`), Buat Soal Baru (`/guru/question-bank/new`)
    - **Ujian**: Ujian Saya (`/guru/exams`), Buat Paket Ujian (`/guru/exams/new`), Kalender Jadwal (`/guru/exams/schedule`), Radar Monitoring (`/guru/monitoring`)
    - **Penilaian**: Koreksi Essay (`/guru/grading`), Hasil Nilai (`/guru/results`)
    - **Analitik**: Analitik Butir Soal (`/guru/analytics`)
    - **Dokumen**: Cetak Naskah (`/guru/cetak-soal`)
    - **Profil**: Profil Pengajar (`/guru/profile`)
- `src/components/guru/GuruHeader.tsx`:
  - Dilengkapi komponen `Breadcrumb` dari UI-01.
  - Dropdown profil pengajar dengan tautan profil dan konfirmasi keluar aman (`ConfirmDialog`).
- `src/components/guru/GuruLayout.tsx`:
  - Layout terpadu khusus pengajar yang menghubungkan `GuruSidebar` dan `GuruHeader` dengan sinkronisasi status responsif dan sesi `/api/auth/session`.

### 1.2. Dashboard Pengajar & Profil
- `src/app/guru/dashboard/page.tsx`:
  - Dirombak menggunakan `GuruLayout` dan `StatCard` (Total Butir Soal, Paket Ujian, Antrean Koreksi Essay, Siswa Terdaftar).
  - Ringkasan visual siklus hidup bank soal (*Lifecycle Status* DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED, LOCKED).
  - Daftar rombongan belajar yang diampu dan feed aktivitas audit pengajar terkini.
- `src/app/guru/profile/page.tsx`:
  - Menampilkan identitas resmi pengajar (NIP, NUPTK, Satuan Pendidikan) dalam mode read-only yang dilindungi.
  - Formulir pembaruan kontak resmi (email kedinasan dan nomor WhatsApp).
  - Ringkasan daftar mata pelajaran resmi yang ditugaskan kepada pengajar.

### 1.3. Modul Mengajar (Mata Pelajaran & Kelas)
- `src/app/guru/subjects/page.tsx`:
  - Katalog mata pelajaran yang diampu dengan penghitung jumlah butir soal yang telah disusun dan pencarian terpadu.
- `src/app/guru/classes/page.tsx`:
  - Daftar rombel yang diampu menggunakan `DataTable`, `Badge`, pencarian nama rombel/mapel/tahun ajaran.
- `src/app/guru/classes/[classId]/page.tsx`:
  - Roster peserta didik dalam rombel menggunakan `DataTable` dan `StatusBadge` dalam mode **Tampilan Khusus Baca (Read-Only)** tanpa mengekspos token sesi atau kata sandi.

### 1.4. Bank Soal & Multi-Type Question Authoring
- `src/app/guru/question-bank/page.tsx`:
  - Pusat manajemen bank soal dengan filter terpadu (Mapel, Tipe Soal, Kesulitan, Status Siklus).
  - Tabel butir soal dengan `DataTable`, `StatusBadge`, pratinjau soal (*Preview Modal* dengan penegasan kunci jawaban resmi), duplikasi soal, pengajuan ke review, dan ekspor CSV (mode Pengajar dengan kunci / Siswa tanpa kunci).
- `src/app/guru/question-bank/new/page.tsx`:
  - Editor penyusunan soal mendukung **6 tipe soal**:
    1. Pilihan Ganda (*PILIHAN_GANDA*)
    2. Pilihan Ganda Kompleks (*PG_KOMPLEKS*)
    3. Benar / Salah (*TRUE_FALSE*)
    4. Menjodohkan (*MATCHING*)
    5. Isian Singkat (*ISIAN_SINGKAT*)
    6. Uraian / Essay (*ESSAY* dengan rubrik panduan)
  - Dukungan stimulus teks wacana/kasus dan lampiran multimedia.
- `src/app/guru/question-bank/[id]/edit/page.tsx`:
  - Pembaruan soal dengan deteksi status `LOCKED`. Soal yang telah digunakan dalam snapshot ujian dilindungi dan diarahkan untuk diduplikasi sebagai versi baru.
- `src/app/guru/question-bank/review/page.tsx`:
  - Antrean moderasi butir soal bagi pengajar dengan lembar telaah materi, aksi setujui (*APPROVE*), dan pengembalian revisi (*REJECT*).
- Redirects / Aliases:
  - `/guru/bank-soal` → `/guru/question-bank`
  - `/guru/questions` → `/guru/question-bank`
  - `/guru/questions/create` → `/guru/question-bank/new`
  - `/guru/questions/review` → `/guru/question-bank/review`
  - `/guru/questions/[id]/edit` → `/guru/question-bank/[id]/edit`

### 1.5. Ujian & Monitoring Khusus Pengajar
- `src/app/guru/exams/page.tsx`:
  - Manajemen paket ujian dengan `DataTable`, `StatusBadge`, dan konfirmasi rilis paket ujian (`ConfirmDialog`).
- `src/app/guru/exams/new/page.tsx`:
  - Wizard perancangan ujian baru (identitas, durasi, jadwal buka/tutup, pemilihan rombel target, ketentuan acak soal/opsi, KKM).
- `src/app/guru/exams/[examId]/page.tsx`:
  - Halaman detail paket ujian dengan tata letak tab (*Ringkasan & Kebijakan*, *Daftar Butir Soal*, *Rombel & Peserta*), modal pemasangan soal dari bank soal, dan penerbitan snapshot beku (*immutable question snapshot*).
- `src/app/guru/exams/schedule/page.tsx`:
  - Kalender dan linimasa jadwal ujian terbagi atas ujian aktif, ujian mendatang, dan riwayat selesai.
- `src/app/guru/monitoring/page.tsx`:
  - Radar pemantauan sesi ujian live dengan `StatCard`, status kehadiran peserta, sisa waktu, dan pencatat pelanggaran tab browser tanpa kendali destruktif admin.

### 1.6. Penilaian, Hasil, & Analitik
- `src/app/guru/grading/page.tsx`:
  - Antrean koreksi essay *master-detail* dengan panduan rubrik, perhitungan otomatis, umpan balik siswa, catatan internal, dan deteksi konflik *optimistic concurrency* (HTTP 409).
- `src/app/guru/results/page.tsx`:
  - Rekapitulasi nilai akhir ujian per rombel dengan status KKM dan ekspor lembar nilai resmi (CSV).
- `src/app/guru/analytics/page.tsx`:
  - Evaluasi psikometrik proporsi tipe soal, sebaran tingkat kesukaran, dan komparasi nilai rata-rata antar-rombel.
- `src/app/guru/cetak-soal/page.tsx`:
  - Diperbarui menggunakan `GuruLayout` dengan preservasi format CSS cetak naskah kedinasan.
- Redirects:
  - `/guru/koreksi-essay` → `/guru/grading`
  - `/guru/nilai` → `/guru/results`
  - `/guru/analisis-soal` → `/guru/analytics`

---

## 2. Catatan Komponen & Desain UI-01
- `src/components/ui/Modal.tsx`:
  - Menambahkan dukungan prop `title?: string; subtitle?: string;` pada `ModalProps` yang secara otomatis merender `ModalHeader` dan membungkus isi ke dalam `ModalBody`.
- `src/components/guru/GuruHeader.tsx`:
  - Memperbaiki properti item dropdown menjadi `variant: 'danger'`.
- `src/lib/core/types.ts`:
  - Memperluas union `QuestionType` untuk mendukung `TRUE_FALSE` dan `MATCHING` bersama `BENAR_SALAH` dan `MENJODOHKAN`.

---

## 3. Hasil Verifikasi Otomatis
- **Test Suite**: `scripts/tests/test-guru-ui06.mjs`
- **Total Uji**: 14 Test Cases
- **Hasil**: 14 PASSED, 0 FAILED (100% Success Rate)
- **Cakupan Pengujian**:
  1. Identitas Guru & Isolasi Tenant
  2. Lingkup Penugasan Guru (Mata Pelajaran & Kelas)
  3. Proteksi Kredensial Siswa (Read-Only & Zero-Token Leak)
  4. Siklus Hidup Bank Soal & Isolasi Penulis
  5. Integritas Naskah Ujian & Snapshot Beku
  6. Antrean Koreksi Essay & Penilaian Manual
  7. Batasan Peran & Proteksi terhadap Rute Administratif
