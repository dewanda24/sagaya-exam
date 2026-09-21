# SAGAYA EXAM — UI-08 CHANGES LOG

## 1. Scope Sprint
Implementasi antarmuka ujian siswa (*Student Exam Interface*) end-to-end dengan penegakan prinsip **Zero Client Authority**, perlindungan anti-IDOR ketat, peniadaan kebocoran kunci jawaban (*Zero Answer-Key Leakage*), resiliensi jaringan lab, dan pemenuhan standar visual CBT Design System UI-01.

---

## 2. File Perubahan (*Files Changed*)

### Backend API & Security Layer
1. **[`src/app/api/student/session/[sessionId]/route.ts`](file:///d:/1.3.Tugas%20Negara%20%28Program%29/sagaya_exam/src/app/api/student/session/%5BsessionId%5D/route.ts)**:
   - Menghapus kunci jawaban (`answerKey`) dan penjelasan (`explanation`) dari seluruh objek snapshot soal yang dikirimkan ke peramban siswa.
   - Mengabstraksi pasangan soal menjodohkan (`MENJODOHKAN` / `MATCHING`) ke dalam struktur `matchingItems` yang aman (premis kiri dan target kanan acak) tanpa mengekspos pemetaan jawaban yang benar.
   - Menghapus atribut token mentah siswa (`participant.token`) dari respons payload.
   - Menyertakan konfigurasi `navigationPolicy` ke payload ujian siswa.
2. **[`src/app/api/student/session/[sessionId]/result/route.ts`](file:///d:/1.3.Tugas%20Negara%20%28Program%29/sagaya_exam/src/app/api/student/session/%5BsessionId%5D/result/route.ts)** [NEW]:
   - Endpoint terverifikasi IDOR untuk menyajikan hasil ujian siswa berbasis `sessionId`.
   - Mengakomodasi kebijakan visibilitas nilai (`IMMEDIATELY` vs `AFTER_ALL_DONE`).
   - Menyajikan rekapitulasi poin soal tersanitasi mutlak tanpa kebocoran kunci jawaban atau catatan rahasia guru.

### Frontend Student Interface
3. **[`src/app/ujian/[sessionId]/page.tsx`](file:///d:/1.3.Tugas%20Negara%20%28Program%29/sagaya_exam/src/app/ujian/%5BsessionId%5D/page.tsx)**:
   - Pembaruan renderer soal untuk 6 tipe:
     - Pilihan Ganda (Single Choice)
     - Pilihan Ganda Kompleks (Multiple Response)
     - Benar / Salah (True / False)
     - Menjodohkan (Matching Pairs menggunakan `matchingItems` aman)
     - Isian Singkat (Short Answer)
     - Uraian (Essay dengan live counter kata dan karakter)
   - Penegakan kebijakan navigasi linear (`LINEAR_NAVIGATION` / `STRICT_LINEAR`) pada palet nomor soal dan tombol navigasi.
   - Integrasi modal konfirmasi submit dengan checkbox persetujuan wajib untuk mencegah submit tidak sengaja.
   - Penambahan pencegahan penutupan jendela ujian tanpa sengaja (`beforeunload` listener).
4. **[`src/app/ujian/[sessionId]/selesai/page.tsx`](file:///d:/1.3.Tugas%20Negara%20%28Program%29/sagaya_exam/src/app/ujian/%5BsessionId%5D/selesai/page.tsx)**:
   - Rebuild total dengan Design System UI-01, tata letak fokus tanpa navbar luar.
   - Penghapusan token ujian dari bukti cetak pengerjaan.
   - Pengecekan status ketersediaan hasil ujian secara dinamis dan tombol CTA *"Lihat Hasil Ujian"*.
5. **[`src/app/ujian/[sessionId]/result/page.tsx`](file:///d:/1.3.Tugas%20Negara%20%28Program%29/sagaya_exam/src/app/ujian/%5BsessionId%5D/result/page.tsx)** [NEW]:
   - Halaman hasil ujian resmi siswa dengan kartu perolehan skor, status KKM (Tuntas / Belum Tuntas), dan rincian evaluasi butir soal.
6. **Route Aliases**:
   - `src/app/ujian/session/[sessionId]/page.tsx` [NEW]
   - `src/app/ujian/session/[sessionId]/complete/page.tsx` [NEW]
   - `src/app/ujian/session/[sessionId]/result/page.tsx` [NEW]

### Testing & Verification
7. **[`scripts/tests/test-student-exam-ui08.mjs`](file:///d:/1.3.Tugas%20Negara%20%28Program%29/sagaya_exam/scripts/tests/test-student-exam-ui08.mjs)** [NEW]:
   - Test suite komprehensif menguji:
     - Zero Answer-Key Leakage pada 6 tipe soal
     - Peniadaan token siswa pada payload sesi
     - Perlindungan Anti-IDOR antar siswa
     - Sinkronisasi Autosave dan status Ragu-ragu (Doubtful)
     - Sinkronisasi Heartbeat dan Timer server
     - Idempotensi Submission dan mitigasi klik ganda
     - Kebijakan publikasi hasil ujian
   - Hasil: **32/32 tests PASSED**.
