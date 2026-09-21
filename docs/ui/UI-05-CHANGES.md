# SAGAYA EXAM — UI-05 CHANGELOG & VERIFICATION RECORD

## Sprint Overview
- **Sprint**: UI-05 — Admin Sekolah Experience
- **Focus**: Rebuild Admin Sekolah Experience based on UI-01 Design System, covering School App Shell, Dashboard, School & Academic Modules, Operational Users & Staff, Exam Management & Scheduling, Live Monitoring Radar, Scoring & Results, Official Documentation, Forensic Audit, and School Settings.
- **Tenant Isolation**: Strictly bound to `authenticatedUser.school_id`. No cross-tenant visibility or tampering permitted.
- **Source of Truth**: Core backend Sprint 00–11, RBAC permissions, and PostgreSQL database schema.

---

## 1. Codebase Changes

### 1.1. Admin App Shell & Navigation
- `src/components/admin/AdminSidebar.tsx`:
  - Diperbarui dengan struktur navigasi modular terpadu:
    - **Dashboard**: `/admin/dashboard`
    - **Sekolah**: Profil Sekolah (`/admin/school`), Tahun Ajaran (`/admin/academic-years`), Semester (`/admin/semesters`), Rombel/Kelas (`/admin/classes`), Mata Pelajaran (`/admin/subjects`)
    - **Pengguna**: Pengguna (`/admin/users`), Siswa (`/admin/students`), Guru (`/admin/teachers`), Pengawas (`/admin/proctors`)
    - **Ujian**: Bank Soal (`/admin/question-bank`), Daftar Ujian (`/admin/exams`), Jadwal Ujian (`/admin/exams/schedule`), Ruang & Sesi (`/admin/exam-rooms`), Penugasan Pengawas (`/admin/proctors/assignments`)
    - **Monitoring**: Radar Monitoring Ujian (`/admin/monitoring`)
    - **Hasil & Laporan**: Nilai & Hasil (`/admin/results`), Analisis Nilai (`/admin/analytics`), Rekapitulasi Laporan (`/admin/reports`)
    - **Sistem**: Audit Log Sekolah (`/admin/audit`), Pengaturan Sekolah (`/admin/settings`)
- `src/components/admin/AdminHeader.tsx`:
  - Dilengkapi komponen `Breadcrumb` dari UI-01.
  - Dropdown user profil dengan shortcut Keamanan Akun dan modal konfirmasi logout aman (`ConfirmDialog`).
- `src/components/admin/AdminLayout.tsx`:
  - Mendukung prop `breadcrumbs` dinamis yang diteruskan ke `AdminHeader`.

### 1.2. Dashboard Operasional
- `src/app/api/admin/metrics/route.ts`:
  - Ditingkatkan untuk mengembalikan KPI komprehensif: Total Siswa, Guru, Pengawas, Kelas, Ujian Aktif, Ujian Mendatang, Sesi Aktif, dan Hasil Menunggu Review.
  - Mengembalikan daftar ujian berlangsung hari ini dan linimasa aktivitas audit sekolah terbaru.
- `src/app/admin/dashboard/page.tsx`:
  - Dirombak total menggunakan `StatCard` (8 metrik KPI real-time tanpa dummy data).
  - Banner pemantauan interaktif "Ujian Berlangsung Saat Ini" dengan tombol CTA langsung ke Monitoring.
  - Tabel "Jadwal Ujian Hari Ini" dan feed "Aktivitas Terbaru Sekolah".

### 1.3. Modul Sekolah & Akademik
- `src/app/admin/sekolah/page.tsx`:
  - Memperbaiki folder upload logo ke whitelist resmi `'logos'`.
- `src/app/admin/semesters/page.tsx`:
  - Halaman manajemen semester baru dengan `DataTable`, `StatusBadge`, filter tahun ajaran, dan `ConfirmDialog` untuk aktivasi semester.
- `src/app/api/admin/classes/route.ts`:
  - Menambahkan endpoint query detail satu kelas berdasarkan ID dengan verifikasi tenant ketat.
- `src/app/admin/classes/[classId]/page.tsx`:
  - Halaman detail kelas baru dengan 5 tab: *Ringkasan*, *Daftar Siswa*, *Guru Pengajar*, *Riwayat Ujian*, dan *Aktivitas*.
- `src/app/admin/kelas/page.tsx`:
  - Tautan nama rombel diarahkan langsung ke halaman detail `/admin/classes/[classId]`.

### 1.4. Manajemen Pengguna & Staf Operasional
- `src/app/api/admin/users/route.ts`:
  - Menambahkan query satu user berdasarkan ID dengan pemeriksaan tenant ketat.
- `src/app/admin/users/[userId]/page.tsx`:
  - Halaman detail pengguna sekolah dengan tab *Profil*, *Keamanan* (`session_version`, gagal login), *Aktivitas*, dan *Sesi Perangkat*.
  - Aksi sensitif (Reset Password, Force Logout, Disable/Enable) dilindungi `ConfirmDialog`.
- `src/app/admin/users/page.tsx`:
  - Tautan nama pengguna diarahkan ke `/admin/users/[userId]`.
- `src/app/api/admin/students/route.ts`:
  - Menambahkan query detail siswa berdasarkan ID.
- `src/app/admin/students/[studentId]/page.tsx`:
  - Halaman detail siswa dengan tab *Profil Lengkap*, *Rombel/Kelas*, *Jadwal Ujian*, *Riwayat Nilai*, dan *Log Aktivitas*. Tidak membocorkan password hash maupun token.
- `src/app/admin/students/import/page.tsx`:
  - Wizard impor multi-step (*Upload* $\rightarrow$ *Preview & Validasi* $\rightarrow$ *Deteksi Duplikasi* $\rightarrow$ *Konfirmasi* $\rightarrow$ *Proses Impor* $\rightarrow$ *Ringkasan Hasil*).
- `src/app/admin/siswa/page.tsx`:
  - Tautan nama siswa diarahkan ke `/admin/students/[studentId]`.
- `src/app/api/admin/teachers/route.ts`:
  - Menambahkan query detail guru berdasarkan ID.
- `src/app/admin/teachers/[teacherId]/page.tsx`:
  - Halaman detail guru dengan tab *Profil*, *Mata Pelajaran Diampu*, *Kelas Terkait*, *Bank Soal*, *Paket Ujian*, dan *Aktivitas*.
- `src/app/admin/guru/page.tsx`:
  - Tautan nama guru diarahkan ke `/admin/teachers/[teacherId]`.
- `src/app/admin/proctors/assignments/page.tsx`:
  - Halaman penugasan pengawas dengan deteksi konflik otomatis (*double booking* / tumpang tindih waktu di ruang berbeda).

### 1.5. Pengelolaan Ujian & Jadwal
- `src/app/admin/exams/schedule/page.tsx`:
  - Halaman linimasa jadwal pelaksanaan ujian dengan filter status dan shortcut penugasan pengawas.
- `src/app/admin/exams/[examId]/page.tsx`:
  - Halaman detail ujian lengkap dengan 10 tab (*Overview, Configuration, Questions, Participants, Schedule, Rooms, Proctors, Sessions, Results, Audit*) dan transisi siklus hidup formal (*DRAFT* $\rightarrow$ *PUBLISHED* $\rightarrow$ *SCHEDULED* $\rightarrow$ *ACTIVE* $\rightarrow$ *COMPLETED* $\rightarrow$ *LOCKED*).

### 1.6. Audit Forensik & Pengaturan Sekolah
- `src/app/api/admin/audit-logs/route.ts`:
  - Dibangun ulang sebagai route API mandiri terisolasi khusus Admin Sekolah. Menegakkan `WHERE al.school_id = $1` dan tidak lagi membocorkan daftar sekolah lain.
- `src/app/admin/audit-logs/page.tsx`:
  - Dibangun ulang dengan komponen `Card`, `DataTable`, `Badge`, dan `Breadcrumb`. Menghapus filter multi-sekolah platform dan mengkhususkan log forensik pada lingkungan sekolah terkait.
- `src/app/admin/pengaturan/page.tsx`:
  - Dibangun ulang untuk mengelola pengaturan operasional sekolah nyata (`displayName`, `timezone`, `studentNumberFormat`, `defaultDurationMinutes`, `defaultShowScorePolicy`, `headerTitle1`, `headerTitle2`, `examRulesNotice`, `enableTabViolationWarning`).
  - Menghilangkan eksposur konfigurasi global Superadmin (JWT secret, platform emergency, database secrets).

---

## 2. Verification & Automated Testing Record

1. **Automated Admin Sekolah Regression Test**:
   - Skrip: `node scripts/tests/test-admin-school-ui05.mjs`
   - Hasil: **19/19 PASSED (100%)**
   - Rincian Pengujian:
     - Group 1: Validasi identitas Admin Sekolah & pengikatan tenant tak-terpisahkan (`school_id`).
     - Group 2: Partisi ketat rombel (`class_rooms`) & entitas akademik lintas sekolah.
     - Group 3: Pengelolaan pengguna operasional (Siswa, Guru, Pengawas) & higienitas kredensial.
     - Group 4: Siklus hidup ujian (*Exam Lifecycle*) & ketersediaan ruang ujian.
     - Group 5: Isolasi jejak audit sekolah tanpa kebocoran log platform makro.
     - Group 6: Integritas pengaturan sekolah tanpa eksposur rahasia platform.
2. **Phase Verification**:
   - Pengujian live database PostgreSQL via pg pool.
   - Hasil: **PASS (100%)**
3. **TypeScript Type Check**:
   - Perintah: `npx tsc --noEmit`
   - Hasil: **PASS**
4. **Next.js Production Build**:
   - Perintah: `npm run build`
   - Status: Diuji dan siap rilis.
