# SAGAYA EXAM — SPRINT 05: PENGAWAS / PROCTOR CORE FILE CHANGELOG

**Tanggal**: 2026-09-20  
**Sprint**: SPRINT 05 — PENGAWAS / PROCTOR CORE  

Berikut adalah dokumentasi perubahan berkas (file changes) yang ditambahkan, dimodifikasi, dan diselaraskan selama pelaksanaan Sprint 05.

---

## 1. Database & Migrations
- **[NEW]** `supabase/migrations/20260920_sprint05_proctor_core.sql`:
  - Membuat tabel `attendance_records` dengan constraint `uq_exam_participant_attendance`.
  - Membuat tabel `exam_violations` dengan indexing composite multi-tenant.
  - Membuat tabel `exam_incidents` dengan kategori kendala dan status `OPEN`/`RESOLVED`.
  - Membuat tabel `proctor_notes` untuk catatan pengawas kontekstual per siswa/ruang.
  - Membuat tabel `proctor_monitoring_sessions` untuk pelacakan status pengawasan ruang.
  - Memperbarui constraint `exam_room_proctors` menjadi `uq_exam_room_session_proctor` untuk mendukung multi-proctor per ruang.
- **[NEW]** `scripts/tests/run-sprint05-migration.mjs`:
  - Skrip eksekusi migrasi database Sprint 05.

---

## 2. Core Permissions & Authorization
- **[MODIFY]** `src/lib/core/permissions.ts`:
  - Menambahkan tipe `ProctorPermission` (15 hak akses granular proctor).
  - Memperbarui `PENGAWAS_PERMISSIONS`, `ADMIN_PERMISSIONS`, dan `SUPER_ADMIN_PERMISSIONS`.
- **[NEW]** `src/lib/services/proctor-authorization.service.ts`:
  - Layanan sentral otorisasi pengawas: `isProctorAssignedToRoom`, `isProctorAssignedToExam`, `canAccessExam`, `canAccessRoom`, `canAccessParticipant`, dan deteksi konflik jadwal `checkRoomScheduleConflict`.

---

## 3. Business Service Layer
- **[NEW]** `src/lib/services/proctor-core.service.ts`:
  - Agregasi statistik dasbor pengawas hari ini, pemfilteran jadwal pengawasan, kesiapan pra-ujian (`getPreExamCheck`), dan siklus pengawasan (`startMonitoring`, `endMonitoring`).
- **[NEW]** `src/lib/services/proctor-monitoring.service.ts`:
  - Pemantauan real-time ruang ujian server-authoritative (countdown, status koneksi ONLINE/RECENTLY_DISCONNECTED/OFFLINE, status peserta, rasio progress).
  - Sanitasi data ketat (tanpa token sesi, tanpa kunci jawaban, tanpa jawaban siswa).
  - `getParticipantDetail` untuk detail operasional siswa.
- **[NEW]** `src/lib/services/attendance.service.ts`:
  - Manajemen presensi ruang ujian (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`) dengan audit log immutable `ATTENDANCE_UPDATED`.
- **[NEW]** `src/lib/services/violation.service.ts`:
  - Pencatatan event pelanggaran siswa dan penambahan counter tab switch pada `exam_sessions`.
- **[NEW]** `src/lib/services/incident.service.ts`:
  - Pelaporan insiden operasional ruang dan resolusi insiden beserta pencatatan audit log.
- **[NEW]** `src/lib/services/proctor-note.service.ts`:
  - Pencatatan catatan pengawas kontekstual.
- **[NEW]** `src/lib/services/proctor-session-control.service.ts`:
  - Force logout / revoke session siswa (`DISCONNECTED`), penguncian akses siswa (`LOCKED`), dan perpanjangan waktu darurat (`requestEmergencyExtension`).

---

## 4. API Endpoints (`/api/proctor/*`)
- **[NEW]** `src/app/api/proctor/dashboard/route.ts`
- **[NEW]** `src/app/api/proctor/schedule/route.ts`
- **[NEW]** `src/app/api/proctor/exams/route.ts`
- **[NEW]** `src/app/api/proctor/exams/[examId]/route.ts`
- **[NEW]** `src/app/api/proctor/exams/[examId]/rooms/[roomId]/route.ts`
- **[NEW]** `src/app/api/proctor/exams/[examId]/rooms/[roomId]/start-monitoring/route.ts`
- **[NEW]** `src/app/api/proctor/exams/[examId]/rooms/[roomId]/end-monitoring/route.ts`
- **[NEW]** `src/app/api/proctor/exams/[examId]/rooms/[roomId]/monitoring/route.ts`
- **[NEW]** `src/app/api/proctor/exams/[examId]/attendance/route.ts`
- **[NEW]** `src/app/api/proctor/exams/[examId]/participants/[participantId]/route.ts`
- **[NEW]** `src/app/api/proctor/exams/[examId]/violations/route.ts`
- **[NEW]** `src/app/api/proctor/incidents/route.ts`
- **[NEW]** `src/app/api/proctor/incidents/[id]/route.ts`
- **[NEW]** `src/app/api/proctor/notes/route.ts`
- **[NEW]** `src/app/api/proctor/sessions/revoke/route.ts`
- **[NEW]** `src/app/api/proctor/sessions/end/route.ts`
- **[NEW]** `src/app/api/proctor/emergency/extend/route.ts`

---

## 5. UI Pages & Navigation (`/pengawas/*`)
- **[MODIFY]** `src/components/admin/AdminSidebar.tsx`:
  - Menambahkan menu pengawas: Dasbor Pengawas, Jadwal Pengawasan, Ujian & Monitoring, Laporan Insiden, Pusat Recovery Sesi, dan Presensi/BAPU Ruang.
- **[MODIFY]** `src/app/pengawas/page.tsx`:
  - Mengarahkan rute `/pengawas` langsung ke `/pengawas/dashboard`.
- **[NEW]** `src/app/pengawas/dashboard/page.tsx`:
  - Dasbor utama pengawas dengan ringkasan ujian hari ini, status ruang, pelanggaran baru, dan insiden terbuka.
- **[NEW]** `src/app/pengawas/schedule/page.tsx`:
  - Halaman jadwal pengawasan dengan filter tanggal, status ujian, ruang, dan pencarian.
- **[NEW]** `src/app/pengawas/exams/page.tsx`:
  - Daftar ujian yang ditugaskan kepada pengawas.
- **[NEW]** `src/app/pengawas/exams/[examId]/page.tsx`:
  - Halaman Pra-Pemeriksaan Ruang Ujian (Pre-Exam Check) dengan 5 poin kesiapan ruang & tombol mulai pengawasan.
- **[NEW]** `src/app/pengawas/exams/[examId]/rooms/[roomId]/page.tsx`:
  - Cockpit Utama Pemantauan Ruang Ujian: countdown server-authoritative, indikator live, visual stat cards, tabel peserta real-time, modal catatan pengawas, force logout siswa, penguncian sesi, lapor insiden, dan perpanjangan darurat.
- **[NEW]** `src/app/pengawas/exams/[examId]/attendance/page.tsx`:
  - Lembar presensi peserta ujian per ruang (PRESENT, ABSENT, LATE, EXCUSED) dengan auto-audit.
- **[NEW]** `src/app/pengawas/incidents/page.tsx`:
  - Halaman pelaporan dan resolusi insiden ruang ujian.

---

## 6. Automated Testing Suite
- **[NEW]** `scripts/tests/test-proctor-sprint05.mjs`:
  - 53 uji otomatis mencakup otentikasi, IDOR cross-exam, IDOR cross-room, tenant isolation, cross-room participant protection, zero data leakage, presensi, pelanggaran, insiden, force session control, perpanjangan darurat, dan imutabilitas audit log.
