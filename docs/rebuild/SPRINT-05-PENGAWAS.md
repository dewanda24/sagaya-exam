# SAGAYA EXAM — SPRINT 05: PENGAWAS / PROCTOR CORE

**Status**: COMPLETED  
**Tanggal**: 2026-09-20  
**Domain**: Operator Pelaksanaan Ujian (Proctor Core Engine)  

---

## 1. Scope & Batasan Wewenang Pengawas

Pengawas adalah **Operator Pelaksanaan Ujian**. Berbeda dengan Guru (pembuat konten dan kurikulum ujian) dan Administrator Sekolah (pengatur operasional sekolah), Pengawas bertindak secara ketat untuk memantau, memverifikasi kesiapan ruang, mencatat presensi, memitigasi kendala teknis, serta mencatat insiden selama ujian berlangsung.

### Prinsip Pembatasan Hak Akses (Zero Trust Principle)
Pengawas **TIDAK MEMILIKI HAK AKSES** terhadap:
1. **Password Hash Pengguna & Siswa**: Tidak dapat diakses atau di-reset oleh pengawas.
2. **Token Sesi Aktif Siswa (`token` / session token)**: Diproteksi secara ketat dari seluruh respon endpoint pengawas.
3. **Kunci Jawaban (`answer_key_json`)**: Tidak pernah disertakan dalam payload monitoring atau detail peserta.
4. **Isi Jawaban Siswa (`answer_value_json`)**: Pengawas hanya menerima agregasi rasio progress (`answered_count` / `total_questions`).
5. **Bank Soal & Pengeditan Butir Soal**: Pengawas tidak memiliki izin membuat, mengubah, atau merevisi soal.
6. **Nilai Akhir & Koreksi Nilai**: Pengawas tidak memiliki hak penskoran atau manipulasi hasil ujian.
7. **Audit Log Global Platform**: Pengawas tidak dapat melihat atau memanipulasi audit log sekolah lain maupun log platform.

---

## 2. Proctor Architecture & Scope Authorization

Setiap request dari Pengawas melalui rantai otorisasi bertingkat:
```
Authenticated User (Session Cookie)
   ↓
Role Authorization ('PENGAWAS', 'ADMIN', 'SUPER_ADMIN')
   ↓
Granular Permission Check ('proctor.*')
   ↓
Tenant Isolation (school_id match)
   ↓
Proctor Assignment Verification (exam_room_proctors)
   ↓
Room Assignment Verification (exam_rooms)
   ↓
Participant Scope Verification (exam_participants)
   ↓
Business Service Layer
   ↓
PostgreSQL Database + Immutable Audit Logging
```

Pengawas hanya diizinkan mengakses data ujian dan ruang yang **secara eksplisit ditugaskan kepada dirinya**. Upaya mengakses ruang atau ujian di luar penugasannya secara otomatis ditolak dengan kode status HTTP `403 Forbidden` atau `404 Not Found`.

---

## 3. Assignment Model & Multi-Proctor Support

Model relasi penugasan pengawas dirancang sebagai berikut:
$$\text{Exam} \longrightarrow \text{ExamRoom} \longrightarrow \text{ProctorAssignment (exam\_room\_proctors)}$$

### Multi-Proctor Per Ruang
Satu ruang ujian dapat diawasi oleh 1 orang atau lebih pengawas (misal Pengawas Utama dan Pengawas Pendamping). Skema database mendukung ini melalui constraint gabungan:
```sql
CONSTRAINT uq_exam_room_session_proctor UNIQUE (exam_id, room_id, session_number, proctor_id)
```

### Deteksi Konflik Jadwal (Room Conflict Detection)
Sistem secara otomatis mendeteksi jika seorang pengawas dijadwalkan pada 2 ruang atau 2 ujian berbeda yang rentang waktunya bertabrakan (`start_time, end_time OVERLAPS`). Penugasan ganda yang bertabrakan akan ditolak oleh sistem.

---

## 4. Monitoring Model & Server-Authoritative Engine

Server bertindak sebagai **satu-satunya sumber kebenaran (Source of Truth)** untuk metrik pemantauan ujian:
- **Autoritas Waktu**: Sisa waktu ujian (`remainingSeconds`) dan sisa waktu sesi peserta dihitung secara server-side menggunakan timestamp database. Perbedaan jam pada browser pengawas atau siswa tidak mempengaruhi batas akhir ujian.
- **Heartbeat & Konektivitas**:
  - `ONLINE`: Ping terakhir siswa $< 30$ detik.
  - `RECENTLY_DISCONNECTED`: Ping terakhir siswa antara $30$ sampai $90$ detik.
  - `OFFLINE`: Ping terakhir siswa $\ge 90$ detik atau tidak ada ping.
- **Status Peserta Terkalkulasi**:
  - `NOT_STARTED`: Peserta terdaftar namun belum login/memulai sesi.
  - `IN_PROGRESS`: Peserta sedang aktif mengerjakan ujian.
  - `DISCONNECTED`: Peserta sedang dalam sesi namun koneksi terputus.
  - `TIMEOUT`: Waktu pengerjaan peserta telah habis menurut batas server.
  - `SUBMITTED`: Peserta telah menyelesaikan dan mengirim ujian secara resmi.
  - `LOCKED`: Akses peserta dihentikan atau dikunci oleh pengawas/sistem.

---

## 5. Presensi Peserta (Attendance Management)

Rute: `/pengawas/exams/[examId]/attendance`

Status kehadiran:
- `PRESENT`: Hadir tepat waktu.
- `ABSENT`: Tidak hadir tanpa keterangan.
- `LATE`: Hadir terlambat melewati waktu mulai ujian.
- `EXCUSED`: Izin resmi / sakit.

Presensi dicatat pada tabel `attendance_records` secara independen dan **tidak memodifikasi master tabel siswa (`students`)**. Setiap perubahan presensi memicu audit log immutable `ATTENDANCE_UPDATED`.

---

## 6. Pelanggaran (Violation Monitoring)

Sistem memantau dan mencatat event perilaku peserta:
- `TAB_SWITCH`: Siswa berpindah tab atau meminimalkan jendela browser.
- `FULLSCREEN_EXIT`: Siswa keluar dari mode layar penuh.
- `FOCUS_LOST`: Kehilangan fokus input secara mencurigakan.
- `DISCONNECT`: Terputusnya koneksi jaringan siswa ke server.
- `RECONNECT`: Siswa tersambung kembali ke sesi.
- `FORCED_TERMINATION`: Pemutusan paksa oleh pengawas.

### Tingkat Keparahan (Severity):
- `INFO`: Reconnect jaringan, log aktivitas normal.
- `WARNING`: 1–2 kali perpindahan tab.
- `CRITICAL`: $\ge 3$ kali perpindahan tab atau pelanggaran berat.

---

## 7. Manajemen Insiden (Incident Management)

Rute: `/pengawas/incidents`

Pengawas dapat melaporkan kendala teknis operasional:
- **Kategori**: `NETWORK_ISSUE`, `DEVICE_ISSUE`, `PARTICIPANT_ISSUE`, `ROOM_ISSUE`, `OTHER`.
- **Tingkat Keparahan**: `INFO`, `WARNING`, `CRITICAL`.
- **Status**: `OPEN` $\rightarrow$ `RESOLVED`.

Pelaporan dan penyelesaian insiden wajib menyertakan deskripsi dan tindakan yang diambil (`action_taken`). Insiden tidak mengubah nilai ujian secara langsung.

---

## 8. Catatan Pengawas (Proctor Notes)

Pengawas dapat menyematkan catatan kontekstual untuk siswa atau ruang tertentu (misalnya penjelasan mengapa siswa berpindah tab karena gangguan Wi-Fi lab). Catatan ini tersimpan di tabel `proctor_notes`, bersifat append-only, dan tercatat pada audit log `PROCTOR_NOTE_CREATED`.

---

## 9. Kendali Sesi & Tindakan Darurat (Force & Emergency Control)

### Force Logout / Revoke Session
- Memeriksa izin `proctor.session.revoke`.
- Memeriksa penugasan pengawas terhadap ruang dan peserta tersebut.
- Memutuskan sesi peserta menjadi `DISCONNECTED` dan mencatat audit log `STUDENT_SESSION_REVOKED`.

### End Student Session
- Mengunci akses peserta menjadi `LOCKED`.
- Berbeda secara tegas dari aksi submit otomatis (`SUBMITTED`).
- Mencatat audit log `STUDENT_SESSION_ENDED`.

### Perpanjangan Waktu Darurat (Emergency Extension)
- Memeriksa izin `proctor.emergency.request`.
- Durasi 1–60 menit dengan alasan (`reason`) wajib diisi.
- Memperpanjang batas waktu sesi aktif di ruang tersebut di server dan mencatat audit log `EMERGENCY_ACTION_REQUESTED`.

---

## 10. Matriks Hak Akses (Permission Matrix)

| Permission | SUPER_ADMIN | ADMIN | GURU | PENGAWAS |
| :--- | :---: | :---: | :---: | :---: |
| `proctor.dashboard.read` | ✅ | ✅ | ❌ | ✅ |
| `proctor.schedule.read` | ✅ | ✅ | ❌ | ✅ |
| `proctor.exam.read` | ✅ | ✅ | ❌ | ✅ |
| `proctor.exam.monitor` | ✅ | ✅ | ❌ | ✅ |
| `proctor.room.read` | ✅ | ✅ | ❌ | ✅ |
| `proctor.participants.read` | ✅ | ✅ | ❌ | ✅ |
| `proctor.attendance.read` | ✅ | ✅ | ❌ | ✅ |
| `proctor.attendance.update` | ✅ | ✅ | ❌ | ✅ |
| `proctor.violation.read` | ✅ | ✅ | ❌ | ✅ |
| `proctor.incident.create` | ✅ | ✅ | ❌ | ✅ |
| `proctor.incident.update` | ✅ | ✅ | ❌ | ✅ |
| `proctor.note.create` | ✅ | ✅ | ❌ | ✅ |
| `proctor.session.read` | ✅ | ✅ | ❌ | ✅ |
| `proctor.session.revoke` | ✅ | ✅ | ❌ | ✅ |
| `proctor.emergency.request` | ✅ | ✅ | ❌ | ⚠️ (Granular) |
| `question.create` / `update` | ✅ | ✅ | ✅ | ❌ |
| `grading.update` | ✅ | ✅ | ✅ | ❌ |

---

## 11. Endpoint API Baru

1. `GET /api/proctor/dashboard` — Ringkasan metrik dasbor pengawas hari ini.
2. `GET /api/proctor/schedule` — Jadwal penugasan pengawasan ruang dengan filter.
3. `GET /api/proctor/exams` — Daftar ujian yang ditugaskan kepada pengawas.
4. `GET /api/proctor/exams/[examId]` — Detail ujian dan daftar ruang penugasan.
5. `GET /api/proctor/exams/[examId]/rooms/[roomId]` — Pre-exam check & kesiapan ruang.
6. `POST /api/proctor/exams/[examId]/rooms/[roomId]/start-monitoring` — Mulai pengawasan ruang.
7. `POST /api/proctor/exams/[examId]/rooms/[roomId]/end-monitoring` — Akhiri pengawasan ruang.
8. `GET /api/proctor/exams/[examId]/rooms/[roomId]/monitoring` — Data live monitoring peserta ruang tersanitasi.
9. `GET /api/proctor/exams/[examId]/attendance` — Lembar presensi peserta di ruang.
10. `POST /api/proctor/exams/[examId]/attendance` — Update status presensi peserta.
11. `GET /api/proctor/exams/[examId]/participants/[participantId]` — Detail peserta tersanitasi.
12. `GET /api/proctor/exams/[examId]/violations` — Daftar pelanggaran peserta di ruang.
13. `POST /api/proctor/exams/[examId]/violations` — Pencatatan event pelanggaran.
14. `GET /api/proctor/incidents` — Daftar insiden teknis ujian.
15. `POST /api/proctor/incidents` — Lapor insiden teknis baru.
16. `PATCH /api/proctor/incidents/[id]` — Selesaikan insiden teknis (`RESOLVED`).
17. `GET /api/proctor/notes` — Ambil catatan pengawas.
18. `POST /api/proctor/notes` — Buat catatan pengawas kontekstual.
19. `POST /api/proctor/sessions/revoke` — Force logout / cabut sesi siswa.
20. `POST /api/proctor/sessions/end` — Kunci / hentikan akses siswa (`LOCKED`).
21. `POST /api/proctor/emergency/extend` — Eksekusi perpanjangan waktu darurat.

---

## 12. Skema Database & Migrasi

Migrasi: `supabase/migrations/20260920_sprint05_proctor_core.sql`
- Tabel `attendance_records` (Presensi peserta per ujian dan ruang).
- Tabel `exam_violations` (Event pelanggaran siswa beserta severity).
- Tabel `exam_incidents` (Laporan insiden teknis operasional ruang).
- Tabel `proctor_notes` (Catatan pengawas kontekstual).
- Tabel `proctor_monitoring_sessions` (Pelacakan status monitoring ruang).
- Update constraint `exam_room_proctors`: `UNIQUE (exam_id, room_id, session_number, proctor_id)`.
- Composite Index multi-tenant pada seluruh tabel baru.

---

## 13. Hasil Pengujian Keamanan (Security Test Suite)

Skrip pengujian otomatis `scripts/tests/test-proctor-sprint05.mjs` memvalidasi 53 pengujian tanpa kegagalan (0 failed):
1. **Otentikasi & RBAC Pengawas**: Pengawas memiliki izin operasional penuh, namun dilarang mengedit soal, membuat ujian, atau memanipulasi nilai.
2. **IDOR Cross-Exam Blocking**: Pengawas A1 ditolak mengakses Ujian 2 (403/404).
3. **IDOR Cross-Room Blocking**: Pengawas A1 ditolak mengakses Ruang 2 pada Ujian 1 (403/404).
4. **Tenant Isolation**: Pengawas Sekolah A ditolak mengakses ujian atau ruang Sekolah B (403/404).
5. **Cross-Room Participant IDOR**: Pengawas A1 ditolak mengakses data peserta di Ruang 2 (403/404).
6. **Data Leakage Protection**: Token sesi, password hash, kunci jawaban, dan jawaban siswa tidak pernah bocor dalam respon endpoint pengawas.
7. **Audit Log Immutability**: Seluruh aksi penting (Presensi, Insiden, Catatan, Force Logout, End Session, Perpanjangan Darurat) tercatat rapi di tabel `audit_logs`.
