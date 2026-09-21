# SAGAYA EXAM — UI-03 AUTHENTICATION ARCHITECTURE & UX SPECIFICATION

## 1. Overview & Core Principles

UI-03 mengimplementasikan ulang alur autentikasi dan keamanan pengguna staf (Superadmin, Admin Sekolah, Guru, Pengawas) dengan prinsip-prinsip utama:
- **Server Authoritative**: Frontend tidak pernah menentukan role, tenant (`schoolId`), izin akses (RBAC), atau durasi sesi. Seluruh data identitas diverifikasi melalui JWT HTTP-Only dan session engine backend Sprint 03.
- **Privacy & Anti-Enumeration**: Pesan kesalahan saat login dan pemulihan kata sandi dirancang generik guna mencegah enumerasi akun pengguna (`Username atau password tidak valid`).
- **No Password Storing / Leaking**: Kata sandi tidak pernah disimpan di localStorage, dicatat di log frontend, dikirimkan melalui parameter URL, ataupun diteruskan ke analytics.
- **Rate Limiting UX**: Jika backend mengembalikan status HTTP 429 Too Many Requests beserta header `Retry-After`, form login otomatis mengunci input dan menampilkan hitung mundur detik yang akurat sesuai respon server.
- **Open Redirect Protection**: Validasi ketat terhadap parameter `redirect` memastikan pengalihan hanya dilakukan ke path internal yang valid (`/admin`, `/guru`, `/pengawas`, `/superadmin`), menolak skema eksternal, double-slash, dan protokol `javascript:`.

---

## 2. Routes & Navigation Flows

| Route | Akses | Deskripsi & Komponen |
| :--- | :--- | :--- |
| `/login` | Publik | Halaman login utama staf dengan input username/email, password toggle, anti-double-click, dan role-redirection. |
| `/login/forgot-password` <br> `/forgot-password` | Publik | Permintaan tautan reset kata sandi dengan pesan konfirmasi aman yang tidak membocorkan keberadaan akun. |
| `/login/reset-password` <br> `/reset-password` | Publik | Penetapan kata sandi baru dengan checklist validasi kebijakan keamanan real-time (panjang minimal 8 karakter, kombinasi alfanumerik). |
| `/account/security` | Terautentikasi | Pengaturan keamanan pengguna: formulir ganti kata sandi dan manajemen sesi aktif (cabut sesi lain). |
| `/403` | Terautentikasi / Publik | Halaman peringatan hak akses ditolak jika mencoba membuka rute di luar wewenang role pengguna. |

---

## 3. Login UX Specifications

### 3.1. Formulir Masuk (`/login`)
- **Username / Identitas**:
  - Label: `Username atau Email`
  - Mendukung input username sistem, email institusi, atau NIP guru sesuai kapabilitas backend Sprint 03.
  - Atribut autocomplete standar: `username`.
- **Password**:
  - Label: `Kata Sandi`
  - Tombol toggle show/hide kata sandi (ikon mata) yang dapat diakses penuh via keyboard (`Tab` & `Enter`/`Space`).
  - Atribut autocomplete: `current-password`.
- **Tombol Masuk**:
  - Teks idle: `Masuk`
  - Teks loading: `[ Memproses... ]` dengan spinner animasi
  - Tombol dinonaktifkan (`disabled`) selama pemrosesan request untuk mencegah submit ganda (*race condition*).
- **Penanganan Status Akun**:
  - Status `LOCKED`: Menampilkan informasi penangguhan akun dengan imbauan menghubungi administrator sekolah/pusat.
  - Status `SUSPENDED` / `INACTIVE`: Menampilkan pesan keamanan terstandar.

### 3.2. Role-Based Redirection
Setelah login sukses, respon otentikasi dari backend memberikan identitas peran yang sah:
- `SUPER_ADMIN` $\rightarrow$ `/superadmin/dashboard`
- `ADMIN` $\rightarrow$ `/admin/dashboard`
- `GURU` $\rightarrow$ `/guru/dashboard`
- `PENGAWAS` $\rightarrow$ `/pengawas/dashboard`

---

## 4. Keamanan & Manajemen Sesi Aktif (`/account/security`)

1. **Ubah Kata Sandi**:
   - Meminta verifikasi kata sandi saat ini (`oldPassword`), kata sandi baru (`newPassword`), dan konfirmasi kata sandi.
   - Peringatan keamanan: Mengganti kata sandi akan otomatis mencabut seluruh sesi aktif lainnya demi melindungi integritas akun.
2. **Daftar Sesi Aktif**:
   - Membaca sesi dari endpoint `GET /api/auth/sessions`.
   - Menampilkan detail perangkat, browser, alamat IP, waktu aktif terakhir, serta penanda `Sesi Ini`.
   - Tindakan pencabutan sesi:
     - Cabut sesi individual (`action: 'revoke_session'`).
     - Cabut seluruh sesi lain (`action: 'revoke_all_sessions'`) dengan modal konfirmasi keamanan `ConfirmDialog`.

---

## 5. Accessibility & Responsive Matrix
- Standar kontras teks: Memenuhi WCAG 2.1 AA.
- Form controls memiliki label eksplisit yang dihubungkan dengan atribut `htmlFor` dan `id`.
- Indikator fokus yang jelas (`ring-2 ring-primary-500/20`) saat navigasi menggunakan tombol `Tab`.
- Kompatibel dengan semua ukuran viewport mobile (320px, 375px, 390px, 768px, 1024px, 1280px+).
