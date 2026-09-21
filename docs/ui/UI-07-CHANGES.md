# SAGAYA EXAM — UI-07 CHANGES LOG

## Modul: UI-07 Proctor Workspace (Pengawas Ujian)
**Sprint**: UI-07  
**Tanggal**: 2026-09-21  
**Status**: SELESAI & TERVERIFIKASI

---

## 1. Komponen Baru
| File | Deskripsi |
| :--- | :--- |
| `src/components/pengawas/PengawasSidebar.tsx` | Navigasi proctor ramping (Dasbor, Jadwal, Ujian Aktif, Pusat Insiden, Profil) |
| `src/components/pengawas/PengawasHeader.tsx` | Header proctor dengan live digital clock, breadcrumbs, dan logout modal |
| `src/components/pengawas/PengawasLayout.tsx` | Pembungkus tata letak utama seluruh halaman `/pengawas/*` |

---

## 2. Halaman Baru & Pembaruan Rute
| File | Status | Perubahan Utama |
| :--- | :--- | :--- |
| `src/app/pengawas/page.tsx` | MODIFIED | Menggunakan `PengawasLayout` dan mengalihkan ke `/pengawas/dashboard` |
| `src/app/pengawas/dashboard/page.tsx` | MODIFIED | Beralih dari `AdminLayout` ke `PengawasLayout`, KPI riil, jadwal hari ini, umpan insiden, zero fake data |
| `src/app/pengawas/profile/page.tsx` | NEW | Halaman profil mandiri pengawas, identitas, sekolah tenant, dan ringkasan tugas |
| `src/app/pengawas/schedule/page.tsx` | MODIFIED | Beralih ke `PengawasLayout`, filter tanggal & status, pencarian ruang/ujian, kartu aksi |
| `src/app/pengawas/exams/page.tsx` | MODIFIED | Beralih ke `PengawasLayout`, grid ujian ditugaskan, ringkasan ruang, navigasi detail |
| `src/app/pengawas/exams/[examId]/page.tsx` | MODIFIED | Pusat operasional ujian: detail ujian, alokasi waktu, daftar ruang, dan rekan pengawas (*multi-proctor*) |
| `src/app/pengawas/exams/[examId]/precheck/page.tsx` | NEW | Pra-pemeriksaan kesiapan 7-poin sistem server dan 5-poin checklist fisik ruang |
| `src/app/pengawas/exams/[examId]/attendance/page.tsx` | MODIFIED | Beralih ke `PengawasLayout`, tab seleksi ruang, pencarian siswa, mutasi presensi real-time |
| `src/app/pengawas/exams/[examId]/monitoring/page.tsx` | NEW | Layar Live Monitoring utama: radar pengerjaan (Grid/Table/Compact), timer server, detak jantung, aksi darurat |
| `src/app/pengawas/exams/[examId]/rooms/[roomId]/page.tsx` | MODIFIED | Mengarahkan dan membungkus dengan aman ke live monitoring terpadu |
| `src/app/pengawas/exams/[examId]/participants/[participantId]/page.tsx` | NEW | Detail mendalam peserta: progres, sisa waktu server, detak jantung, linimasa pelanggaran, catatan pengawas |
| `src/app/pengawas/exams/[examId]/incidents/page.tsx` | NEW | Pusat insiden spesifik per ujian: pelaporan kendala ruang dan dialog resolusi |
| `src/app/pengawas/incidents/page.tsx` | MODIFIED | Beralih ke `PengawasLayout`, filter status insiden, pencatatan dan resolusi kendala |

---

## 3. Pembaruan Endpoint API
| Endpoint | Perubahan |
| :--- | :--- |
| `GET /api/proctor/exams/[examId]` | Ditambahkan pengembalian daftar rekan pengawas (*multi-proctor*) per ruang |
| `GET /api/proctor/exams/[examId]/participants/[participantId]` | Auto-resolve `roomId` dari database jika tidak dicantumkan di query parameter |

---

## 4. Hasil Verifikasi & Testing
- `node scripts/tests/test-proctor-ui07.mjs`:
  - 14/14 test cases **PASSED** (0 failed).
  - Verifikasi peran `PENGAWAS`, batas tenant `school_id`, proteksi Anti-IDOR, zero answer-key leakage, mutasi presensi, dan pelaporan insiden.
- `node ./node_modules/typescript/bin/tsc --noEmit`:
  - **Exit Code 0** (0 syntax/type errors).
