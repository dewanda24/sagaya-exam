import * as XLSX from 'xlsx';
import { queryPostgres } from '../core/postgres';
import { AnalyticsContext, AnalyticsAuthService } from '../core/analytics-auth';
import { PdfGeneratorService, PdfTableColumn } from './pdf-generator.service';
import { AnalyticsService } from './analytics.service';
import { logAuditEvent } from './audit.service';

export class ExportService {
  /**
   * Sanitasi string untuk proteksi CSV / Spreadsheet Formula Injection (CSV Injection / DDE).
   * Nilai yang diawali =, +, -, @, \t, \r diprefix dengan single quote (')
   */
  static sanitizeForSpreadsheet(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Menghasilkan nama file yang aman tanpa karakter sensitif
   */
  static generateSafeFilename(reportType: string, identifier: string, ext: 'csv' | 'xlsx' | 'pdf'): string {
    const cleanType = reportType.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const cleanId = identifier.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
    const dateStr = new Date().toISOString().slice(0, 10);
    return `sagaya-report-${cleanType}-${cleanId}-${dateStr}.${ext}`;
  }

  /**
   * Generator format CSV dengan formula injection protection
   */
  static generateCsvBuffer(headers: string[], rows: Array<Record<string, any>>): Buffer {
    const sanitizedHeaders = headers.map((h) => `"${this.sanitizeForSpreadsheet(h).replace(/"/g, '""')}"`);
    const csvLines = [sanitizedHeaders.join(',')];

    for (const row of rows) {
      const lineVals = headers.map((h) => {
        const rawVal = row[h];
        const sanitized = this.sanitizeForSpreadsheet(rawVal);
        return `"${sanitized.replace(/"/g, '""')}"`;
      });
      csvLines.push(lineVals.join(','));
    }

    return Buffer.from(csvLines.join('\n'), 'utf8');
  }

  /**
   * Generator format XLSX dengan formula injection protection
   */
  static generateXlsxBuffer(sheetName: string, headers: string[], rows: Array<Record<string, any>>): Buffer {
    const sanitizedRows = rows.map((row) => {
      const sanitizedObj: Record<string, any> = {};
      for (const h of headers) {
        const rawVal = row[h];
        if (typeof rawVal === 'number' || typeof rawVal === 'boolean') {
          sanitizedObj[h] = rawVal;
        } else {
          sanitizedObj[h] = this.sanitizeForSpreadsheet(rawVal);
        }
      }
      return sanitizedObj;
    });

    const worksheet = XLSX.utils.json_to_sheet(sanitizedRows, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Ekspor Hasil Ujian (Synchronous / Direct Export)
   */
  static async exportExamResults(
    context: AnalyticsContext,
    examId: string,
    format: 'csv' | 'xlsx' | 'pdf' = 'xlsx',
    filters?: { classId?: string }
  ) {
    const { schoolId } = await AnalyticsAuthService.assertExamAccess(context, examId);

    // Ambil detail ujian
    const examRes = await queryPostgres(
      `SELECT e.id, e.title, e.passing_grade, s.name as subject_name, sch.name as school_name, sch.address as school_address
       FROM exams e
       JOIN subjects s ON e.subject_id = s.id
       JOIN schools sch ON e.school_id = sch.id
       WHERE e.id = $1 AND e.school_id = $2;`,
      [examId, schoolId]
    );

    if (examRes.rows.length === 0) {
      throw new Error('Ujian tidak ditemukan.');
    }
    const exam = examRes.rows[0];
    const passingGrade = parseFloat(exam.passing_grade || '75');

    // Ambil data siswa dan hasil
    let sql = `
      SELECT ep.id as participant_id,
             s.nis, s.nisn, s.full_name as student_name, c.name as class_name,
             es.status as session_status, es.tab_violation_count,
             er.final_score, er.percentage, er.status as result_status
      FROM exam_participants ep
      JOIN students s ON ep.student_id = s.id
      LEFT JOIN class_rooms c ON s.class_room_id = c.id
      LEFT JOIN exam_sessions es ON ep.id = es.participant_id
      LEFT JOIN exam_results er ON es.id = er.session_id
      WHERE ep.exam_id = $1 AND ep.school_id = $2
    `;
    const params: any[] = [examId, schoolId];

    if (filters?.classId) {
      params.push(filters.classId);
      sql += ` AND s.class_room_id = $${params.length}`;
    }

    sql += ` ORDER BY er.final_score DESC NULLS LAST, s.full_name ASC;`;

    const res = await queryPostgres(sql, params);
    const rawRows = res.rows;

    const headers = ['No', 'NIS', 'NISN', 'Nama Siswa', 'Kelas', 'Nilai Akhir', 'Persentase', 'Status Nilai', 'Keterangan'];
    const exportRows = rawRows.map((r, idx) => {
      const finalScore = r.final_score !== null && r.final_score !== undefined ? parseFloat(r.final_score) : null;
      const isPassed = finalScore !== null ? finalScore >= passingGrade : null;
      return {
        No: idx + 1,
        NIS: r.nis || '-',
        NISN: r.nisn || '-',
        'Nama Siswa': r.student_name,
        Kelas: r.class_name || '-',
        'Nilai Akhir': finalScore !== null ? finalScore : 'Belum Ada',
        Persentase: r.percentage !== null && r.percentage !== undefined ? `${r.percentage}%` : '-',
        'Status Nilai': r.result_status || 'PENDING',
        Keterangan: isPassed === true ? 'LULUS' : isPassed === false ? 'TIDAK LULUS' : '-',
      };
    });

    const safeFilename = this.generateSafeFilename('hasil_ujian', exam.title, format);

    // Audit log ekspor
    await logAuditEvent({
      schoolId,
      userId: context.userId,
      action: 'REPORT_EXPORTED',
      role: context.role,
      resourceType: 'EXAM_RESULT_EXPORT',
      resourceId: examId,
      details: { format, rowCount: exportRows.length },
    }).catch(() => {});

    if (format === 'csv') {
      return {
        buffer: this.generateCsvBuffer(headers, exportRows),
        filename: safeFilename,
        contentType: 'text/csv; charset=utf-8',
      };
    } else if (format === 'xlsx') {
      return {
        buffer: this.generateXlsxBuffer('Hasil Ujian', headers, exportRows),
        filename: safeFilename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    } else {
      // PDF format
      const validScores = rawRows
        .filter((r) => r.final_score !== null && r.final_score !== undefined)
        .map((r) => parseFloat(r.final_score));
      const stats = AnalyticsService.computeScoreStats(validScores, passingGrade);

      const columns: PdfTableColumn[] = [
        { header: 'No', key: 'No', width: 25, align: 'center' },
        { header: 'NISN', key: 'NISN', width: 70, align: 'center' },
        { header: 'Nama Siswa', key: 'Nama Siswa', width: 170, align: 'left' },
        { header: 'Kelas', key: 'Kelas', width: 70, align: 'center' },
        { header: 'Nilai', key: 'Nilai Akhir', width: 50, align: 'right' },
        { header: '%', key: 'Persentase', width: 45, align: 'right' },
        { header: 'Ket', key: 'Keterangan', width: 85, align: 'center' },
      ];

      const pdfBuffer = PdfGeneratorService.generateReportPdf({
        schoolName: exam.school_name || 'SAGAYA EDUCATION SYSTEM',
        schoolAddress: exam.school_address || 'Pusat Evaluasi & Asesmen Terstandar',
        reportTitle: `REKAPITULASI HASIL UJIAN: ${exam.title.toUpperCase()}`,
        subTitle: `Mata Pelajaran: ${exam.subject_name} | Standar Kelulusan (KKM): ${passingGrade}`,
        metadata: [
          { label: 'Total Peserta Terdaftar', value: `${rawRows.length} Siswa` },
          { label: 'Peserta Dinilai', value: `${validScores.length} Siswa` },
          { label: 'Tingkat Kelulusan', value: `${stats.passRatePercentage}%` },
          { label: 'Tanggal Cetak', value: new Date().toLocaleDateString('id-ID') },
        ],
        kpiCards: [
          { label: 'Rata-rata Nilai', value: `${stats.mean}` },
          { label: 'Nilai Tertinggi', value: `${stats.max}` },
          { label: 'Nilai Terendah', value: `${stats.min}` },
          { label: 'Siswa Lulus', value: `${stats.passedCount} / ${validScores.length}` },
        ],
        columns,
        rows: exportRows,
      });

      return {
        buffer: pdfBuffer,
        filename: safeFilename,
        contentType: 'application/pdf',
      };
    }
  }

  /**
   * Buat Antrian Ekspor Asinkron (Async Export Job) untuk dataset besar
   */
  static async createExportJob(
    context: AnalyticsContext,
    reportType: string,
    format: 'CSV' | 'XLSX' | 'PDF',
    filters: Record<string, any> = {}
  ) {
    if (!context.schoolId) {
      throw new Error('Konteks sekolah tidak valid.');
    }

    const res = await queryPostgres(
      `INSERT INTO export_jobs (
         school_id, requested_by, report_type, format, filters, status
       ) VALUES ($1, $2, $3, $4, $5, 'QUEUED')
       RETURNING *;`,
      [context.schoolId, context.userId, reportType, format, JSON.stringify(filters)]
    );

    const job = res.rows[0];

    await logAuditEvent({
      schoolId: context.schoolId,
      userId: context.userId,
      action: 'EXPORT_CREATED',
      role: context.role,
      resourceType: 'EXPORT_JOB',
      resourceId: job.id,
      details: { reportType, format },
    }).catch(() => {});

    return job;
  }

  /**
   * Memproses antrian Export Job
   */
  static async processExportJob(jobId: string) {
    const jobRes = await queryPostgres(`SELECT * FROM export_jobs WHERE id = $1 LIMIT 1;`, [jobId]);
    if (jobRes.rows.length === 0) return;
    const job = jobRes.rows[0];

    await queryPostgres(`UPDATE export_jobs SET status = 'PROCESSING' WHERE id = $1;`, [jobId]);

    try {
      const context: AnalyticsContext = {
        userId: job.requested_by,
        role: 'ADMIN',
        schoolId: job.school_id,
        permissions: ['analytics.export'],
      };

      let resultBuffer: Buffer;
      let filename: string;

      if (job.reportType === 'EXAM_RESULTS' && job.filters.examId) {
        const exp = await this.exportExamResults(context, job.filters.examId, job.format.toLowerCase() as any, job.filters);
        resultBuffer = exp.buffer;
        filename = exp.filename;
      } else {
        // Generic fallback export
        const headers = ['Status', 'Info'];
        const rows = [{ Status: 'OK', Info: 'Sagaya Exam Report Complete' }];
        resultBuffer = this.generateCsvBuffer(headers, rows);
        filename = `sagaya-export-${jobId.slice(0, 8)}.csv`;
      }

      const base64Content = resultBuffer.toString('base64');
      const sizeBytes = resultBuffer.length;

      await queryPostgres(
        `UPDATE export_jobs 
         SET status = 'COMPLETED',
             file_name = $1,
             file_size_bytes = $2,
             file_content_base64 = $3,
             completed_at = NOW()
         WHERE id = $4;`,
        [filename, sizeBytes, base64Content, jobId]
      );

      await logAuditEvent({
        schoolId: job.school_id,
        userId: job.requested_by,
        action: 'EXPORT_COMPLETED',
        role: 'SYSTEM',
        resourceType: 'EXPORT_JOB',
        resourceId: jobId,
        details: { filename, sizeBytes },
      }).catch(() => {});
    } catch (err: any) {
      await queryPostgres(
        `UPDATE export_jobs 
         SET status = 'FAILED',
             error_message = $1,
             completed_at = NOW()
         WHERE id = $2;`,
        [err.message || 'Gagal memproses ekspor.', jobId]
      );

      await logAuditEvent({
        schoolId: job.school_id,
        userId: job.requested_by,
        action: 'EXPORT_FAILED',
        role: 'SYSTEM',
        resourceType: 'EXPORT_JOB',
        resourceId: jobId,
        details: { error: err.message },
      }).catch(() => {});
    }
  }

  /**
   * Mengambil status Export Job
   */
  static async getExportJob(context: AnalyticsContext, jobId: string) {
    const res = await queryPostgres(`SELECT * FROM export_jobs WHERE id = $1 LIMIT 1;`, [jobId]);
    if (res.rows.length === 0) {
      throw new Error('Export job tidak ditemukan.');
    }
    const job = res.rows[0];
    AnalyticsAuthService.assertSchoolScope(context, job.school_id);

    // Non-superadmin hanya boleh mengakses job yang dibuatnya sendiri atau sesama admin di sekolahnya
    if (context.role !== 'SUPER_ADMIN' && context.role !== 'ADMIN' && job.requested_by !== context.userId) {
      throw new Error('Akses ditolak: Anda tidak memiliki akses ke berkas ekspor ini.');
    }

    return job;
  }

  /**
   * Mengunduh file hasil export job dengan verifikasi kedaluwarsa & otorisasi ketat
   */
  static async downloadExportJob(context: AnalyticsContext, jobId: string) {
    const job = await this.getExportJob(context, jobId);

    if (job.status !== 'COMPLETED') {
      throw new Error(`Berkas ekspor belum siap (Status: ${job.status}).`);
    }

    // Periksa kedaluwarsa berkas
    if (job.expires_at && new Date() > new Date(job.expires_at)) {
      await queryPostgres(`UPDATE export_jobs SET status = 'EXPIRED', file_content_base64 = NULL WHERE id = $1;`, [jobId]);
      throw new Error('Berkas ekspor telah kedaluwarsa dan tidak dapat diunduh kembali.');
    }

    if (!job.file_content_base64) {
      throw new Error('Konten berkas ekspor tidak ditemukan.');
    }

    const buffer = Buffer.from(job.file_content_base64, 'base64');
    let contentType = 'application/octet-stream';
    if (job.format === 'CSV') contentType = 'text/csv; charset=utf-8';
    else if (job.format === 'XLSX') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (job.format === 'PDF') contentType = 'application/pdf';

    return {
      buffer,
      filename: job.file_name || `export-${jobId}.${job.format.toLowerCase()}`,
      contentType,
    };
  }
}
