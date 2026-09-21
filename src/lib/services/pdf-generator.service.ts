/**
 * Pure TypeScript Zero-Dependency PDF-1.4 Document Generator.
 * Menghasilkan file PDF valid berstandar ISO 32000-1 tanpa dependensi native atau runtime eksternal.
 */

export interface PdfTableColumn {
  header: string;
  key: string;
  width: number; // point (A4 width = ~595pt, margin = 40pt -> printable = 515pt)
  align?: 'left' | 'center' | 'right';
}

export interface PdfReportOptions {
  schoolName: string;
  schoolAddress?: string;
  reportTitle: string;
  subTitle?: string;
  metadata?: Array<{ label: string; value: string }>;
  kpiCards?: Array<{ label: string; value: string }>;
  columns: PdfTableColumn[];
  rows: Array<Record<string, any>>;
}

export class PdfGeneratorService {
  /**
   * Escape karakter khusus teks PDF: '(', ')', '\\'
   */
  private static escapePdfText(text: string): string {
    if (!text) return '';
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  /**
   * Menghasilkan buffer PDF untuk Laporan Resmi Ujian
   */
  static generateReportPdf(options: PdfReportOptions): Buffer {
    const pageWidth = 595.28; // A4 portrait width in points
    const pageHeight = 841.89; // A4 portrait height in points
    const margin = 40;
    const printableWidth = pageWidth - margin * 2;

    const rowsPerPage = 22;
    const totalRows = options.rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));

    const pagesStreamData: string[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      let stream = '';
      let y = pageHeight - margin;

      // 1. Header Halaman Pertama: Kop Surat & Judul Laporan
      if (pageNum === 1) {
        // Logo / Title Kop
        stream += `BT /F2 16 Tf 0 0 0 rg ${margin} ${y} Td (${this.escapePdfText(options.schoolName)}) Tj ET\n`;
        y -= 18;

        if (options.schoolAddress) {
          stream += `BT /F1 9 Tf 0.3 0.3 0.3 rg ${margin} ${y} Td (${this.escapePdfText(options.schoolAddress)}) Tj ET\n`;
          y -= 14;
        }

        // Garis Pembatas Kop Surat
        stream += `0.2 w 0.2 0.2 0.2 RG ${margin} ${y} m ${margin + printableWidth} ${y} l S\n`;
        y -= 20;

        // Judul Laporan
        stream += `BT /F2 13 Tf 0.08 0.28 0.58 rg ${margin} ${y} Td (${this.escapePdfText(options.reportTitle)}) Tj ET\n`;
        y -= 16;

        if (options.subTitle) {
          stream += `BT /F1 9 Tf 0.4 0.4 0.4 rg ${margin} ${y} Td (${this.escapePdfText(options.subTitle)}) Tj ET\n`;
          y -= 16;
        }

        // Metadata box
        if (options.metadata && options.metadata.length > 0) {
          const metaCols = 2;
          const colW = printableWidth / metaCols;
          let rowY = y;
          options.metadata.forEach((m, idx) => {
            const cIdx = idx % metaCols;
            const xPos = margin + cIdx * colW;
            stream += `BT /F2 8 Tf 0.2 0.2 0.2 rg ${xPos} ${rowY} Td (${this.escapePdfText(m.label)}:) Tj ET\n`;
            stream += `BT /F1 8 Tf 0.1 0.1 0.1 rg ${xPos + 80} ${rowY} Td (${this.escapePdfText(m.value)}) Tj ET\n`;
            if (cIdx === metaCols - 1 || idx === options.metadata!.length - 1) {
              rowY -= 12;
            }
          });
          y = rowY - 8;
        }

        // KPI Summary Cards
        if (options.kpiCards && options.kpiCards.length > 0) {
          const cardCount = options.kpiCards.length;
          const cardW = (printableWidth - (cardCount - 1) * 8) / cardCount;
          const cardH = 34;

          options.kpiCards.forEach((k, idx) => {
            const cardX = margin + idx * (cardW + 8);
            // Background card
            stream += `0.95 0.96 0.98 rg ${cardX} ${y - cardH} ${cardW} ${cardH} re f\n`;
            // Border card
            stream += `0.5 w 0.85 0.87 0.92 RG ${cardX} ${y - cardH} ${cardW} ${cardH} re S\n`;
            // Text KPI
            stream += `BT /F1 7.5 Tf 0.4 0.4 0.4 rg ${cardX + 6} ${y - 12} Td (${this.escapePdfText(k.label)}) Tj ET\n`;
            stream += `BT /F2 11 Tf 0.08 0.28 0.58 rg ${cardX + 6} ${y - 26} Td (${this.escapePdfText(k.value)}) Tj ET\n`;
          });
          y -= cardH + 16;
        }
      } else {
        // Header mini untuk halaman 2+
        stream += `BT /F2 10 Tf 0.2 0.2 0.2 rg ${margin} ${y} Td (${this.escapePdfText(options.reportTitle)} - Lanjutan) Tj ET\n`;
        stream += `BT /F1 8 Tf 0.5 0.5 0.5 rg ${margin + printableWidth - 100} ${y} Td (${this.escapePdfText(options.schoolName)}) Tj ET\n`;
        y -= 14;
        stream += `0.2 w 0.8 0.8 0.8 RG ${margin} ${y} m ${margin + printableWidth} ${y} l S\n`;
        y -= 16;
      }

      // 2. Table Headers
      const tableHeaderHeight = 20;
      // Header background
      stream += `0.1 0.25 0.5 rg ${margin} ${y - tableHeaderHeight} ${printableWidth} ${tableHeaderHeight} re f\n`;

      let curX = margin;
      for (const col of options.columns) {
        stream += `BT /F2 8 Tf 1 1 1 rg ${curX + 4} ${y - 14} Td (${this.escapePdfText(col.header)}) Tj ET\n`;
        curX += col.width;
      }
      y -= tableHeaderHeight;

      // 3. Table Rows
      const startRowIdx = (pageNum - 1) * rowsPerPage;
      const endRowIdx = Math.min(startRowIdx + rowsPerPage, totalRows);
      const pageRows = options.rows.slice(startRowIdx, endRowIdx);
      const rowHeight = 18;

      for (let rIdx = 0; rIdx < pageRows.length; rIdx++) {
        const row = pageRows[rIdx];
        const isEven = rIdx % 2 === 0;

        // Row background
        if (isEven) {
          stream += `0.97 0.98 0.99 rg ${margin} ${y - rowHeight} ${printableWidth} ${rowHeight} re f\n`;
        }
        // Row bottom border
        stream += `0.2 w 0.88 0.88 0.9 RG ${margin} ${y - rowHeight} ${printableWidth} ${rowHeight} re S\n`;

        curX = margin;
        for (const col of options.columns) {
          const rawVal = row[col.key];
          const valStr = rawVal !== null && rawVal !== undefined ? String(rawVal) : '-';
          stream += `BT /F1 7.5 Tf 0.15 0.15 0.15 rg ${curX + 4} ${y - 12} Td (${this.escapePdfText(valStr)}) Tj ET\n`;
          curX += col.width;
        }

        y -= rowHeight;
      }

      // 4. Footer Halaman: Nomor Halaman & Generator Stamp
      const footerY = margin - 15;
      stream += `0.2 w 0.8 0.8 0.8 RG ${margin} ${footerY + 12} m ${margin + printableWidth} ${footerY + 12} l S\n`;
      stream += `BT /F1 7.5 Tf 0.5 0.5 0.5 rg ${margin} ${footerY} Td (Dokumen Resmi Sagaya Exam Engine - Otentik & Terverifikasi) Tj ET\n`;
      const pageText = `Halaman ${pageNum} dari ${totalPages}`;
      stream += `BT /F1 7.5 Tf 0.5 0.5 0.5 rg ${margin + printableWidth - 70} ${footerY} Td (${pageText}) Tj ET\n`;

      pagesStreamData.push(stream);
    }

    // Bangun Objek PDF & Cross-Reference Table
    const objects: string[] = [];
    const offsets: number[] = [];

    // Object 1: Catalog
    objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

    // Object 2: Pages Root
    const kids = Array.from({ length: totalPages }, (_, i) => `${3 + i * 2} 0 R`).join(' ');
    objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${totalPages} >>\nendobj\n`);

    // Fonts (Standard Type 1 fonts: Helvetica & Helvetica-Bold)
    const fontNormalObjNum = 3 + totalPages * 2;
    const fontBoldObjNum = fontNormalObjNum + 1;

    // Tambah Pages & Content Streams
    for (let i = 0; i < totalPages; i++) {
      const pageObjNum = 3 + i * 2;
      const contentObjNum = pageObjNum + 1;
      const content = pagesStreamData[i];
      const contentLen = Buffer.byteLength(content, 'utf8');

      // Page Object
      objects.push(
        `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontNormalObjNum} 0 R /F2 ${fontBoldObjNum} 0 R >> >> >>\nendobj\n`
      );

      // Content Stream Object
      objects.push(
        `${contentObjNum} 0 obj\n<< /Length ${contentLen} >>\nstream\n${content}\nendstream\nendobj\n`
      );
    }

    // Font Normal (F1)
    objects.push(`${fontNormalObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

    // Font Bold (F2)
    objects.push(`${fontBoldObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);

    // Rakit Final PDF File
    let pdfStr = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
    offsets.push(0); // Dummy for 0th entry

    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdfStr, 'utf8'));
      pdfStr += obj;
    }

    const startXref = Buffer.byteLength(pdfStr, 'utf8');
    const totalObjs = objects.length + 1;

    let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
    for (let i = 1; i < totalObjs; i++) {
      const offset = String(offsets[i]).padStart(10, '0');
      xref += `${offset} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
    pdfStr += xref + trailer;

    return Buffer.from(pdfStr, 'utf8');
  }
}
