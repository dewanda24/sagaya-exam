import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { SchoolReportService } from '@/lib/services/school-report.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('reports.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'STUDENTS';
    const examId = searchParams.get('examId') || undefined;
    const format = searchParams.get('format') || 'JSON'; // JSON or CSV

    let reportData: any[] = [];
    let filename = `laporan_${type.toLowerCase()}_${new Date().toISOString().slice(0, 10)}`;

    switch (type) {
      case 'STUDENTS':
        reportData = await SchoolReportService.getStudentsReport(schoolId);
        break;
      case 'TEACHERS':
        reportData = await SchoolReportService.getTeachersReport(schoolId);
        break;
      case 'PROCTORS':
        reportData = await SchoolReportService.getProctorsReport(schoolId);
        break;
      case 'EXAMS':
        reportData = await SchoolReportService.getExamsReport(schoolId);
        break;
      case 'SCORES':
        reportData = await SchoolReportService.getScoresReport(schoolId, examId);
        break;
      case 'ATTENDANCE':
        reportData = await SchoolReportService.getAttendanceReport(schoolId, examId);
        break;
      case 'VIOLATIONS':
        reportData = await SchoolReportService.getViolationsReport(schoolId, examId);
        break;
      case 'ACTIVITY':
        reportData = await SchoolReportService.getAdminActivityReport(schoolId);
        break;
      default:
        return NextResponse.json({ success: false, error: 'Tipe laporan tidak valid.' }, { status: 400 });
    }

    if (format === 'CSV') {
      if (reportData.length === 0) {
        return new Response('No data', {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}.csv"`,
          },
        });
      }

      const headers = Object.keys(reportData[0]);
      const csvRows = [headers.join(',')];

      for (const row of reportData) {
        const values = headers.map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '""';
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      }

      return new Response(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        type,
        total: reportData.length,
        rows: reportData,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menghasilkan laporan.' }, { status: 500 });
  }
}
