# SAGAYA EXAM — UI-03 STUDENT ENTRY & EXAM LOBBY EXPERIENCE

## 1. Overview & Core Principles

Alur masuk siswa (*Student Entry*) ke ujian dirancang terpisah secara ketat dari login staf. Siswa tidak menggunakan username/password staf dan tidak memiliki hak akses ke modul manajemen sekolah. 

Alur utama:
```text
TOKEN ENTRY (/ujian atau /ujian/token)
    ↓
VALIDASI TOKEN & DEVICE BINDING
    ↓
EXAM LOBBY (/exam/lobby)
    ├─ Exam Information
    ├─ Identity Confirmation ("Ya, ini saya" / "Bukan saya")
    ├─ Instructions & Rules Acknowledgement Checkbox
    └─ System Readiness Check (Network Latency Ping, Browser, Device Bound)
    ↓
START EXAM (Race-condition protected)
    ↓
EXAM WORKSPACE (/exam/session)
```

---

## 2. Token Entry Experience (`/ujian` & `/ujian/token`)

1. **Input Format & Sanitasi**:
   - Membantu visual formatting pola `XXXX-XXXX` (8 karakter alfanumerik huruf kapital).
   - Mendukung pengetikan langsung, penghapusan (`Backspace`), dan paste dari clipboard tanpa merusak karakter valid.
   - Tidak pernah menyimpan token ujian di `localStorage` atau menyisipkannya ke dalam URL query parameters.
2. **State Validasi Token**:
   - `EMPTY`: Input kosong, tombol dinonaktifkan secara anggun.
   - `VALIDATING`: Menampilkan indikator loading dan tombol *disabled*.
   - `INVALID`: Token tidak ditemukan atau salah format (`Token tidak dapat digunakan. Periksa kembali token Anda atau hubungi pengawas ruang`).
   - `EXPIRED`: Token telah melewati batas durasi jadwal pelaksanaan ujian.
   - `RATE_LIMITED`: Jika mendeteksi brute-force atau percobaan berlebih, mengunci input dan menampilkan hitung mundur detik sesuai header `Retry-After`.
   - `DEVICE_MISMATCH`: Jika token telah terikat dengan perangkat lain yang sedang aktif.
   - `VALID`: Mengarahkan siswa secara otomatis ke `/exam/lobby`.

---

## 3. Exam Lobby Experience (`/exam/lobby`)

### 3.1. Konfirmasi Identitas Siswa
- Menampilkan nama lengkap peserta, NIS/NISN, serta kelas/rombel yang authoritative dari server.
- Opsi aksi:
  - **"Ya, ini saya"**: Mengonfirmasi keabsahan identitas peserta.
  - **"Bukan Saya"**: Mengirimkan permintaan pencabutan sesi sementara ke server (`POST /api/exam/session/leave`), menghapus cookie `sagaya_student_session`, dan mengembalikan siswa ke halaman `/ujian` dengan aman.

### 3.2. Informasi Ujian
- Menampilkan:
  - Judul Ujian
  - Mata Pelajaran
  - Alokasi Durasi (menit)
  - Jumlah Butir Soal dalam paket
  - Kebijakan Navigasi (Bebas / Berurutan)

### 3.3. Instruksi & Tata Tertib Ujian
- Memuat 6 poin tata tertib resmi:
  1. Pastikan koneksi internet stabil sebelum memulai.
  2. Gunakan perangkat yang telah terdaftar (dilarang berganti perangkat di tengah ujian).
  3. Baca setiap butir soal dengan teliti.
  4. Jawaban tersimpan otomatis secara berkala.
  5. Dilarang berpindah tab, menutup halaman, atau melakukan kecurangan akademik.
  6. Waktu ujian dihitung mutlak oleh server.
- **Persetujuan Wajib**: Checkbox *"Saya telah membaca dan memahami seluruh instruksi ujian, serta bersedia mematuhi tata tertib yang berlaku"*. Tombol "Mulai Ujian" terkunci sebelum checkbox ini dicentang.

### 3.4. Pemeriksaan Kesiapan Sistem (Readiness Check)
- **Koneksi Jaringan**: Melakukan ping nyata secara berkala ke endpoint `/api/health` untuk mengukur latensi (ms) dan status konektivitas.
- **Dukungan Browser**: Memastikan fitur modern browser aktif.
- **Perangkat Terikat**: Mengonfirmasi bahwa perangkat saat ini telah terdaftar untuk sesi ujian ini.

### 3.5. Tombol Mulai Ujian & Proteksi Race Condition
- Label idle: `Mulai Ujian`
- Label loading: `Memulai ujian...`
- Proteksi ganda: Tombol langsung dinonaktifkan (`disabled`) dan state `starting = true` mencegah klik ganda mengirimkan dua request start bersamaan.
- Respon sukses mengarahkan siswa ke lembar kerja ujian `/exam/session`.

---

## 4. Privacy & Anti-Leak Safeguards
- Tidak pernah membocorkan ID internal database (`school_id`, `participant_id`, `uuid` session).
- Kunci jawaban (*answer key*) tidak pernah disertakan dalam payload snapshot soal peserta.
