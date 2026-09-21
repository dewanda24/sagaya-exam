# SAGAYA EXAM — SPRINT 02: ADMIN SEKOLAH / SCHOOL ADMIN OPERATIONS

Dokumen ini merangkum arsitektur, implementasi domain, serta aturan otoritas dan keamanan untuk operasional **Admin Sekolah (School Admin)** pada platform SAGAYA EXAM.

---

## 1. Prinsip Utama & Batas Kewenangan (Tenant Isolation)

Admin Sekolah bertindak sebagai pengelola operasional sekolah dalam isolasi tenant (`school_id`).

### A. Hak Akses Eksklusif
- Admin Sekolah hanya dapat melihat, menambah, mengubah, dan menghapus data yang memiliki `school_id` identik dengan tenant miliknya.
- Identitas tenant (`tenant.schoolId`) **selalu diekstrak langsung dari sesi token terautentikasi (`auth.user.schoolId`) di server**. Klien tidak diizinkan menyuntikkan atau menimpa `schoolId` melalui body request ataupun query parameter (IDOR Prevention).

### B. Larangan Keras (Security Guardrails)
1. **Tidak Dapat Mengakses Sekolah Lain**: Segala bentuk percobaan pembacaan atau mutasi lintas sekolah langsung diblokir di level RBAC (`assertTenantOwnership`) dengan respon `403 Forbidden`.
2. **Tidak Dapat Mengangkat atau Mengubah Superadmin**: Percobaan mengubah role menjadi `SUPER_ADMIN` atau memodifikasi pengguna ber-role `SUPER_ADMIN` diblokir oleh `assertNotSuperAdminTarget`.
3. **Perlindungan Admin Sekolah Terakhir**: Sistem secara otomatis menolak operasi penghapusan atau penonaktifan admin sekolah jika pengguna tersebut merupakan satu-satunya admin aktif yang tersisa di sekolah (`assertNotLastSchoolAdmin`).
4. **Tidak Ada Akses ke Repositori Global / Platform Root**: Admin Sekolah tidak memiliki akses ke bank soal global Superadmin (kecuali bila telah dipublikasikan/dishare), Audit Log platform global, maupun Security Center platform.

---

## 2. Struktur 23 Domain Operasional Admin Sekolah

1. **Dashboard Sekolah (`/admin/dashboard`)**:
   - Metrik statistik real-time: Total Siswa, Guru, Pengawas, Ujian Aktif, Sesi Berjalan, Pelanggaran Aktif.
   - Status live node pengawas dan agenda ujian hari ini.
2. **Profil & Identitas Sekolah (`/admin/school`)**:
   - Data legal: NPSN, NSS, Nama Sekolah, Jenjang (SD/SMP/SMA/SMK).
   - Alamat lengkap: Desa/Kelurahan, Kecamatan, Kota/Kabupaten, Provinsi, Kode Pos.
   - Kontak resmi: Telepon, Email, Website.
   - Data Kepala Sekolah: Nama dan NIP.
   - KOP Surat Resmi & Logo Sekolah untuk cetak kartu dan berita acara.
3. **Manajemen Akun Sekolah (`/admin/users`)**:
   - Pengelolaan pengguna internal: Admin, Guru, Pengawas.
   - Reset password dan penguncian/pembatalan sesi aktif (`session_version`).
4. **Data Siswa (`/admin/students`)**:
   - Data identitas: NISN, NIS, Nama Lengkap, Jenis Kelamin, Tempat/Tanggal Lahir, Rombel/Kelas, Tahun Masuk.
   - Impor massal (Excel/CSV) dengan rollback transaksional (All-or-Nothing Atomicity).
   - Generate kode akses kartu ujian otomatis yang unik per siswa.
5. **Data Guru (`/admin/teachers`)**:
   - NIP, NUPTK, Nama Lengkap, nomor kontak, serta status keaktifan.
6. **Data Pengawas (`/admin/proctors`)**:
   - Registrasi pengawas ruang, riwayat penugasan, dan pemantauan sesi.
7. **Rombel & Kelas (`/admin/classes`)**:
   - Pengelompokan tingkat kelas, nama kelas, alokasi wali kelas, dan penetapan siswa per rombel.
8. **Mata Pelajaran (`/admin/subjects`)**:
   - Kode mapel, nama mata pelajaran, jenjang, kategori (Umum / Pilihan / Kejuruan).
9. **Tahun Ajaran & Semester (`/admin/academic-years`)**:
   - Siklus tahun akademik aktif tunggal (`isActive = true`), semester ganjil/genap aktif tunggal.
10. **Penetapan Guru & Mapel (`/admin/teachers`)**:
    - Relasi guru pengampu mata pelajaran (`teacher_subjects`) dan pembina kelas (`teacher_classes`).
11. **Bank Soal & Versi Soal (`/admin/question-bank`)**:
    - Manajemen butir soal terisolasi sekolah dengan revision tracking otomatis.
    - Format soal: Pilihan Ganda, PG Kompleks, Benar/Salah, Menjodohkan, Isian Singkat, dan Esai.
    - Render formula matematika KaTeX LaTeX ($...$).
    - Alur peninjauan status moderasi (`DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`).
12. **Ujian & Snapshot Safety (`/admin/exams`)**:
    - Penjadwalan ujian, mode durasi (Fleksibel / Serentak), token ujian, dan kebijakan tampil skor.
    - **Snapshot Immutability**: Penguncian soal ujian ke dalam `question_snapshot_json` yang membekukan butir soal saat ujian aktif, mencegah ketidaksinkronan akibat pengeditan bank soal selama ujian berjalan.
13. **Peserta Ujian & Token Individual (`/admin/exams/[id]/participants`)**:
    - Pendaftaran siswa ke ujian berdasarkan rombel atau filter individu.
    - Token individual unik yang dienkripsi dan hanya diberikan saat sesi login valid.
14. **Ruang Ujian & Alokasi Kapasitas (`/admin/exam-rooms`)**:
    - Nama ruang, kode ruang, batas kapasitas meja/komputer, dan pembagian sesi ujian.
15. **Penjadwalan Pengawas Bebas Bentrok (`/admin/exam-proctors`)**:
    - Validasi jadwal pengawas: sistem mendeteksi dan memblokir penugasan pengawas yang sama pada ruang berbeda di sesi dan waktu yang bertabrakan (Conflict-Free Scheduling).
16. **Live Exam Monitoring (`/admin/monitoring`)**:
    - Pemantauan real-time laju peserta, deteksi heartbeat, status koneksi (Online / Weak / Offline), dan catatan pelanggaran tab/browser.
    - **Zero Leakage**: Kunci jawaban dan token sesi siswa tidak pernah dikirimkan ke antarmuka monitoring demi mencegah eksfiltrasi kredensial.
    - Kendali pengawas: Tambah waktu (+15m), paksa submit, buka kunci perangkat, dan reset login dengan alasan wajib audit.
17. **Hasil Ujian & Penilaian Esai Manual (`/admin/results`)**:
    - Agregat skor otomatis untuk soal objektif.
    - Penilaian esai manual dengan validasi batas skor (`0 <= score <= max_weight`) dan penghitungan ulang nilai akhir transaksional.
18. **Laporan Resmi Sekolah (`/admin/reports`)**:
    - 8 Laporan Terpadu:
      1. Ringkasan & Agregat Nilai
      2. Rekapitulasi Nilai per Siswa
      3. Rekapitulasi Nilai per Mata Pelajaran
      4. Rekapitulasi Nilai per Kelas
      5. Rekapitulasi Ruang & Sesi Ujian
      6. Analisis Butir Soal (Daya pembeda & tingkat kesukaran)
      7. Log Anomali & Pelanggaran Peserta
      8. Ekspor Nilai Lengkap (CSV & JSON)
19. **Audit Trail Sekolah (`/admin/audit`)**:
    - Log audit tersimpan secara *append-only* (immutable) dan hanya mencakup aktivitas di dalam `school_id` terkait.
20. **Pengaturan Kebijakan Sekolah (`/admin/settings`)**:
    - Batas waktu tunggu pengerjaan, toleransi keterlambatan, dan kebijakan integritas ujian sekolah.

---

## 3. Validasi Otomatis & Hasil Pengujian

Suite pengujian otomatis dijalankan melalui [scripts/tests/test-school-admin-sprint02.mjs](file:///d:/1.3.Tugas%20Negara%20(Program)/sagaya_exam/scripts/tests/test-school-admin-sprint02.mjs):
- **Total Assertions**: 23/23 Lulus (0 Gagal).
- **Cakupan Validasi**:
  1. Isolasi tenant dan pencegahan IDOR (403 Forbidden terverifikasi).
  2. Perlindungan terhadap eskalasi hak Superadmin.
  3. Perlindungan terhadap penghapusan admin sekolah aktif terakhir.
  4. Atomisitas transaksi impor siswa dan rollback saat terjadi galat data.
  5. Deteksi bentrok jadwal pengawas ruang ujian.
  6. Imutabilitas snapshot paket soal ujian saat bank soal diperbarui.
  7. Validasi batas skor penilaian esai manual dan pencatatan log audit.
  8. Sanitasi data monitoring tanpa kebocoran kunci jawaban atau token sesi.
  9. Isolasi log audit pada cakupan tenant.
