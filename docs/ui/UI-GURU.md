# SAGAYA EXAM — UI-06 GURU EXPERIENCE

## 1. Peran & Domain Guru (Pengajar)
Peran `GURU` pada platform Sagaya Exam didesain secara spesifik untuk memfasilitasi tiga pilar utama:
```text
Teaching + Question Authoring + Assessment
```

### Karakteristik & Batasan Hak Akses:
1. **Bukan Administrator Sekolah**:
   - Guru **tidak memiliki wewenang** untuk mengelola identitas akun pengguna platform (Superadmin), akun siswa/guru/pengawas sekolah (Admin Sekolah), konfigurasi darurat (Emergency Controls), pengaturan global, atau manajemen tenant.
   - Hak kelola profil guru dibatasi pada pembaruan informasi kontak (email kedinasan, nomor WhatsApp/telepon). NIP, NUPTK, dan instansi satuan pendidikan dikelola terpusat oleh Admin Sekolah.
2. **Isolasi Tenant & Lingkup Penugasan (Strict Tenant & Assignment Isolation)**:
   - Seluruh kueri data otomatis terikat pada `school_id` dari session pengguna.
   - Guru hanya dapat melihat mata pelajaran yang secara resmi ditugaskan kepadanya (`teacher_subjects`).
   - Guru hanya dapat melihat rombongan belajar / kelas yang diampunya (`teacher_classes`).
   - Daftar siswa dalam kelas disajikan dalam mode **Tampilan Khusus Baca (Read-Only)** tanpa mengekspos token sesi ujian, kata sandi, maupun kredensial siswa.
3. **Penyusunan Butir Soal (Multi-Type Question Authoring)**:
   - Guru menyusun butir soal untuk mata pelajaran yang diampunya dengan dukungan 6 format:
     1. Pilihan Ganda (*Single Choice*)
     2. Pilihan Ganda Kompleks (*Multiple Correct Answers*)
     3. Benar / Salah (*True / False*)
     4. Menjodohkan (*Matching Pairs*)
     5. Isian Singkat (*Short Answer*)
     6. Uraian / Essay (*Essay with Rubric Guidelines*)
   - Dilengkapi dukungan stimulus wacana/teks kasus dan multimedia (gambar/audio/video).
   - Mode pratinjau soal (*Preview*) dengan penegasan identitas visual kunci jawaban resmi.
4. **Siklus Hidup Soal (Question Lifecycle & Versioning)**:
   - `DRAFT`: Penyusunan naskah oleh pengajar.
   - `SUBMITTED`: Diajukan untuk telaah dan moderasi materi.
   - `APPROVED`: Terverifikasi oleh tim kurikulum / reviewer dan siap digunakan dalam paket ujian.
   - `PUBLISHED`: Dipasang pada paket ujian aktif.
   - `LOCKED`: Terkunci secara permanen dalam snapshot ujian untuk melindungi integritas nilai siswa.
   - Pengajar dapat membuat salinan (*duplicate*) sebagai versi baru jika soal telah berstatus `LOCKED`.
5. **Manajemen Ujian & Snapshot Integritas**:
   - Guru dapat merancang paket ujian untuk mata pelajaran dan rombel yang diampunya.
   - Penerbitan paket ujian (*Publish*) otomatis membekukan naskah soal menjadi snapshot permanen (*immutable question snapshot*) yang mengunci butir soal agar tidak dapat dimodifikasi di tengah berjalannya asesmen.
6. **Monitoring Ujian Khusus Pengajar**:
   - Radar monitoring waktu nyata menampilkan jumlah siswa yang sedang mengerjakan, siswa yang telah mengumpulkan, serta riwayat peringatan perpindahan tab browser.
   - Tindakan intervensi darurat (reset token pengerjaan, diskualifikasi) dikhususkan untuk peran Pengawas Ruang / Admin Sekolah, sehingga guru fokus pada evaluasi progres asesmen.
7. **Penilaian Essay & Umpan Balik (Grading)**:
   - Antrean pemeriksaan essay *master-detail* dengan kriteria rubrik panduan skoring.
   - Dilengkapi proteksi *optimistic concurrency control* untuk mencegah penimpaan nilai antar-korektor.
8. **Hasil & Analitik**:
   - Rekapitulasi nilai siswa per rombel dan per ujian dengan status ketuntasan KKM.
   - Ekspor nilai resmi format CSV.
   - Evaluasi psikometrik kualitas bank soal (proporsi LOTS/HOTS dan disparitas capaian antar-rombel).

---

## 2. Struktur Navigasi Workspace Guru
Rute antarmuka guru distandarisasi di bawah shell `/guru/*` dengan hierarki berikut:

```text
GURU WORKSPACE (/guru)
├── Dashboard (/guru/dashboard)
├── Mengajar
│   ├── Mata Pelajaran (/guru/subjects)
│   └── Kelas & Rombel (/guru/classes, /guru/classes/[classId])
├── Bank Soal
│   ├── Semua Soal (/guru/question-bank)
│   ├── Draft Soal (/guru/question-bank?status=DRAFT)
│   ├── Antrean Review (/guru/question-bank/review)
│   ├── Published (/guru/question-bank?status=PUBLISHED)
│   ├── Buat Soal Baru (/guru/question-bank/new)
│   └── Edit Soal (/guru/question-bank/[id]/edit)
├── Ujian
│   ├── Ujian Saya (/guru/exams)
│   ├── Buat Paket Ujian (/guru/exams/new)
│   ├── Detail & Snapshot (/guru/exams/[examId])
│   ├── Kalender Jadwal (/guru/exams/schedule)
│   └── Radar Monitoring (/guru/monitoring)
├── Penilaian
│   ├── Koreksi Essay (/guru/grading)
│   └── Hasil Nilai (/guru/results)
├── Analitik
│   └── Psikometrik & Performa (/guru/analytics)
├── Dokumen Cetak
│   └── Cetak Naskah Soal (/guru/cetak-soal)
└── Profil Pengajar
    └── Pengaturan Akun & Kontak (/guru/profile)
```

---

## 3. Komponen Desain & Standar UI
Seluruh antarmuka guru dibangun mengacu pada pondasi **UI-01 Design System**:
- `GuruLayout`: Mengintegrasikan `GuruSidebar`, `GuruHeader`, dan `Breadcrumb`.
- `StatCard`: Menampilkan metrik real-time tanpa data tiruan.
- `DataTable`: Menyediakan pengurutan kolom, paginasi konsisten, dan kondisi kosong (*EmptyState*).
- `StatusBadge`: Standarisasi warna dan ikon status pengguna, siklus soal, dan sesi ujian.
- `ConfirmDialog`: Perlindungan tindakan sensitif (hapus draft soal, rilis naskah ujian, logout sesi).
- `Modal`: Pratinjau butir soal, impor data JSON, dan form telaah revisi butir soal.
