# SAGAYA EXAM — UI-04 SUPERADMIN EXPERIENCE SPECIFICATION

## 1. Overview & Platform Philosophy

Modul **Superadmin** adalah pusat kendali tingkat platform (*Platform Control Center*) untuk Sagaya Exam CBT Engine.
Superadmin mengelola tata kelola makro lintas institusi:
- **School Governance**: Direktori satuan pendidikan, kuota lisensi, dan status operasional (ACTIVE, SUSPENDED, ARCHIVED).
- **Platform Identity Center**: Manajemen identitas multi-peran (Superadmin, Admin Sekolah, Guru, Pengawas) dengan proteksi anti-lockout akun master.
- **Global Question Bank**: Kurasi dan standarisasi butir soal tingkat daerah/wilayah dengan siklus hidup formal (DRAFT $\rightarrow$ REVIEW $\rightarrow$ APPROVED $\rightarrow$ PUBLISHED $\rightarrow$ LOCKED).
- **Regional Exam Governance**: Distribusi paket asesmen serentak lintas sekolah dengan snapshot naskah soal yang immutable.
- **Platform Security & Sessions**: Pemantauan anomali login, penegakan rate limiting, inspeksi perangkat sesi staf, dan terminasi paksa.
- **Immutable Audit Trail**: Jejak audit kepatuhan (*compliance*) untuk setiap mutasi dan aksi administratif.
- **Emergency Hub**: Intervensi darurat (perpanjangan waktu ujian, reset login serentak, terminasi paksa) dengan pencatatan alasan audit wajib.
- **System Settings**: Parameter global platform, kebijakan integritas CBT, dan pemeliharaan tanpa mengekspos rahasia sistem.

---

## 2. Route Map & Navigation Matrix

| Rute | Modul | Deskripsi |
| :--- | :--- | :--- |
| `/superadmin` | Dashboard | Ringkasan kondisi platform, KPI aktual, status ekosistem, jejak audit terbaru, dan quick actions. |
| `/superadmin/schools` | Sekolah | Direktori satuan pendidikan, pagination server-side, filter status, dan penambahan tenant. |
| `/superadmin/schools/[schoolId]` | Detail Sekolah | Tab profil, admin penanggung jawab, statistik kuota, riwayat aktivitas, serta aksi transisi status (Suspend/Archive). |
| `/superadmin/users` | User Platform | Direktori identitas platform terpadu, pencarian multi-kriteria (nama, username, NIP), dan aksi keamanan. |
| `/superadmin/users/[userId]` | Detail Pengguna | Tab Profil, Parameter Keamanan (session_version, failed logins), Daftar Sesi Perangkat, dan Log Audit personal. |
| `/superadmin/questions` <br> `/superadmin/question-bank` | Bank Soal Global | Kurasi naskah soal terstandarisasi, lifecycle status, peninjauan revisi, dan status immutable snapshot. |
| `/superadmin/exams` | Ujian Platform | Tata kelola paket asesmen wilayah, penjadwalan, penugasan sekolah peserta, dan penerbitan lembar soal. |
| `/superadmin/exams/[examId]` | Detail Ujian | Konfigurasi evaluasi, passing grade, daftar sekolah terdaftar, dan aksi publikasi/penguncian naskah. |
| `/superadmin/security` | Security Center | Monitoring anomali login, mitigasi brute force, dan integritas sesi. |
| `/superadmin/security/sessions` | Sesi Aktif | Manajemen sesi perangkat staf, inspeksi IP & browser, serta tindakan cabut sesi individual. |
| `/superadmin/audit` | Audit Center | Arsip jejak audit kekal (read-only), filter kepatuhan, modal inspeksi detail, dan ekspor CSV. |
| `/superadmin/emergency` | Emergency Hub | Intervensi krisis operasional dengan mitigasi dampak dan rekaman audit wajib. |
| `/superadmin/settings` | Pengaturan | Konfigurasi parameter umum, keamanan sesi, integritas ujian, dan mode pemeliharaan. |

---

## 3. Sensitive Action & Security UX

1. **Anti-Lockout Protection**:
   - Sistem secara aktif memvalidasi keberadaan Superadmin aktif. Tindakan menghapus atau menonaktifkan Superadmin terakhir dicegah secara mutlak demi menjaga ketersediaan akses platform.
2. **Audit Reason Requirement**:
   - Tindakan sensitif (menonaktifkan sekolah, mengarsipkan sekolah, menonaktifkan user, mengubah peran, mereset password, dan mengeksekusi aksi darurat) mewajibkan operator memasukkan alasan (*reason*) minimal 5 karakter sebelum dieksekusi.
3. **Session Revocation via `session_version`**:
   - Saat peran diubah, kata sandi direset, atau dilakukan force logout, backend secara atomik menginkrementasi `session_version` pengguna di PostgreSQL, seketika membatalkan semua token JWT lama di seluruh perangkat.
4. **No Secret Leaking**:
   - Tidak ada kredensial, hash password, token JWT, ataupun kunci API yang terekspos di tabel ataupun form pengaturan.

---

## 4. UI Foundation & Component Reusability

- **Shell**: `SuperAdminLayout` dengan `SuperAdminSidebar` yang collapsible dan `SuperAdminHeader` yang dilengkapi `Breadcrumb`, indikator keamanan, dan `Dropdown` user menu.
- **Data Display**: Menggunakan `StatCard` untuk KPI, `StatusBadge` untuk visualisasi status, `Tabs` untuk navigasi internal, dan `EmptyState` untuk kondisi nihil data yang jujur.
- **Dialogs**: Seluruh tindakan sensitif dan destruktif dilindungi oleh `ConfirmDialog` dengan varian `primary` atau `danger`.
