# SPRINT 09 — ANALYTICS ENGINE SPECIFICATION

## 1. Arsitektur Terpusat AnalyticsService

Sistem analitik Sagaya Exam dibangun dengan arsitektur terpusat melalui `AnalyticsService` dan `QuestionAnalyticsService`. Tidak ada perhitungan statistik yang dilakukan secara parsial pada lapisan route atau komponen client.

Setiap pemanggilan layanan analitik mewajibkan injeksi `AnalyticsContext`:
```typescript
export interface AnalyticsContext {
  userId: string;
  role: UserRole;
  schoolId: string | null;
  permissions: string[];
  studentId?: string | null;
}
```

Alur Eksekusi:
```text
Client Request
      ↓
requireApiAuth(allowedRoles)
      ↓
AnalyticsAuthService.assertExamAccess() / assertSchoolScope()
      ↓
AnalyticsCacheService.get(cacheKey)
      ↓
AnalyticsService / QuestionAnalyticsService
      ↓
PostgreSQL Database
      ↓
Aggregated KPIs & Distributions
      ↓
Response
```

---

## 2. Metrik Statistik & Formula Matematika

### A. Metrik Partisipasi & Kehadiran (Attendance Rate)
- **Denominator**: Total peserta terdaftar pada ujian (`registered`).
- **Pembilang**: Peserta dengan sesi yang dimulai atau presensi hadir (`present`).
$$\text{Attendance Rate} = \frac{\text{Present}}{\text{Registered}} \times 100\%$$

### B. Metrik Penyelesaian Sesi (Completion Rate)
- **Denominator**: Total sesi yang berhasil dimulai (`started`).
- **Pembilang**: Sesi yang berstatus `SUBMITTED` (`completed`).
$$\text{Completion Rate} = \frac{\text{Completed}}{\text{Started}} \times 100\%$$

### C. Ringkasan Nilai (Score Summary)
- Menggunakan nilai akhir final dari tabel `exam_results`.
- Hasil berstatus `PENDING`, `PARTIALLY_GRADED`, dan `VOID` **diisolasi dan tidak dihitung** dalam rata-rata nilai terpublikasi sekolah.
- **Mean (Rata-rata)**:
$$\bar{x} = \frac{\sum_{i=1}^N x_i}{N}$$
- **Median**: Nilai tengah data terurut (interpolasi rata-rata dua nilai tengah jika genap).
- **Sample Standard Deviation ($s$)**:
$$s = \sqrt{\frac{\sum_{i=1}^N (x_i - \bar{x})^2}{N - 1}} \quad (\text{untuk } N > 1)$$
- **Kuartil & Persentil**: $P_{25}$, $P_{50}$ (Median), $P_{75}$, $P_{90}$ dengan metode *linear interpolation*.
- **Pass Rate (Tingkat Kelulusan)**:
$$\text{Pass Rate} = \frac{\text{Jumlah Peserta } \ge \text{KKM}}{N} \times 100\%$$

### D. Distribusi Nilai (Score Distribution Buckets)
- Pembagian segmen default per 10 poin: `0-9`, `10-19`, `20-29`, ..., `90-100`.
- Pengelompokan Grade:
  - **Grade A**: $85 \le x \le 100$
  - **Grade B**: $70 \le x < 85$
  - **Grade C**: $55 \le x < 70$
  - **Grade D**: $x < 55$

---

## 3. Analisis Butir Soal (Item Analysis)

Layanan `QuestionAnalyticsService` mengevaluasi reliabilitas butir soal dengan mengacu secara ketat pada konfigurasi snapshot terkunci (`ExamSnapshot` / `exam_snapshot_questions`). Mutasi bank soal di masa mendatang tidak akan mengubah hasil analisis historis.

### A. Indeks Kesukaran (Difficulty Index, $p$-value)
$$p = \frac{\text{Jumlah Peserta Menjawab Benar}}{\text{Total Peserta yang Mengerjakan}}$$

Klasifikasi Pedagogis:
- $p \ge 0.85$: **Sangat Mudah**
- $0.70 \le p < 0.85$: **Mudah**
- $0.30 \le p < 0.70$: **Sedang**
- $0.15 \le p < 0.30$: **Sukar**
- $p < 0.15$: **Sangat Sukar**

### B. Daya Pembeda (Discrimination Index, $d$-value)
Dihitung jika sampel peserta $\ge 10$ orang, membandingkan kelompok atas ($27\%$ nilai tertinggi) dan kelompok bawah ($27\%$ nilai terendah):
$$d = p_{\text{kelompok atas}} - p_{\text{kelompok bawah}}$$

Klasifikasi Daya Pembeda:
- $d \ge 0.40$: Sangat Baik (*Excellent*)
- $0.30 \le d < 0.40$: Baik (*Good*)
- $0.20 \le d < 0.30$: Cukup (*Satisfactory - Perlu Revisi Kecil*)
- $0.00 \le d < 0.20$: Buruk (*Poor - Perlu Revisi Besar*)
- $d < 0.00$: Sangat Buruk / Negatif (*Misleading Item*)

### C. Analisis Pengecoh (Distractor Efficiency)
- Menghitung frekuensi dan persentase pemilih setiap opsi jawaban.
- Pengecoh dinyatakan efektif (*effective distractor*) apabila dipilih oleh minimal $5.0\%$ dari seluruh peserta ujian.

---

## 4. Tenant-Isolated Caching Engine

Melalui `AnalyticsCacheService`:
- Key cache berformat:
```text
analytics:{schoolId}:{reportType}:{filterHash}:{dataVersion}
```
- `filterHash` dihasilkan secara deterministik menggunakan SHA-256 dari parameter filter yang telah diurutkan.
- Data sekolah A dan sekolah B tersimpan dalam namespace terpisah sehingga tidak ada risiko kebocoran data antar tenant (*tenant cache leakage*).
