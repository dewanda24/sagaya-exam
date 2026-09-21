# SAGAYA EXAM — UI-03 CHANGELOG & VERIFICATION RECORD

## Sprint Overview
- **Sprint**: UI-03 — Authentication & Student Entry Experience
- **Focus**: Rebuild staff login, forgot password, reset password, security & session management, student token entry, and student exam lobby using the UI-01 Design System.
- **Source of Truth**: Core backend Sprint 00–11, Authentication Engine Sprint 03, and Student Session Engine Sprint 06.

---

## 1. Routes & Codebase Changes

### 1.1. Authentication Routes (Staff)
- `src/app/login/page.tsx`:
  - Dirombak total menggunakan UI-01 primitives (`Card`, `Input`, `Button`, `Alert`, `Badge`).
  - Fitur show/hide password accessible via keyboard.
  - State button `[ Memproses... ]` dengan proteksi double-submit.
  - Pesan error aman anti-enumerasi (`Username atau password tidak valid`).
  - Penanganan rate-limit HTTP 429 dengan countdown timer dari header `Retry-After`.
  - Open redirect protection untuk parameter `redirect`.
  - Role-based automatic redirect: `SUPER_ADMIN` $\rightarrow$ `/superadmin/dashboard`, `ADMIN` $\rightarrow$ `/admin/dashboard`, `GURU` $\rightarrow$ `/guru/dashboard`, `PENGAWAS` $\rightarrow$ `/pengawas/dashboard`.
- `src/app/forgot-password/page.tsx` & `src/app/login/forgot-password/page.tsx`:
  - Formulir pemulihan kata sandi dengan pesan konfirmasi aman yang tidak membocorkan eksistensi akun pengguna.
- `src/app/reset-password/page.tsx` & `src/app/login/reset-password/page.tsx`:
  - Formulir penetapan kata sandi baru dengan policy checklist (minimal 8 karakter, huruf, angka, kecocokan konfirmasi).
- `src/app/account/security/page.tsx`:
  - Dirombak menggunakan `DashboardShell`.
  - Formulir ubah kata sandi dengan peringatan revokasi sesi lain.
  - Daftar sesi aktif dari `GET /api/auth/sessions` lengkap dengan info perangkat, browser, IP, waktu aktif, dan penanda sesi saat ini.
  - Tombol cabut sesi individual dan modal konfirmasi `ConfirmDialog` untuk cabut semua sesi lain.

### 1.2. Student Entry & Exam Lobby
- `src/app/ujian/page.tsx` & `src/app/ujian/token/page.tsx`:
  - Halaman entri token siswa dengan auto-formatting `XXXX-XXXX`, clipboard paste, keyboard support, status offline/online, dan deteksi error terkontekstualisasi (`TOKEN_EXPIRED`, `EXAM_NOT_ACTIVE`, `DEVICE_MISMATCH`).
- `src/app/exam/lobby/page.tsx`:
  - Dirombak total menggunakan UI-01 Design System (desain modern, bersih, akademis).
  - Ringkasan informasi ujian (nama ujian, mata pelajaran, durasi waktu, jumlah butir soal, kebijakan navigasi).
  - Kartu konfirmasi identitas peserta (nama siswa, NISN, kelas) dengan tombol konfirmasi `"Ya, ini saya"` dan aksi `"Bukan Saya"` yang menghapus cookie sesi dan meredirect ke `/ujian`.
  - Kartu instruksi & tata tertib ujian dengan checkbox persetujuan wajib.
  - Pemeriksaan kesiapan sistem (*Readiness Check*) dengan ping latensi aktif ke `/api/health`, status browser, dan konfirmasi perangkat terikat.
  - Tombol "Mulai Ujian" dengan label `Memulai ujian...` saat loading dan proteksi klik ganda (*race condition*).
- `src/app/api/exam/session/leave/route.ts`:
  - Endpoint baru untuk menghapus cookie `sagaya_student_session` saat siswa membatalkan lobi atau menyatakan identitas bukan miliknya.

### 1.3. Public Navigation
- `src/components/public/PublicHeader.tsx`:
  - Terintegrasi dengan hook `useAuth()` untuk mendeteksi sesi pengguna secara otomatis.
  - Menampilkan tombol `Dashboard` menuju dashboard sesuai role saat terautentikasi alih-alih tombol raw `Masuk`.
  - Menampilkan kartu profil ringkas staf dalam menu drawer mobile saat terautentikasi.

---

## 2. Verification & Testing

1. **TypeScript Type Check**:
   - Perintah: `npx tsc --noEmit`
   - Hasil: **PASS** (bebas dari error kompilasi).
2. **Student Session Engine Regression Test**:
   - Perintah: `node scripts/tests/test-student-session-sprint06.mjs`
   - Hasil: **PASS** (100% lulus, validasi token, session start, heartbeat, autosave, submission, dan concurrency berjalan normal).
3. **Production Build**:
   - Perintah: `npm run build`
   - Hasil: **PASS** (semua route publik dan terautentikasi sukses ter-generate).
