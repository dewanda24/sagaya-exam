# SAGAYA EXAM — UI-07 PENGAWAS WORKSPACE

## 1. Ikhtisar & Peran Pengawas (*Proctor Operational*)
Workspace Pengawas adalah antarmuka operasional real-time yang dirancang khusus bagi petugas pengawas ruang ujian pada platform Sagaya Exam CBT Engine.

Pengawas berfokus penuh pada **operasional pengawasan ujian**, bukan administrasi sekolah dan bukan editing soal:
$$\text{Login} \longrightarrow \text{Dasbor Pengawas} \longrightarrow \text{Jadwal Ujian} \longrightarrow \text{Pilih Ruang} \longrightarrow \text{Pra-Cek Kesiapan} \longrightarrow \text{Presensi} \longrightarrow \text{Live Monitoring} \longrightarrow \text{Detail Peserta \& Insiden} \longrightarrow \text{Tindakan Darurat} \longrightarrow \text{Selesai}$$

### Batasan Kewenangan (*Strict Security Boundaries*)
- **Bukan Administrator Sekolah**: Tidak memiliki menu manajemen pengguna, rombel, mapel, atau lisensi sekolah.
- **Bukan Guru Penyusun Soal**: Tidak memiliki akses bank soal, pengeditan butir soal, atau pengubahan konfigurasi bobot nilai.
- **Zero Answer-Key Leakage**: Kunci jawaban (*answer key*), kunci jawaban benar, dan rubrik internal dilarang keras dikirim ke antarmuka pengawas.
- **Zero Raw-Answers Leakage**: Teks jawaban mentah siswa tidak diekspos kepada pengawas.
- **Anti-IDOR Enforcement**: Pengawas hanya dapat mengakses ruang dan ujian yang ditugaskan secara sah melalui tabel `exam_room_proctors`.

---

## 2. Struktur Rute Pengawas
| Rute | Deskripsi Operasional | Otorisasi & Cakupan |
| :--- | :--- | :--- |
| `/pengawas` / `/pengawas/dashboard` | Dasbor utama metrik riil KPI & jadwal hari ini | Role `PENGAWAS`, tenant sekolah |
| `/pengawas/profile` | Identitas pengawas, tenant sekolah, dan pintasan keamanan | Akun pengawas aktif |
| `/pengawas/schedule` | Daftar jadwal pengawasan dengan filter tanggal & status | Hanya ujian/ruang yang ditugaskan |
| `/pengawas/exams` | Grid kartu ujian aktif milik pengawas | Hanya ujian yang ditugaskan |
| `/pengawas/exams/[examId]` | Detail ujian operasional & ruang pengawasan | Validasi `exam_room_proctors` |
| `/pengawas/exams/[examId]/precheck` | Pra-pemeriksaan kesiapan 7-poin sistem & checklist ruang | Validasi ruang & otorisasi pengawas |
| `/pengawas/exams/[examId]/attendance` | Presensi peserta ujian (Hadir, Alpa, Terlambat, Izin) | Mutasi terotentikasi & diaudit |
| `/pengawas/exams/[examId]/monitoring` | Layar Live Monitoring radar pengerjaan real-time | Server timer, detak jantung, darurat |
| `/pengawas/exams/[examId]/participants/[participantId]` | Detail mendalam peserta, linimasa pelanggaran & catatan | Zero answer-key & raw-answers |
| `/pengawas/exams/[examId]/incidents` | Pusat kendali kendala teknis khusus ujian bersangkutan | Audit pelaporan & resolusi insiden |
| `/pengawas/incidents` | Pusat insiden global pengawas di seluruh sesi tugasnya | Audit pelaporan & resolusi insiden |

---

## 3. Tata Letak Mandiri (*PengawasLayout*)
Seluruh halaman pengawas menggunakan komponen tata letak mandiri `PengawasLayout` yang membungkus:
- `PengawasSidebar`: Navigasi ramping khusus operasional:
  - **UTAMA**: Dasbor (`/pengawas/dashboard`)
  - **OPERASIONAL PENGAWASAN**: Jadwal Ujian (`/pengawas/schedule`), Ujian Aktif & Ruang (`/pengawas/exams`), Pusat Insiden (`/pengawas/incidents`)
  - **PENGATURAN**: Profil Pengawas (`/pengawas/profile`)
- `PengawasHeader`:
  - Breadcrumb navigasi hierarkis
  - Jam digital live real-time server (detik akurat untuk pengawasan)
  - Profil popover dengan konfirmasi dialog logout aman

---

## 4. Fitur Utama & Alur Pemantauan

### 4.1 Pra-Pemeriksaan Kesiapan (*Pre-Exam Check*)
Verifikasi 7-poin sebelum ujian dimulai:
1. Konfigurasi Ujian Tersedia (`PASS`)
2. Jadwal Waktu Pelaksanaan Valid (`PASS`)
3. Ruang Ujian Terikat & Sah (`PASS`)
4. Peserta Terdaftar Dimuat (`PASS`)
5. Otoritas Pengawas Terverifikasi (`PASS`)
6. Layanan Sesi CBT Aktif (`PASS`)
7. Saluran Pemantauan Siap (`PASS`)
Serta 5 checklist operasional fisik pengawas: ruang steril, peserta tertib di meja, komputer klien siap, koneksi stabil, dan tata tertib dibacakan.

### 4.2 Presensi Peserta (*Attendance Management*)
- Ringkasan realtime: Hadir (`PRESENT`), Alpa (`ABSENT`), Terlambat (`LATE`), Izin (`EXCUSED`).
- Tombol aksi satu-klik dengan pembaruan instan ke database dan audit ID pengawas.
- Pencarian cerdas nama siswa, NIS, atau NISN.

### 4.3 Live Monitoring Radar
- **Tiga Mode Tampilan**: *Grid Cards* (kartu responsif visual), *Data Table* (tabel padat data), dan *Compact View* (kartu mikro untuk 50+ peserta per layar).
- **Server Countdown Timer**: Waktu hitung mundur berasal mutlak dari selisih `end_time` server dengan timestamp server.
- **Detak Jantung & Koneksi**: Mengklasifikasikan koneksi peserta:
  - `ONLINE`: Detak jantung diterima dalam <30 detik.
  - `RECENTLY_DISCONNECTED`: Detak jantung 30–90 detik tanpa kabar (indikasi lag/koneksi putus).
  - `OFFLINE`: >90 detik tanpa detak jantung.
- **Progres Pengerjaan**: Menampilkan jumlah soal terjawab terhadap total butir soal (`18/40, 45%`) tanpa membuka butir jawaban.

### 4.4 Tindakan Darurat Berkonfirmasi (*Emergency Actions*)
1. **Reset Sesi Perangkat Klien**:
   - Menghapus pengikatan `device_fingerprint` dan IP peserta saat komputer klien rusak/restart.
   - Mewajibkan alasan audit.
2. **Penghentian Sesi Paksa (*Force Logout / Terminate*)**:
   - Mengeluarkan siswa dari ujian secara paksa bagi pelanggaran berat.
   - Mewajibkan alasan audit tersimpan ke database.
3. **Penambahan Waktu Darurat Ruang**:
   - Menambahkan durasi ujian (+5, +10, +15, +30 menit) server-wide untuk seluruh peserta di ruang tersebut akibat kendala teknis (listrik padam/gangguan jaringan).
4. **Pesan Siaran Ruang (*Broadcast*)**:
   - Mengirim pengumuman langsung yang muncul di layar siswa.
5. **Catatan Pengawas**:
   - Mencatat anomali individual peserta yang disimpan ke `proctor_notes`.

---

## 5. Pengujian & Verifikasi
- **Automated Test Suite**: `scripts/tests/test-proctor-ui07.mjs` (14/14 tes lulus 100%).
- **TypeScript Static Verification**: `tsc --noEmit` lulus dengan exit code 0 tanpa error tipe data.
- **Anti-IDOR & Tenant Isolation**: Proctor A terbukti 100% diblokir dari ujian sekolah lain dan ujian di luar penugasan resminya.
- **Zero Answer-Key & Raw-Answer Leakage**: Terverifikasi melalui audit payload JSON.
