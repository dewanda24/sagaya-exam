# SAGAYA EXAM — SPRINT 02: REKAPITULASI PERUBAHAN SISTEM

Dokumen ini mencatat seluruh penambahan tabel, berkas kode, endpoint API, service layer, dan halaman antarmuka pengguna pada Sprint 02 (Admin Sekolah / School Admin Operations).

---

## 1. Migrasi Database & Skema

- **Migration File**: `supabase/migrations/20260919_sprint02_school_admin.sql`
- **Execution Script**: `scripts/migrations/002_school_admin_operations.mjs`
- **Perubahan Tabel**:
  - `academic_years`: Menampung siklus tahun ajaran per sekolah (`school_id`, `name`, `start_date`, `end_date`, `status`).
  - `semesters`: Periode semester terikat tahun ajaran (`academic_year_id`, `school_id`, `name`, `status`).
  - `teacher_subjects`: Relasi guru pengampu mata pelajaran terikat sekolah (`school_id`, `teacher_id`, `subject_id`).
  - `teacher_classes`: Relasi guru pembina/pengajar pada rombel kelas (`school_id`, `teacher_id`, `class_room_id`, `subject_id`).
  - `exam_questions`: Relasi butir soal terikat paket ujian dengan nomor revisi dan bobot (`exam_id`, `question_id`, `revision_number`, `order_index`, `weight`).
  - **Ekstensi Kolom**:
    - `schools`: Ditambahkan kolom `nss`, `village`, `district`, `city`, `province`, `postal_code`, `website`.
    - `users`: Ditambahkan kolom `nuptk`.
    - `students`: Ditambahkan kolom `birth_place`, `birth_date`, `entry_year`, `rombel`, `status`.
    - `class_rooms`: Ditambahkan kolom `academic_year_id`, `homeroom_teacher_id`, `is_active`.
    - `subjects`: Ditambahkan kolom `level`, `category`, `is_active`.
    - `exams`: Ditambahkan kolom `academic_year_id`, `semester_id`, `target_class_ids`.
  - **Composite Multi-Tenant Indexes**:
    - `idx_students_school_nisn`, `idx_students_school_class`, `idx_users_school_role`, `idx_exams_school_status`, `idx_qb_school_subject`, `idx_ep_exam_student`.

---

## 2. Lapisan Inti Keamanan & RBAC (`src/lib/core/`)

- `src/lib/core/permissions.ts`: Menambahkan permission matrix komprehensif untuk Admin Sekolah (`SCHOOL_PROFILE_MANAGE`, `STUDENT_MANAGE`, `TEACHER_MANAGE`, `PROCTOR_MANAGE`, `CLASS_MANAGE`, `SUBJECT_MANAGE`, `ACADEMIC_YEAR_MANAGE`, `QUESTION_BANK_MANAGE`, `EXAM_MANAGE`, `EXAM_MONITOR_MANAGE`, `EXAM_RESULT_MANAGE`, `REPORT_VIEW`, `REPORT_EXPORT`, `AUDIT_LOG_VIEW`, `SETTINGS_MANAGE`).
- `src/lib/core/rbac.ts`:
  - `assertTenantOwnership(userSchoolId, targetSchoolId, resourceName)`: Memastikan akses tidak melintasi batas sekolah.
  - `assertNotSuperAdminTarget(targetRole, actionName)`: Melindungi akun dan wewenang SUPER_ADMIN.
  - `assertNotLastSchoolAdmin(schoolId, targetUserId, actionName)`: Mencegah hilangnya admin aktif terakhir sekolah.
- `src/lib/core/types.ts`: Menambahkan dan memperbarui interface TypeScript untuk `School`, `User`, `AcademicYear`, `Semester`, `ClassRoom`, `Subject`, `TeacherSubject`, `TeacherClass`, `Student`, `ExamRoom`, `ExamRoomProctor`, `ExamQuestion`, `QuestionBankItem`.

---

## 3. Service Layer (`src/lib/services/`)

1. `school-profile.service.ts`: Pengelolaan data profil, identitas, alamat, kontak, dan KOP resmi sekolah.
2. `school-user.service.ts`: Manajemen akun pengguna internal sekolah (Admin, Guru, Pengawas, Staf).
3. `student.service.ts`: CRUD siswa, alokasi rombel, generate kartu akses, serta impor batch Excel/CSV atomik.
4. `teacher.service.ts`: CRUD guru, penugasan NUPTK/NIP, dan riwayat pengajaran.
5. `proctor.service.ts`: Registrasi pengawas dan pelacakan jadwal ruang ujian.
6. `class.service.ts`: Pengelolaan rombel, penugasan wali kelas, dan pemindahan siswa antar kelas.
7. `subject.service.ts`: Manajemen mata pelajaran, jenjang kelas, dan kategori kurikulum.
8. `academic-year.service.ts`: Pengelolaan tahun ajaran dan semester aktif tunggal.
9. `school-question.service.ts`: Bank soal sekolah, revision tracking, jenis soal, dan moderasi.
10. `school-exam.service.ts`: Penjadwalan ujian, alokasi peserta, dan penguncian snapshot soal (Snapshot Immutability).
11. `exam-participant.service.ts`: Pendaftaran peserta rombel, reset login, dan generate token individual.
12. `exam-room.service.ts`: Alokasi kapasitas ruang dan penjadwalan pengawas bebas bentrok (Conflict-Free Scheduling).
13. `exam-monitoring.service.ts`: Pemantauan real-time peserta ujian, status koneksi, dan penanganan insiden tanpa kebocoran kunci jawaban.
14. `exam-result.service.ts`: Agregasi skor, distribusi grade, dan penilaian esai manual dengan validasi batas skor.
15. `school-report.service.ts`: 8 tipe laporan agregat dan rekapitulasi sekolah dengan ekspor CSV/JSON.
16. `school-audit.service.ts`: Pencatatan dan pembacaan log audit append-only terisolasi tenant sekolah.
17. `school-settings.service.ts`: Pengaturan kebijakan pelaksanaan ujian sekolah.

---

## 4. API Endpoints (`src/app/api/admin/`)

- `GET/PUT /api/admin/school`: Pengambilan dan pembaruan profil sekolah.
- `GET/POST /api/admin/users`: Pengelolaan akun pengguna sekolah.
- `GET/POST /api/admin/students`: CRUD siswa dan query paginasi.
- `POST /api/admin/students/import`: Impor batch data siswa atomik.
- `GET/POST /api/admin/teachers`: CRUD data guru sekolah.
- `POST /api/admin/teachers/import`: Impor batch data guru atomik.
- `GET/POST /api/admin/proctors`: CRUD pengawas ruang ujian.
- `GET/POST /api/admin/classes`: CRUD rombel dan penugasan wali kelas.
- `POST /api/admin/classes/assign-students`: Penetapan siswa ke dalam rombel.
- `GET/POST /api/admin/subjects`: Pengelolaan mata pelajaran sekolah.
- `GET/POST /api/admin/teacher-assignments`: Penugasan guru ke mata pelajaran dan rombel.
- `GET/POST /api/admin/academic-years`: Pengelolaan siklus tahun ajaran dan semester.
- `GET/POST /api/admin/question-bank`: Repositori bank soal, revision tracking, dan peninjauan moderasi.
- `GET/POST /api/admin/exams`: Pembuatan, pembaruan, dan pengaturan ujian.
- `GET/POST /api/admin/exams/[id]/participants`: Pendaftaran peserta ujian dan token individual.
- `POST /api/admin/exams/[id]/snapshot`: Penguncian paket soal ujian ke dalam snapshot permanen.
- `GET/POST /api/admin/exam-rooms`: Pengelolaan ruang ujian dan kapasitas.
- `GET/POST /api/admin/exam-proctors`: Penugasan pengawas dengan deteksi bentrok jadwal.
- `GET/POST /api/admin/monitoring`: Live monitoring dan kendali pengawas (tambah waktu, paksa submit, buka kunci).
- `GET /api/admin/results`: Hasil ujian dan statistik rekapitulasi nilai.
- `POST /api/admin/results/manual-score`: Penilaian manual esai dengan validasi batas skor dan audit log.
- `GET /api/admin/reports`: 8 format laporan terpadu dan stream ekspor CSV.
- `GET /api/admin/audit`: Pengambilan log aktivitas append-only khusus tenant sekolah.
- `GET/PUT /api/admin/settings`: Pengaturan konfigurasi operasional dan kebijakan ujian sekolah.

---

## 5. Halaman Antarmuka Pengguna (`src/app/admin/`)

- `src/components/admin/AdminSidebar.tsx`: Diperbarui dengan 17 menu navigasi terstruktur.
- `src/app/admin/school/page.tsx`: Profil & Legalitas Sekolah.
- `src/app/admin/users/page.tsx`: Manajemen Pengguna Sekolah.
- `src/app/admin/students/page.tsx`: Data Siswa & Rombel.
- `src/app/admin/teachers/page.tsx`: Data Guru & Penugasan.
- `src/app/admin/proctors/page.tsx`: Data Pengawas Ruang.
- `src/app/admin/classes/page.tsx`: Rombel & Kelas.
- `src/app/admin/subjects/page.tsx`: Mata Pelajaran.
- `src/app/admin/academic-years/page.tsx`: Tahun Ajaran & Semester Aktif Tunggal.
- `src/app/admin/question-bank/page.tsx`: Bank Soal, Versi Soal, & Moderasi.
- `src/app/admin/exams/page.tsx`: Manajemen Ujian & Token.
- `src/app/admin/exam-rooms/page.tsx`: Ruang & Sesi Ujian.
- `src/app/admin/monitoring/page.tsx`: Live Exam Monitoring & Proctor Control.
- `src/app/admin/results/page.tsx`: Rekapitulasi Nilai & Scoring Esai.
- `src/app/admin/reports/page.tsx`: 8 Modul Laporan & Ekspor CSV.
- `src/app/admin/audit/page.tsx`: Log Audit Append-Only.
- `src/app/admin/settings/page.tsx`: Pengaturan Kebijakan Sekolah.

---

## 6. Verifikasi & Pengujian Otomatis

- Berkas pengujian: `scripts/tests/test-school-admin-sprint02.mjs`
- Hasil pengujian: **23/23 PASSED** (0 gagal) pada live PostgreSQL database.
