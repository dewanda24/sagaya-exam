# SAGAYA EXAM — PANDUAN ANTARMUKA UJIAN SISWA (UI-08 STUDENT EXAM)

## 1. Ringkasan Arsitektur

Antarmuka Ujian Siswa (*Student Exam Interface*) Sagaya CBT dirancang untuk memberikan pengalaman pengerjaan ujian berbasis komputer yang **fokus, stabil, aman, bebas distraksi, ramah pemulihan (recovery-friendly), dan mematuhi standar aksesibilitas WCAG 2.2 AA**.

Alur pengerjaan end-to-end siswa:
$$\text{Token} \longrightarrow \text{Validasi \& Info} \longrightarrow \text{Konfirmasi Identitas} \longrightarrow \text{Instruksi} \longrightarrow \text{Readiness Check} \longrightarrow \text{Start Exam} \longrightarrow \text{Workspace} \longrightarrow \text{Autosave} \longrightarrow \text{Review} \longrightarrow \text{Submit} \longrightarrow \text{Selesai / Hasil}$$

---

## 2. Peta Rute (*Route Map*)

| Rute | Deskripsi | Akses |
|---|---|---|
| `/ujian` & `/ujian/token` | Halaman entri token siswa dan validasi kartu peserta | Publik / Siswa |
| `/exam/lobby` | Lobi persiapan: info ujian, verifikasi identitas, instruksi, dan uji kesiapan jaringan/perangkat | Siswa Terautentikasi |
| `/ujian/[sessionId]` | Lembar pengerjaan ujian CBT (*Active Exam Shell*) | Siswa Pemilik Sesi |
| `/ujian/session/[sessionId]` | Alias rute sesi aktif (otomatis dialihkan ke `/ujian/[sessionId]`) | Siswa Pemilik Sesi |
| `/ujian/[sessionId]/selesai` | Halaman penyelesaian ujian dengan bukti pengumpulan resmi | Siswa Pemilik Sesi |
| `/ujian/session/[sessionId]/complete` | Alias rute selesai (otomatis dialihkan ke `/ujian/[sessionId]/selesai`) | Siswa Pemilik Sesi |
| `/ujian/[sessionId]/result` | Halaman perolehan nilai dan rincian evaluasi resmi siswa | Siswa Pemilik Sesi (Status: Published) |
| `/ujian/session/[sessionId]/result` | Alias rute hasil siswa | Siswa Pemilik Sesi |

---

## 3. Komponen Utama Student Exam Shell

### 3.1. Header CBT Khusus (Distraction-Free)
- **Informasi Peserta & Ujian**: Nama ujian, mata pelajaran, nama siswa, NISN, kelas, dan paket soal. Kredensial sensitif seperti token mentah dan session secret **tidak pernah ditampilkan**.
- **Server-Authoritative Timer (`01:23:45`)**:
  - Diperbarui setiap detik di klien berdasarkan hitungan sisa waktu server (`serverExpiresAt`).
  - Threshold visual:
    - Normal (> 10 menit): latar netral slate.
    - Warning ($\le$ 10 menit): latar kuning amber.
    - Critical / Danger ($\le$ 5 menit): latar merah rose berkedip halus (*pulse*).
  - Klien tidak dapat menambah waktu atau menggeser timer secara lokal.
- **Connection Status**:
  - `● Online / Terhubung` (emerald)
  - `Offline (Buffer Aktif)` (amber/rose)
- **Autosave Status Indicator**:
  - `✓ Tersimpan di Server`
  - `Menyimpan...`
  - `Aman di Komputer (N)`: indikator antrean offline lokal saat jaringan lab terputus.

---

## 4. Question Renderer Multi-Tipe

Sistem mendukung 6 tipe butir soal kurikulum Merdeka dan standar ANBK:

1. **Pilihan Ganda (Single Choice)**:
   - Kartu opsi pilihan dengan label huruf (A, B, C, D, E).
   - Target klik luas dan nyaman di perangkat sentuh (*touch-friendly*).
   - Semantic radio behaviour.
2. **Pilihan Ganda Kompleks (Multiple Response)**:
   - Checkbox dengan petunjuk: *"Pilih semua jawaban yang sesuai"*.
   - Menyimpan array ID opsi yang dipilih.
3. **Benar / Salah (True / False)**:
   - Tombol pilihan semantik *Benar* (hijau) dan *Salah* (merah).
4. **Menjodohkan (Matching Pairs)**:
   - Sisi kiri menampilkan premis; sisi kanan berupa dropdown selektor pasangan yang diacak dari server.
   - **Zero Answer-Key Leakage**: Pasangan jawaban benar tidak dikirimkan ke browser; server hanya mengirimkan `matchingItems` yang berisi daftar premis dan target terpisah.
5. **Isian Singkat (Short Answer)**:
   - Kolom teks bersih dengan pemangkasan spasi otomatis (*auto-trim*).
6. **Uraian (Essay)**:
   - Textarea responsif dengan penghitung langsung: `Karakter` dan `Kata`.
   - Debounce penyimpanan autosave otomatis.
7. **Stimulus / Wacana Rujukan (ANBK Standard)**:
   - Komponen wacana terstruktur dengan judul, teks bacaan berrumus matematika KaTeX (`MathRenderer`), dan infografis/media.

---

## 5. Navigasi Soal (*Question Navigator*)

- **Desktop**: Panel samping (*sidebar*) dengan nomor soal teratur.
- **Mobile**: Tombol toggle `📋 Soal X/Y` yang membuka panel *bottom sheet drawer* responsif.
- **Indikator Warna Butir Soal**:
  - `○ Abu-abu / Netral`: Belum dijawab.
  - `✓ Hijau Emerald`: Sudah dijawab.
  - `★ Kuning Amber`: Ditandai ragu-ragu (*doubtful*).
  - `Ring Biru`: Soal yang sedang aktif dibuka.
- **Kebijakan Navigasi**:
  - `FREE_NAVIGATION`: Siswa bebas berpindah nomor soal secara acak.
  - `LINEAR_NAVIGATION` / `STRICT_LINEAR`: Siswa hanya dapat bergerak maju. Tombol soal di depan terkunci (`disabled`) hingga soal sebelumnya diselesaikan.

---

## 6. Autosave, Resiliensi Jaringan & Recovery

1. **Local Storage Buffer**:
   - Setiap perubahan jawaban langsung disimpan ke buffer lokal komputer lab (`localStorage: sagaya_cbt_buffer_[sessionId]`).
   - Masuk ke antrean sinkronisasi `sagaya_cbt_pending_[sessionId]`.
2. **Sinkronisasi Otomatis**:
   - Jika koneksi terputus, sistem menampilkan banner tenang: *"Koneksi Lab Terputus — Jawaban Anda Tetap AMAN di komputer ini"*.
   - Begitu koneksi pulih, antrean otomatis dikirim ulang (*flush queue*) ke server secara berurutan.
3. **Heartbeat Sinkronisasi (Setiap 7 detik)**:
   - Mengirim indeks nomor soal aktif dan jumlah pelanggaran tab.
   - Menerima update sisa waktu server terbaru, penambahan waktu darurat dari pengawas (+N menit), dan siaran pengumuman (*broadcast flash*).
   - Menangani instruksi *Force Submit* dari pengawas ruangan.
4. **Proteksi Anti-Kecurangan Ringan**:
   - Deteksi *Visibility Change* (siswa berpindah tab atau meminimalkan browser) menampilkan modal peringatan dan mencatat log pelanggaran ke pengawas.
   - Mengunci pintasan berbahaya (F12, Ctrl+Shift+I, Ctrl+U, Ctrl+P, dsb.).
   - Pencegahan penutupan jendela tanpa sengaja melalui event `beforeunload`.

---

## 7. Submission Engine & Hasil Ujian

1. **Modal Review Rekapitulasi**:
   - Menampilkan total soal, jumlah terjawab, ragu-ragu, dan belum dijawab.
   - Menampilkan peringatan tegas jika masih terdapat soal yang belum dijawab.
   - Kotak centang persetujuan wajib: *"Saya menyatakan telah selesai memeriksa jawaban dan yakin mengumpulkan lembar ujian ini."*
2. **Proteksi Klik Ganda & Idempotensi**:
   - Tombol submit dinonaktifkan seketika dengan status *"Mengirimkan..."*.
   - Endpoint server `/api/student/session/[sessionId]/submit` bersifat idempoten; pengiriman ulang tidak akan menggandakan skor atau menyebabkan error 500.
3. **Halaman Penyelesaian & Hasil Resmi**:
   - Halaman bukti pengumpulan `/ujian/[sessionId]/selesai` mencantumkan waktu pengumpulan dan status pengerjaan.
   - Jika hasil ujian sudah dipublikasikan oleh guru/sekolah, tersedia tombol *"Lihat Hasil Ujian"* menuju `/ujian/[sessionId]/result`.
   - Jika hasil belum dipublikasikan, sistem secara aman menampilkan pesan informasi dan menolak pembocoran nilai sebelum waktunya.
