# SPRINT 06 — STUDENT EXAM AUTHENTICATION & EXAM SESSION ENGINE

## 1. Student Authentication
Autentikasi ujian siswa pada Sagaya Exam dibangun dengan paradigma *zero-trust client identity*. Siswa tidak memilih role (Admin, Guru, Pengawas) dan tidak mengirimkan `studentId` atau `schoolId` sebagai penentu identitas.
- Siswa memasukkan Token Ujian berformat 8-karakter (`XXXX-XXXX`).
- Server melakukan normalisasi dan validasi kriptografis.
- Identitas siswa, sekolah tenant, penugasan ujian, dan paket soal ditentukan 100% di server side dari rekaman `exam_participants`.
- Server menerbitkan credential sesi `sagaya_student_session` berupa signed HMAC-SHA256 token yang disimpan dalam cookie `HttpOnly`, `SameSite=Lax`, dan `Secure` pada mode production.

## 2. Token Architecture
- **Karakter Bersih (No Ambiguity)**: Menggunakan alfabet 32-karakter aman (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`) tanpa angka/huruf mirip seperti `0`, `O`, `1`, `I`, `L`.
- **Entropy Tinggi**: $32^8 \approx 1,099 \times 10^{12}$ kombinasi unik per ujian.
- **Penyimpanan Aman**: Disimpan dalam bentuk hash SHA-256 (`token_hash`) pada database `exam_participants` untuk mencegah kebocoran plaintext secret.
- **Proteksi Brute-Force & Enumerasi**: Endpoint validasi dilindungi rate-limiter berbasis kombinasi IP dan konteks attempt token. Respon kegagalan seragam untuk mencegah enumerasi akun/ujian.

## 3. Participant Validation
Siswa hanya dapat mengikuti ujian jika memenuhi seluruh kriteria:
1. `schools.is_active === true` (Sekolah aktif / tidak dibekukan).
2. `students.is_active === true` (Siswa aktif).
3. `exam_participants.eligible === true` dan `token_status !== 'REVOKED'`.
4. `exams.status IN ('ACTIVE', 'PUBLISHED', 'SCHEDULED')`.
5. Waktu saat ini berada dalam rentang jadwal ujian (`start_time <= NOW() <= end_time`).
6. Belum ada submission final untuk kebijakan `ONE_ATTEMPT`.

## 4. Session Architecture
Sesi ujian direkam pada tabel `exam_sessions`:
- `id`: UUID Primary Key
- `exam_id`: UUID foreign key ke ujian
- `participant_id`: UUID foreign key ke partisipan
- `student_id`: UUID foreign key ke siswa
- `school_id`: UUID foreign key ke sekolah (Tenant boundary)
- `attempt_number`: Nomor percobaan (default 1)
- `status`: State status ujian
- `started_at` & `server_started_at`: Waktu server mulai
- `expires_at` & `server_expires_at`: Waktu server berakhir mutlak
- `last_heartbeat_at`: Waktu ping terakhir
- `device_id` & `device_fingerprint`: Identifier perangkat terikat
- `session_version`: Versi sesi untuk pembatalan instan / reset pengawas

## 5. State Machine
Centralized State Machine diatur melalui `ExamSessionStateService`:
- `CREATED`: Sesi terinisialisasi awal.
- `READY`: Token valid, siswa berada di Lobi Ujian (`/exam/lobby`).
- `IN_PROGRESS`: Siswa menekan [Mulai Ujian] di lobi, timer berjalan.
- `DISCONNECTED`: Terputus dari jaringan atau heartbeat terlambat.
- `SUBMITTED`: Jawaban telah diserahkan secara permanen (Submit Lock aktif).
- `TIMEOUT`: Batas waktu server habis, auto-finalisasi aktif.
- `TERMINATED`: Dihentikan oleh Pengawas/Admin karena pelanggaran atau darurat.
- `INVALIDATED`: Dibatalkan karena pergantian versi sesi / indikasi session hijacking.

Transisi ilegal (misal `SUBMITTED` $\to$ `IN_PROGRESS`) secara mutlak ditolak.

## 6. Timer Authority
- Server adalah pemegang otoritas waktu mutlak.
- Waktu kedaluwarsa (`expires_at`) dihitung pada saat sesi dimulai:
  $$\text{expires\_at} = \min(\text{NOW()} + \text{duration\_minutes}, \text{exam.end\_time})$$
- Sisa waktu dihitung dari $\max(0, \lfloor(\text{expires\_at} - \text{NOW()}) / 1000\rfloor)$.
- Nilai dari client seperti `elapsedTime = 0` atau manipulasi jam JavaScript diabaikan.

## 7. Heartbeat
- Client mengirimkan heartbeat secara berkala (setiap 10-15 detik) ke `POST /api/exam/session/heartbeat`.
- Server memperbarui `last_heartbeat_at` dan memeriksa apakah `NOW() >= expires_at`. Jika waktu habis, server mengubah status menjadi `TIMEOUT`.
- Heartbeat juga menyampaikan pesan pengumuman/broadcast aktif dari pengawas.

## 8. Autosave Infrastructure
- Endpoint `POST /api/exam/session/autosave` menyimpan jawaban siswa secara persisten ke tabel `student_answers`.
- **Snapshot Verification**: Server memverifikasi bahwa `questionId` benar-benar terdaftar dalam `question_snapshot_json` ujian sesi tersebut. Siswa tidak dapat mengirimkan `questionId` dari ujian lain (Cross-Exam Attack pencegahan).
- **Optimistic Versioning**: Jawaban di-upsert dengan nomor versi inkremental (`version + 1`) dan timestamp `saved_at`, memastikan rekues lama tidak menimpa jawaban baru.
- **Submit Lock**: Jika status sesi adalah `SUBMITTED` atau `TIMEOUT`, seluruh mutasi autosave ditolak dengan kode 403.

## 9. Recovery & Reconnection
- Jika jaringan terputus atau siswa me-refresh browser, halaman `/exam/session` memicu flow recovery otomatis via `POST /api/exam/session/recover`.
- Server memvalidasi token sesi, mengecek sisa waktu, mengembalikan status dari `DISCONNECTED` menjadi `IN_PROGRESS`, dan mengirimkan kembali lembar soal aman beserta jawaban yang telah tersimpan.

## 10. Device Binding & Mismatch
- Identifier perangkat kriptografis diikat pada saat token pertama kali divalidasi.
- Jika request datang dari perangkat berbeda saat sesi berstatus `IN_PROGRESS` atau `READY`, server menolak dengan kode 409 `DEVICE_CONFLICT` / `DEVICE_MISMATCH`.
- Siswa wajib meminta Pengawas untuk melakukan Reset Sesi di dashboard pengawas jika perangkat mengalami kerusakan fisik.

## 11. Violation Tracking
- Event perpindahan tab (`TAB_SWITCH`), kehilangan fokus (`FOCUS_LOST`), dan keluar dari layar penuh (`FULLSCREEN_EXIT`) dilaporkan ke `POST /api/exam/session/violation`.
- Event disimpan di tabel `exam_session_violations` dan direplikasi ke `exam_violations` untuk pemantauan proktor real-time.
- Jumlah pelanggaran (`tab_violation_count`) dihitung secara server-side melalui `COUNT(events)`. Pengiriman `violationCount = 0` dari browser diabaikan.

## 12. Submit & Idempotency
- Penyerahan lembar jawaban melalui `POST /api/exam/session/submit` dikunci dengan transaksi database atomik (`SELECT ... FOR UPDATE`).
- Status sesi diubah menjadi `SUBMITTED` dan token partisipan diubah menjadi `USED`.
- **Idempotensi**: Jika siswa mengklik tombol submit dua kali, rekues kedua mendeteksi status `SUBMITTED` yang sudah ada dan mengembalikan konfirmasi sukses tanpa membuat duplikasi atau error inkonsisten.

## 13. Timeout & Auto-Submit
- Jika `NOW() >= expires_at`, server menetapkan status sesi menjadi `TIMEOUT`.
- Jawaban yang tersimpan di server dibekukan sebagai jawaban akhir. Server tidak menunggu pengiriman dari browser yang offline.

## 14. Security & IDOR Resistance
- **Bukan Session ID URL**: Endpoint sesi `/api/exam/session/*` tidak menggunakan ID sesi di path URL publik.
- **Validasi Kepemilikan (Ownership Check)**: Sesi hanya dapat diakses jika token siswa yang terverifikasi cocok dengan `participant_id`, `student_id`, `exam_id`, dan `school_id` pada database live.
- **Revokasi Instan**: Pengawas yang melakukan reset sesi menaikkan `session_version`. Token lama siswa seketika ditolak dengan kode 401 `SESSION_REVOKED`.

## 15. API Endpoints
1. `POST /api/exam/authenticate` - Validasi token ujian, pembuatan sesi `READY`, dan penerbitan cookie.
2. `POST /api/exam/session` & `POST /api/exam/session/start` - Memulai pengerjaan ujian (`READY` $\to$ `IN_PROGRESS`).
3. `GET /api/exam/session/current` - Mengambil metadata sesi, soal aman (tanpa answerKey), dan jawaban tersimpan.
4. `POST /api/exam/session/heartbeat` - Liveness check, sinkronisasi waktu server, dan broadcast.
5. `POST /api/exam/session/autosave` - Penyimpanan otomatis jawaban dengan validasi snapshot soal.
6. `POST /api/exam/session/violation` - Pencatatan event pelanggaran tab/layar penuh.
7. `POST /api/exam/session/recover` - Pemulihan sesi terputus / reload browser.
8. `POST /api/exam/session/submit` - Finalisasi penyerahan ujian secara atomik dan idempoten.
9. `POST /api/exam/session/terminate` - Penghentian sesi darurat oleh pengawas/admin berwenang.

## 16. Database Migrations
- File migrasi: `supabase/migrations/20260920_sprint06_student_session.sql`.
- Tabel termodifikasi:
  - `exam_sessions` (kolom baru: `exam_id`, `student_id`, `school_id`, `attempt_number`, `started_at`, `expires_at`, `terminated_at`, `device_id`, `session_version`, constraint status baru, partial unique index `uq_active_participant_session`).
  - `exam_participants` (kolom baru: `school_id`, `token_hash`, `attempt_number`, `eligible`, `assigned_at`, `status`).
  - `student_answers` (kolom baru: `version`, `saved_at`).
  - `exam_session_violations` (tabel baru pencatatan pelanggaran sesi siswa).

## 17. Observabilitas & Monitoring
- Metrik sesi aktif (`COUNT(*) WHERE status = 'IN_PROGRESS'`).
- Frekuensi detak jantung dan autosave per menit.
- Pelacakan insiden device mismatch dan tab switch yang terhubung langsung ke dashboard pengawas (Sprint 05).

## 18. Tests & Verification Suite
File uji: `scripts/tests/test-student-session-sprint06.mjs`.
- Total pengujian: 26 skenario keamanan dan fungsional.
- Hasil: **26 PASSED, 0 FAILED**.
- Seluruh 10 simulasi serangan (Attack 1 s/d Attack 10) berhasil ditolak dan diverifikasi.

## 19. Known Issues
- Pada lingkungan multi-server terdistribusi tanpa sticky sessions, in-memory rate limiter dapat digantikan dengan Redis store.

## 20. Rekomendasi Sprint 07
- Lanjutkan ke **Sprint 07 — Exam Engine & Question Delivery** untuk penyempurnaan pengacakan opsi/soal berbasis seed paket, ragam tipe soal kompleks (penjodohan, benar-salah, stimulus bersama), dan rich text math rendering.
