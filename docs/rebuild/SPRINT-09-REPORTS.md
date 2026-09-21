# SPRINT 09 — REPORTS & HISTORICAL SNAPSHOTS SPECIFICATION

## 1. Konsep Report Snapshot

Dokumen laporan resmi asesmen akademik (seperti Rekap Nilai Akhir Semester, Berita Acara Kelulusan, dan Analisis Butir Soal Ujian Sekolah) memerlukan jaminan reproduktifitas data yang bersifat permanen (*audit reproducibility*).

Jika suatu laporan resmi telah diterbitkan dan ditandatangani, laporan tersebut **tidak boleh berubah** meskipun data mentah di database mengalami pembaruan, siswa dimutasi, atau konfigurasi sistem berubah di masa depan.

Untuk itu, Sprint 09 menghadirkan entitas `report_snapshots`:
```sql
CREATE TABLE report_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL,
    scope VARCHAR(50) NOT NULL DEFAULT 'SCHOOL',
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    scoring_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    storage_reference TEXT,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 2. Alur Pembekuan Laporan Resmi

```text
Admin / Guru Meminta Laporan Ujian
             ↓
Otorisasi Scope & Tenant
             ↓
Agregasi Data Terverifikasi (exam_results)
             ↓
Review Pra-Publikasi
             ↓
Klik "Bekukan Snapshot"
             ↓
ReportSnapshotService.createSnapshot()
             ↓
Simpan Immutable JSON Payload ke report_snapshots
             ↓
Audit Log: REPORT_SNAPSHOT_CREATED
             ↓
Dokumen Resmi Tersimpan Permanen
```

---

## 3. Tipe Laporan yang Didukung

| Tipe Laporan | Cakupan | Deskripsi Data |
| :--- | :--- | :--- |
| `EXAM_SUMMARY` | Ujian | Ringkasan partisipasi, kelulusan KKM, mean, median, min, max, std dev. |
| `CLASS_PERFORMANCE` | Kelas | Rata-rata capaian kompetensi per rombel belajar. |
| `SUBJECT_ANALYSIS` | Mapel | Tren performa siswa pada mata pelajaran tertentu sepanjang semester. |
| `ITEM_ANALYSIS` | Butir Soal | Reliabilitas butir soal, daya pembeda, tingkat kesukaran, dan distraktor. |
| `ATTENDANCE_SUMMARY` | Sekolah / Sesi | Rekapitulasi kehadiran peserta (Hadir, Izin, Terlambat, Alpa). |
| `VIOLATION_SUMMARY` | Keamanan | Rekapitulasi anomali integritas (pindah tab, keluar fullscreen, diskoneksi). |
| `SCHOOL_RECAP` | Sekolah | Rekap eksekutif performa sekolah untuk laporan dinas pendidikan. |

---

## 4. Keamanan & Aksesibilitas Snapshot

- **Tenant Isolation**: Snapshot hanya dapat dibaca oleh pengguna yang berada pada sekolah yang sama (`school_id`).
- **Auditability**: Setiap snapshot mencatat identitas pembuat (`generated_by`), waktu pembuatan (`generated_at`), dan versi kalkulasi nilai (`scoring_version`).
- **Zero-Modification**: Snapshot berstatus `PUBLISHED` tidak dapat dimanipulasi melalui endpoint API standar.
