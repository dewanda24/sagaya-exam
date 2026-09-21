# SAGAYA EXAM — UI-05 ADMIN SEKOLAH EXPERIENCE SPECIFICATION

## 1. Overview & Operational Philosophy

Modul **Admin Sekolah** adalah pusat kendali operasional tingkat satuan pendidikan (*School Operations Center*) untuk platform Sagaya Exam CBT Engine.
Admin Sekolah mengelola penyelenggaraan akademik dan asesmen harian di lingkungan sekolahnya secara mandiri:
- **Tenant Isolation**: Terikat mutlak (*strictly bound*) pada `authenticatedUser.school_id`. Admin Sekolah tidak memiliki visibilitas maupun kendali atas data sekolah lain.
- **Academic Governance**: Struktur tahun ajaran, semester aktif, rombongan belajar (kelas), dan mata pelajaran sekolah.
- **Operational Staff & Users**: Manajemen identitas operasional guru, pengawas ruang, dan staf administrasi sekolah tanpa kemampuan bypass lisensi platform.
- **Student Lifecycle & Import**: Pangkalan data siswa, penempatan rombel, penerbitan kode akses kartu ujian, dan wizard impor multi-tahap (Upload $\rightarrow$ Preview $\rightarrow$ Duplicate Detection $\rightarrow$ Confirm $\rightarrow$ Import Summary).
- **Exam Management & Scheduling**: Siklus hidup paket ujian (*DRAFT* $\rightarrow$ *PUBLISHED* $\rightarrow$ *SCHEDULED* $\rightarrow$ *ACTIVE* $\rightarrow$ *COMPLETED* $\rightarrow$ *LOCKED*), konfigurasi durasi, alokasi ruang sesi, dan deteksi konflik jadwal pengawas.
- **Live Exam Monitoring Radar**: Pemantauan langsung status pengerjaan siswa secara real-time (koneksi, progres, sisa waktu, peringatan pelanggaran keluar tab, perpanjangan waktu, reset sesi darurat).
- **Results, Scoring & Analytics**: Verifikasi rekapitulasi nilai, analisis butir soal (*item analysis*), penilaian esai (*partially graded*), dan ekspor hasil multi-format (JSON, CSV, XLSX, PDF).
- **Official Documentation**: Cetak kartu peserta ujian resmi, berita acara pelaksanaan ujian dengan kop resmi sekolah, dan daftar hadir ruang ujian.
- **Forensic Audit & Local Settings**: Rekam jejak tindakan staf di lingkungan sekolah dan konfigurasi operasional lokal tanpa mengekspos rahasia sistem (*system secrets*).

---

## 2. Route Map & Navigation Matrix

| Rute | Modul | Deskripsi |
| :--- | :--- | :--- |
| `/admin/dashboard` | Dashboard Operasional | Ringkasan KPI sekolah (Siswa, Guru, Pengawas, Kelas, Ujian Aktif, Sesi Berjalan), radar pemantauan ujian hari ini, dan timeline aktivitas terbaru. |
| `/admin/school` | Profil Sekolah | Identitas satuan pendidikan, NPSN, jenjang, alamat, kontak, logo resmi, dan kop surat berita acara. |
| `/admin/academic-years` | Tahun Ajaran | Manajemen siklus tahun ajaran sekolah dan penentuan status aktif. |
| `/admin/semesters` | Semester | Pengelolaan semester (Ganjil/Genap) yang terikat pada tahun ajaran aktif dengan konfirmasi aktivasi. |
| `/admin/classes` | Rombongan Belajar | Daftar kelas/rombel, tingkat jenjang, kapasitas, wali kelas, dan statistik siswa per rombel. |
| `/admin/classes/[classId]` | Detail Kelas | Detail komprehensif rombel dengan tab Ringkasan, Daftar Siswa, Guru Pengajar, Riwayat Ujian, dan Aktivitas. |
| `/admin/subjects` | Mata Pelajaran | Direktori mata pelajaran lokal sekolah, kode mapel, kelompok kurikulum, dan penugasan guru pengampu. |
| `/admin/users` | Pengguna Sekolah | Manajemen akun staf sekolah (Admin, Guru, Pengawas) dengan filter peran dan status aktif. |
| `/admin/users/[userId]` | Detail Pengguna | Tab Profil, Parameter Keamanan (`session_version`, gagal login, lockout), Sesi Perangkat, dan Log Audit personal. |
| `/admin/students` | Direktori Siswa | Pencarian dan filter siswa per kelas/gender, nomor induk (NIS/NISN), status kartu, dan aksi data. |
| `/admin/students/[studentId]` | Detail Siswa | Tab Profil Lengkap, Riwayat Kelas, Jadwal Ujian Terdaftar, Riwayat Nilai, dan Log Aktivitas tanpa kebocoran kredensial. |
| `/admin/students/import` | Impor Siswa Terpadu | Wizard multi-step impor data siswa dari file Excel/CSV dengan validasi duplikasi NISN/NIS otomatis. |
| `/admin/teachers` | Direktori Guru | Direktori pengajar sekolah, NIP/NUPTK, penugasan mapel, rombel bimbingan, dan status akun. |
| `/admin/teachers/[teacherId]` | Detail Guru | Tab Profil, Mata Pelajaran Diampu, Kelas Terkait, Bank Soal, Paket Ujian, dan Log Aktivitas. |
| `/admin/proctors` | Pengawas Ujian | Daftar pengawas ruang ujian, penugasan sesi, dan status keaktifan. |
| `/admin/proctors/assignments` | Penugasan Pengawas | Matriks penugasan ruang & sesi ujian dengan sistem deteksi otomatis konflik jadwal (*double booking* / tumpang tindih ruang). |
| `/admin/question-bank` | Bank Soal Sekolah | Repositori naskah soal tingkat sekolah, peninjauan kelayakan naskah, dan statistik butir soal. |
| `/admin/exams` | Daftar Ujian | Manajemen paket ujian sekolah, filter status, passing grade (KKM), dan pembuatan jadwal asesmen. |
| `/admin/exams/[examId]` | Detail Ujian | Halaman detail ujian lengkap dengan 10 tab (*Overview, Configuration, Questions, Participants, Schedule, Rooms, Proctors, Sessions, Results, Audit*) dan transisi lifecycle formal. |
| `/admin/exams/schedule` | Jadwal Pelaksanaan | Kalender dan daftar linimasa jadwal pelaksanaan ujian sekolah dengan shortcut penugasan pengawas. |
| `/admin/exam-rooms` | Ruang & Sesi Ujian | Manajemen laboratorium/ruang ujian, kapasitas bangku, alokasi sesi peserta, dan cetak denah. |
| `/admin/monitoring` | Radar Monitoring Live | Pemantauan interaktif seluruh sesi ujian yang sedang berjalan: deteksi heartbeat, status koneksi, pelanggaran tab, reset sesi, penambahan waktu darurat. |
| `/admin/results` | Hasil & Nilai | Verifikasi hasil ujian, status kelulusan KKM, koreksi nilai manual berizin, kalkulasi ulang skor, dan pembatalan (*void*). |
| `/admin/analytics` | Analisis Performa | Grafik visual distribusi nilai, rata-rata kelas, tingkat kesulitan butir soal, dan ketuntasan materi. |
| `/admin/reports` | Rekapitulasi & Ekspor | Generator laporan terpadu: ringkasan agregat, rekap siswa, rekap mapel, rekap kelas, rekap ruang, dan ekspor multi-format. |
| `/admin/berita-acara` | Berita Acara Resmi | Generator Berita Acara Ujian otomatis bertanda tangan dengan kop resmi instansi dan data hadir aktual. |
| `/admin/cetak-kartu` | Cetak Kartu Peserta | Generator kartu peserta ujian siap cetak (format A4 tata letak multi-kartu) lengkap dengan barcode/akses kode. |
| `/admin/audit` | Audit Log Sekolah | Jejak audit forensik tindakan administratif di lingkungan sekolah (login, reset, ubah nilai, impor, intervensi pengawas). |
| `/admin/settings` | Pengaturan Sekolah | Konfigurasi identitas tampilan, kop resmi surat, durasi default ujian, format nomor siswa, dan tata tertib baku peserta. |

---

## 3. Tenant Isolation & Security Architecture

1. **Strict Tenant Boundary Enforcement**:
   - Seluruh route API di `/api/admin/*` mengekstrak `auth.tenant.schoolId` dari sesi JWT pengguna yang terotentikasi.
   - Admin Sekolah tidak dapat memilih, melihat, atau memanipulasi entitas milik sekolah lain. Permintaan manipulasi parameter `school_id` otomatis diabaikan atau ditolak (*403/400*).
2. **Session Security & Atomik Invalidation**:
   - Ketika Admin Sekolah melakukan reset password, penonaktifan akun staf, atau *force logout*, backend mengeksekusi penambahan `session_version = session_version + 1`, secara instan membatalkan seluruh sesi aktif pengguna tersebut di seluruh perangkat.
3. **No Secret Leaking**:
   - Halaman Pengaturan Sekolah (`/admin/settings`) hanya menampilkan konfigurasi operasional lokal (kop surat, format penomoran, kebijakan nilai, tata tertib). Kunci JWT, koneksi basis data, dan konfigurasi platform dilindungi secara mutlak di domain Superadmin.
4. **Credential Hygiene**:
   - Direktori siswa dan pengguna staf tidak membocorkan hash kata sandi, token mentah, atau data kredensial sensitif lainnya ke response UI.

---

## 4. UI Foundation & Component Reusability

- **Design System**: Sepenuhnya dibangun di atas token dan komponen UI-01:
  - `StatCard`: Visualisasi metrik KPI di Dashboard dan halaman modul.
  - `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`: Kontainer modular yang konsisten.
  - `DataTable`: Tabel data responsif lengkap dengan loading skeletons dan empty state terstandar.
  - `Badge` & `StatusBadge`: Indikator status terstandar (*DRAFT*, *ACTIVE*, *COMPLETED*, dsb).
  - `Button`: Tombol interaktif dengan varian ukuran dan loading spinner terintegrasi.
  - `ConfirmDialog`: Modal konfirmasi dua langkah untuk setiap tindakan sensitif dan destruktif.
  - `Breadcrumb`: Navigasi hierarki lokasi pengguna di header aplikasi.
- **Zero Fake / Dummy Data**: Seluruh data yang ditampilkan diambil langsung dari basis data melalui layanan backend (`SchoolUserService`, `SchoolExamService`, `StudentService`, `ClassService`, `SchoolSettingsService`, `AuditService`).
