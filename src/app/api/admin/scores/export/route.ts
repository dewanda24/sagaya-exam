import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken } from '@/lib/core/auth';
import * as XLSX from 'xlsx';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let examId = searchParams.get('examId');

    if (!examId) {
      const activeExam = await queryPostgres(
        `SELECT id, title, school_id FROM exams ${user.role !== 'SUPER_ADMIN' ? 'WHERE school_id = $1' : ''} ORDER BY created_at DESC LIMIT 1;`,
        user.role !== 'SUPER_ADMIN' ? [user.schoolId] : []
      );
      if (activeExam.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan.' }, { status: 404 });
      }
      examId = activeExam.rows[0].id;
    }

    const examRes = await queryPostgres(
      `SELECT e.*, s.name as subject_name FROM exams e JOIN subjects s ON e.subject_id = s.id WHERE e.id = $1;`,
      [examId]
    );
    const exam = examRes.rows[0];

    if (!exam) {
      return NextResponse.json({ success: false, error: 'Data ujian tidak ditemukan.' }, { status: 404 });
    }

    if (user.role !== 'SUPER_ADMIN' && exam.school_id !== user.schoolId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Anda tidak memiliki akses ke nilai ujian sekolah lain.' },
        { status: 403 }
      );
    }

    const participantsRes = await queryPostgres(
      `SELECT ep.*, s.full_name, s.nisn, s.nis, c.name as class_name,
              es.status as session_status, es.server_started_at, es.submitted_at,
              es.tab_violation_count
       FROM exam_participants ep
       JOIN students s ON ep.student_id = s.id
       LEFT JOIN class_rooms c ON s.class_room_id = c.id
       LEFT JOIN exam_sessions es ON ep.id = es.participant_id
       WHERE ep.exam_id = $1
       ORDER BY c.name ASC, s.full_name ASC;`,
      [examId]
    );

    const format = (searchParams.get('format') || 'standard').toLowerCase();
    const passingGrade = exam.passing_grade ? parseFloat(exam.passing_grade) : 75;

    let rows: any[] = [];
    let sheetName = 'Rekap Nilai';
    let colWidths: { wch: number }[] = [];

    if (format === 'erapor') {
      sheetName = 'Nilai_eRapor';
      rows = participantsRes.rows.map((r: any, idx: number) => {
        const score = r.final_score !== null ? parseFloat(r.final_score) : null;
        let predikat = 'D';
        let capaian = 'Perlu bimbingan dan pendampingan remedial intensif.';
        if (score !== null) {
          if (score >= 90) {
            predikat = 'A';
            capaian = 'Menunjukkan penguasaan capaian pembelajaran yang sangat istimewa.';
          } else if (score >= 80) {
            predikat = 'B';
            capaian = 'Menunjukkan penguasaan capaian pembelajaran yang baik.';
          } else if (score >= passingGrade) {
            predikat = 'C';
            capaian = 'Menunjukkan penguasaan capaian pembelajaran yang cukup.';
          }
        }

        return {
          No: idx + 1,
          NISN: r.nisn || '-',
          NIS: r.nis || '-',
          'Nama Peserta Didik': r.full_name,
          Rombel: r.class_name || 'Umum',
          'Mata Pelajaran': exam.subject_name,
          'Nilai Asesmen': score !== null ? score : 'Belum Ada',
          'KKM / KKTP': passingGrade,
          Predikat: score !== null ? predikat : '-',
          'Status Ketuntasan': score !== null ? (score >= passingGrade ? 'Tercapai' : 'Perlu Remedial') : 'Belum Selesai',
          'Deskripsi Capaian Kompetensi': score !== null ? capaian : 'Belum menyelesaikan ujian asesmen.',
        };
      });

      colWidths = [
        { wch: 6 },
        { wch: 16 },
        { wch: 14 },
        { wch: 30 },
        { wch: 14 },
        { wch: 22 },
        { wch: 14 },
        { wch: 12 },
        { wch: 10 },
        { wch: 18 },
        { wch: 45 },
      ];
    } else if (format === 'rdm') {
      sheetName = 'Nilai_RDM_Kemenag';
      rows = participantsRes.rows.map((r: any, idx: number) => {
        const score = r.final_score !== null ? parseFloat(r.final_score) : null;
        let predikat = 'D';
        if (score !== null) {
          if (score >= 90) predikat = 'A';
          else if (score >= 80) predikat = 'B';
          else if (score >= passingGrade) predikat = 'C';
        }

        return {
          No: idx + 1,
          NISN: r.nisn || '-',
          'Nama Siswa': r.full_name,
          Kelas: r.class_name || '-',
          'Mata Pelajaran': exam.subject_name,
          'Nilai Ujian': score !== null ? score : 0,
          KKM: passingGrade,
          Predikat: score !== null ? predikat : '-',
          Status: score !== null ? (score >= passingGrade ? 'TUNTAS' : 'REMEDIAL') : 'TIDAK HADIR',
        };
      });

      colWidths = [
        { wch: 6 },
        { wch: 16 },
        { wch: 30 },
        { wch: 14 },
        { wch: 22 },
        { wch: 14 },
        { wch: 10 },
        { wch: 10 },
        { wch: 14 },
      ];
    } else {
      // Standard CBT format
      sheetName = 'Rekap_CBT';
      rows = participantsRes.rows.map((r: any, idx: number) => ({
        No: idx + 1,
        'Nama Siswa': r.full_name,
        NISN: r.nisn,
        NIS: r.nis,
        Kelas: r.class_name || '-',
        'Paket Soal': r.assigned_package,
        'Token Ujian': r.token,
        'Status Ujian':
          r.session_status === 'SUBMITTED'
            ? 'Selesai (Terkirim)'
            : r.session_status === 'IN_PROGRESS'
            ? 'Sedang Mengerjakan'
            : 'Belum Mulai',
        'Nilai Akhir (0-100)': r.final_score !== null ? parseFloat(r.final_score) : 'Belum Ada',
        KKM: passingGrade,
        'Ketuntasan KKM':
          r.final_score !== null
            ? parseFloat(r.final_score) >= passingGrade
              ? 'TUNTAS'
              : 'REMEDIAL'
            : 'BELUM SELESAI',
        'Status Koreksi': r.graded_status === 'GRADED' ? 'Tuntas' : 'Perlu Koreksi Essay',
        'Pelanggaran Tab': r.tab_violation_count || 0,
        'Waktu Mulai': r.server_started_at ? new Date(r.server_started_at).toLocaleString('id-ID') : '-',
        'Waktu Selesai': r.submitted_at ? new Date(r.submitted_at).toLocaleString('id-ID') : '-',
      }));

      colWidths = [
        { wch: 6 },
        { wch: 28 },
        { wch: 16 },
        { wch: 14 },
        { wch: 15 },
        { wch: 12 },
        { wch: 14 },
        { wch: 20 },
        { wch: 18 },
        { wch: 10 },
        { wch: 16 },
        { wch: 18 },
        { wch: 16 },
        { wch: 22 },
        { wch: 22 },
      ];
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    worksheet['!cols'] = colWidths;

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const safeTitle = (exam.title || 'Ujian').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePrefix = format === 'erapor' ? 'eRapor' : format === 'rdm' ? 'RDM_Kemenag' : 'Leger_Nilai';

    return new Response(buffer, {
      headers: {
        'Content-Disposition': `attachment; filename="${filePrefix}_${safeTitle}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengekspor nilai ke Excel.' },
      { status: 500 }
    );
  }
}
