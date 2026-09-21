import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken } from '@/lib/core/auth';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Khusus Super Admin' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level') || 'ALL';
    const rayon = searchParams.get('rayon') || 'ALL';
    const examId = searchParams.get('examId') || 'ALL';

    let query = `
      SELECT 
        sch.code as school_code,
        sch.name as school_name,
        sch.level as school_level,
        sch.rayon as school_rayon,
        e.title as exam_title,
        COALESCE(sub.name, 'Umum') as subject_name,
        s.name as student_name,
        s.nisn,
        COALESCE(c.name, '-') as class_name,
        ep.final_score,
        ep.graded_status,
        es.submitted_at
      FROM exam_participants ep
      JOIN exams e ON ep.exam_id = e.id
      JOIN students s ON ep.student_id = s.id
      JOIN schools sch ON s.school_id = sch.id
      LEFT JOIN subjects sub ON e.subject_id = sub.id
      LEFT JOIN class_rooms c ON s.class_room_id = c.id
      LEFT JOIN exam_sessions es ON ep.id = es.participant_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (level !== 'ALL') {
      params.push(level);
      query += ` AND sch.level = $${params.length}`;
    }

    if (rayon !== 'ALL') {
      params.push(rayon);
      query += ` AND sch.rayon = $${params.length}`;
    }

    if (examId !== 'ALL') {
      params.push(examId);
      query += ` AND e.id = $${params.length}`;
    }

    query += ` ORDER BY sch.name ASC, e.title ASC, s.name ASC LIMIT 25000;`;

    const res = await queryPostgres(query, params);

    // Build CSV content
    const header = 'NO,KODE_SEKOLAH,NAMA_SEKOLAH,JENJANG,RAYON,JUDUL_UJIAN,MATA_PELAJARAN,NAMA_SISWA,NISN,KELAS,NILAI_AKHIR,KKM_STANDAR,STATUS_KELULUSAN,WAKTU_SUBMIT\n';
    
    const rows = res.rows.map((r: any, idx: number) => {
      const scoreNum = r.final_score !== null ? parseFloat(r.final_score) : 0;
      const isGraded = r.graded_status === 'GRADED' || r.final_score !== null;
      const scoreDisplay = isGraded ? scoreNum.toFixed(1) : 'BELUM_SELESAI';
      const kkm = 75.0;
      const statusLulus = isGraded ? (scoreNum >= kkm ? 'TUNTAS' : 'BELUM_TUNTAS') : 'PROSES';
      const submitTime = r.submitted_at ? new Date(r.submitted_at).toISOString().replace('T', ' ').substring(0, 19) : '-';

      const escapeCol = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

      return [
        idx + 1,
        escapeCol(r.school_code),
        escapeCol(r.school_name),
        escapeCol(r.school_level),
        escapeCol(r.school_rayon),
        escapeCol(r.exam_title),
        escapeCol(r.subject_name),
        escapeCol(r.student_name),
        escapeCol(r.nisn),
        escapeCol(r.class_name),
        scoreDisplay,
        kkm.toFixed(1),
        statusLulus,
        submitTime,
      ].join(',');
    });

    const csvOutput = '\uFEFF' + header + rows.join('\n');
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);

    return new NextResponse(csvOutput, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="master_rekap_nilai_wilayah_${timestampStr}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghasilkan rekap nilai master.' },
      { status: 500 }
    );
  }
}
