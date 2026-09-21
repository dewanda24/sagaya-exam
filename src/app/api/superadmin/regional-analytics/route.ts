import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/core/rbac';
import { queryPostgres } from '@/lib/core/postgres';
import { getSystemSetting } from '@/lib/superadmin/system-settings';

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN']);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const subjectFilter = searchParams.get('subjectId');
    const rayonFilter = searchParams.get('rayon');
    const format = searchParams.get('format'); // 'json' | 'csv'

    // 1. Fetch regional scoring policy (KKM default)
    const scoringPolicy = (await getSystemSetting('scoring_policy', {
      kkmDefault: 75.0,
      pgComplexMode: 'PARTIAL_CREDIT',
      showScoreDefault: 'AFTER_ALL_DONE',
      gradingScale: 'SCALE_100',
    })) as any;

    const kkmRegional = parseFloat(scoringPolicy.kkmDefault || 75.0);

    // 2. School Performance vs KKM Benchmark
    let schoolQuery = `
      SELECT 
        sc.id as school_id,
        sc.name as school_name,
        sc.code as school_code,
        sc.rayon,
        sc.level,
        COUNT(ep.id) as total_participants,
        COUNT(CASE WHEN ep.final_score IS NOT NULL THEN ep.id END) as completed_participants,
        ROUND(AVG(ep.final_score), 1) as avg_score,
        ROUND(MAX(ep.final_score), 1) as highest_score,
        ROUND(MIN(ep.final_score), 1) as lowest_score,
        COUNT(CASE WHEN ep.final_score >= $1 THEN ep.id END) as pass_kkm_count
      FROM schools sc
      LEFT JOIN exams e ON sc.id = e.school_id
      LEFT JOIN exam_participants ep ON e.id = ep.exam_id
      WHERE sc.is_active = true
    `;
    const schoolParams: any[] = [kkmRegional];

    if (subjectFilter) {
      schoolParams.push(subjectFilter);
      schoolQuery += ` AND e.subject_id = $${schoolParams.length}`;
    }

    if (rayonFilter) {
      schoolParams.push(rayonFilter);
      schoolQuery += ` AND sc.rayon = $${schoolParams.length}`;
    }

    schoolQuery += `
      GROUP BY sc.id, sc.name, sc.code, sc.rayon, sc.level
      ORDER BY avg_score DESC NULLS LAST, sc.name ASC;
    `;

    const schoolsRes = await queryPostgres(schoolQuery, schoolParams);

    const schoolBenchmarks = schoolsRes.rows.map((r: any) => {
      const completed = parseInt(r.completed_participants || '0', 10);
      const passKkm = parseInt(r.pass_kkm_count || '0', 10);
      const passRate = completed > 0 ? Math.round((passKkm / completed) * 100) : 0;
      const avg = r.avg_score !== null ? parseFloat(r.avg_score) : 0;

      return {
        schoolId: r.school_id,
        schoolName: r.school_name,
        schoolCode: r.school_code,
        rayon: r.rayon || 'Rayon 1 - Pusat',
        level: r.level || 'SMA',
        totalParticipants: parseInt(r.total_participants || '0', 10),
        completedParticipants: completed,
        avgScore: avg,
        highestScore: r.highest_score !== null ? parseFloat(r.highest_score) : 0,
        lowestScore: r.lowest_score !== null ? parseFloat(r.lowest_score) : 0,
        passKkmCount: passKkm,
        passRate,
        kkmStatus: avg >= kkmRegional ? 'MEMENUHI_KKM' : 'DI_BAWAH_KKM',
      };
    });

    // 3. Rayon Disparity Benchmark
    const rayonRes = await queryPostgres(`
      SELECT 
        COALESCE(sc.rayon, 'Rayon 1 - Pusat') as rayon_name,
        COUNT(DISTINCT sc.id) as school_count,
        COUNT(ep.id) as total_participants,
        COUNT(CASE WHEN ep.final_score IS NOT NULL THEN ep.id END) as completed_participants,
        ROUND(AVG(ep.final_score), 1) as avg_score,
        COUNT(CASE WHEN ep.final_score >= $1 THEN ep.id END) as pass_kkm_count
      FROM schools sc
      LEFT JOIN exams e ON sc.id = e.school_id
      LEFT JOIN exam_participants ep ON e.id = ep.exam_id
      WHERE sc.is_active = true
      GROUP BY sc.rayon
      ORDER BY avg_score DESC NULLS LAST;
    `, [kkmRegional]);

    const rayonBenchmarks = rayonRes.rows.map((r: any) => {
      const completed = parseInt(r.completed_participants || '0', 10);
      const passKkm = parseInt(r.pass_kkm_count || '0', 10);
      const passRate = completed > 0 ? Math.round((passKkm / completed) * 100) : 0;

      return {
        rayonName: r.rayon_name,
        schoolCount: parseInt(r.school_count || '0', 10),
        totalParticipants: parseInt(r.total_participants || '0', 10),
        completedParticipants: completed,
        avgScore: r.avg_score !== null ? parseFloat(r.avg_score) : 0,
        passRate,
      };
    });

    // 4. Regional Grade Distribution (A / B / C / D)
    const gradeRes = await queryPostgres(`
      SELECT 
        COUNT(CASE WHEN ep.final_score >= 88 THEN 1 END) as grade_a,
        COUNT(CASE WHEN ep.final_score >= 75 AND ep.final_score < 88 THEN 1 END) as grade_b,
        COUNT(CASE WHEN ep.final_score >= 60 AND ep.final_score < 75 THEN 1 END) as grade_c,
        COUNT(CASE WHEN ep.final_score < 60 THEN 1 END) as grade_d,
        COUNT(CASE WHEN ep.final_score IS NOT NULL THEN 1 END) as total_graded
      FROM exam_participants ep;
    `);

    const g = gradeRes.rows[0] || {};
    const totalGraded = parseInt(g.total_graded || '0', 10);
    const gradeDistribution = {
      gradeA: { count: parseInt(g.grade_a || '0', 10), percentage: totalGraded > 0 ? Math.round((parseInt(g.grade_a || '0', 10) / totalGraded) * 100) : 0 },
      gradeB: { count: parseInt(g.grade_b || '0', 10), percentage: totalGraded > 0 ? Math.round((parseInt(g.grade_b || '0', 10) / totalGraded) * 100) : 0 },
      gradeC: { count: parseInt(g.grade_c || '0', 10), percentage: totalGraded > 0 ? Math.round((parseInt(g.grade_c || '0', 10) / totalGraded) * 100) : 0 },
      gradeD: { count: parseInt(g.grade_d || '0', 10), percentage: totalGraded > 0 ? Math.round((parseInt(g.grade_d || '0', 10) / totalGraded) * 100) : 0 },
      totalGraded,
    };

    // 5. Subject Absorption Map (Daya Serap Mapel)
    const subjectRes = await queryPostgres(`
      SELECT 
        s.id as subject_id,
        s.name as subject_name,
        s.code as subject_code,
        COUNT(DISTINCT e.id) as exam_count,
        COUNT(CASE WHEN ep.final_score IS NOT NULL THEN ep.id END) as tested_count,
        ROUND(AVG(ep.final_score), 1) as avg_score
      FROM subjects s
      LEFT JOIN exams e ON s.id = e.subject_id
      LEFT JOIN exam_participants ep ON e.id = ep.exam_id
      GROUP BY s.id, s.name, s.code
      ORDER BY avg_score DESC NULLS LAST;
    `);

    const subjectAbsorption = subjectRes.rows.map((r: any) => ({
      subjectId: r.subject_id,
      subjectName: r.subject_name,
      subjectCode: r.subject_code,
      examCount: parseInt(r.exam_count || '0', 10),
      testedCount: parseInt(r.tested_count || '0', 10),
      avgScore: r.avg_score !== null ? parseFloat(r.avg_score) : 0,
    }));

    // If CSV format is requested
    if (format === 'csv') {
      const csvRows = [
        ['No', 'Nama Sekolah', 'NPSN', 'Rayon', 'Jenjang', 'Peserta', 'Selesai', 'Rata-rata Nilai', 'Tertinggi', 'Terendah', 'Lulus KKM (%)', 'Status KKM'],
        ...schoolBenchmarks.map((s, idx) => [
          idx + 1,
          `"${s.schoolName}"`,
          s.schoolCode,
          `"${s.rayon}"`,
          s.level,
          s.totalParticipants,
          s.completedParticipants,
          s.avgScore,
          s.highestScore,
          s.lowestScore,
          `${s.passRate}%`,
          s.kkmStatus,
        ]),
      ];

      const csvString = csvRows.map((row) => row.join(',')).join('\n');

      return new Response(csvString, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Laporan_Mutu_Wilayah_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        kkmRegional,
        schoolBenchmarks,
        rayonBenchmarks,
        gradeDistribution,
        subjectAbsorption,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat analisis mutu wilayah.' },
      { status: 500 }
    );
  }
}
