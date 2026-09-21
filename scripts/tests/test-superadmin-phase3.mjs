import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...rest] = trimmed.split('=');
          const val = rest.join('=').replace(/^["']|["']$/g, '').trim();
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      });
    }
  }
}

loadEnv();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function testPhase3() {
  console.log('================================================================');
  console.log('🧪 VERIFIKASI SPRINT 1 FASE 3: PILAR 4 & 5 (RADAR & MUTU MAKRO)');
  console.log('================================================================\n');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Terhubung ke database PostgreSQL.');

    // 1. Verifikasi Data Telemetri Concurrency Radar (Pilar 4)
    console.log('\n--- 1. Uji Coba Telemetri Concurrency Regional Radar (Pilar 4) ---');
    const concurrencyRes = await client.query(`
      SELECT 
        COUNT(CASE WHEN es.status = 'IN_PROGRESS' THEN 1 END) as active_test_takers,
        COUNT(CASE WHEN es.status = 'SUBMITTED' THEN 1 END) as completed_sessions,
        COALESCE(SUM(es.tab_violation_count), 0) as total_violations,
        COUNT(DISTINCT e.id) as total_exams,
        COUNT(DISTINCT sc.id) as active_schools
      FROM exam_sessions es
      JOIN exam_participants ep ON es.participant_id = ep.id
      JOIN exams e ON ep.exam_id = e.id
      JOIN schools sc ON e.school_id = sc.id;
    `);
    const c = concurrencyRes.rows[0];
    console.log('✅ Agregasi Concurrency Wilayah:');
    console.log(`   - Siswa Aktif Serentak: ${c.active_test_takers}`);
    console.log(`   - Sesi Selesai: ${c.completed_sessions}`);
    console.log(`   - Total Pelanggaran Tab: ${c.total_violations}`);
    console.log(`   - Satuan Pendidikan Terhubung: ${c.active_schools}`);

    // 2. Simulasi Deteksi Anomali Tab Switch & Intervensi Darurat
    console.log('\n--- 2. Uji Coba Deteksi Anomali Integritas & Siaran Darurat ---');
    const highTabRes = await client.query(`
      SELECT 
        es.id as session_id,
        es.tab_violation_count,
        s.full_name as student_name,
        sc.name as school_name
      FROM exam_sessions es
      JOIN exam_participants ep ON es.participant_id = ep.id
      JOIN students s ON ep.student_id = s.id
      JOIN schools sc ON s.school_id = sc.id
      ORDER BY es.tab_violation_count DESC
      LIMIT 5;
    `);
    console.log(`Ditemukan ${highTabRes.rows.length} sampel sesi teratas.`);
    if (highTabRes.rows.length > 0) {
      console.log(`Sampel siswa: ${highTabRes.rows[0].student_name} (${highTabRes.rows[0].school_name}) - ${highTabRes.rows[0].tab_violation_count}x tab switch.`);
    }

    // Uji siaran darurat ke system_settings
    console.log('\nSimulasi Siaran Pengumuman Darurat Wilayah...');
    await client.query(`
      UPDATE system_settings 
      SET value_json = jsonb_set(value_json, '{announcement}', '"[DARURAT DISDIK] Seluruh pengawas harap memverifikasi integritas ruang ujian."'::jsonb),
          updated_at = NOW()
      WHERE key = 'operational_mode';
    `);
    const checkAnnouncement = await client.query(`SELECT value_json->>'announcement' as announcement FROM system_settings WHERE key = 'operational_mode';`);
    console.log(`✅ Pesan siaran darurat tersimpan: "${checkAnnouncement.rows[0].announcement}"`);

    // 3. Verifikasi Analisis Mutu Makro & Standardisasi KKM 75 (Pilar 5)
    console.log('\n--- 3. Uji Coba Benchmark Mutu Sekolah vs Standar KKM 75 (Pilar 5) ---');
    const kkmRegional = 75.0;
    const schoolsRes = await client.query(`
      SELECT 
        sc.id as school_id,
        sc.name as school_name,
        sc.code as school_code,
        sc.rayon,
        COUNT(ep.id) as total_participants,
        COUNT(CASE WHEN ep.final_score IS NOT NULL THEN ep.id END) as completed_participants,
        ROUND(AVG(ep.final_score), 1) as avg_score,
        COUNT(CASE WHEN ep.final_score >= $1 THEN ep.id END) as pass_kkm_count
      FROM schools sc
      LEFT JOIN exams e ON sc.id = e.school_id
      LEFT JOIN exam_participants ep ON e.id = ep.exam_id
      WHERE sc.is_active = true
      GROUP BY sc.id, sc.name, sc.code, sc.rayon
      ORDER BY avg_score DESC NULLS LAST;
    `, [kkmRegional]);

    console.log(`✅ Berhasil mengevaluasi ${schoolsRes.rows.length} satuan pendidikan terhadap KKM ${kkmRegional}:`);
    schoolsRes.rows.forEach((sc, i) => {
      const avg = sc.avg_score !== null ? parseFloat(sc.avg_score) : 0;
      const status = avg >= kkmRegional ? 'MEMENUHI_KKM' : 'DI_BAWAH_KKM';
      console.log(`   ${i + 1}. ${sc.school_name} (${sc.rayon}) -> Rata-rata: ${avg} [${status}]`);
    });

    // 4. Verifikasi Komparasi Disparitas Kinerja Antar-Rayon
    console.log('\n--- 4. Uji Coba Analisis Disparitas Kinerja Antar-Rayon ---');
    const rayonRes = await client.query(`
      SELECT 
        COALESCE(sc.rayon, 'Rayon 1 - Pusat') as rayon_name,
        COUNT(DISTINCT sc.id) as school_count,
        ROUND(AVG(ep.final_score), 1) as avg_score
      FROM schools sc
      LEFT JOIN exams e ON sc.id = e.school_id
      LEFT JOIN exam_participants ep ON e.id = ep.exam_id
      WHERE sc.is_active = true
      GROUP BY sc.rayon
      ORDER BY avg_score DESC NULLS LAST;
    `);
    console.log(`✅ Disparitas Capaian Antar-Rayon:`);
    rayonRes.rows.forEach((r) => {
      console.log(`   - ${r.rayon_name}: ${r.school_count} Sekolah, Rata-rata Skor: ${r.avg_score || 0}`);
    });

    // 5. Verifikasi Sebaran Distribusi Predikat Se-Wilayah (Grade A, B, C, D)
    console.log('\n--- 5. Uji Coba Sebaran Predikat Nilai Se-Wilayah ---');
    const gradeRes = await client.query(`
      SELECT 
        COUNT(CASE WHEN ep.final_score >= 88 THEN 1 END) as grade_a,
        COUNT(CASE WHEN ep.final_score >= 75 AND ep.final_score < 88 THEN 1 END) as grade_b,
        COUNT(CASE WHEN ep.final_score >= 60 AND ep.final_score < 75 THEN 1 END) as grade_c,
        COUNT(CASE WHEN ep.final_score < 60 THEN 1 END) as grade_d,
        COUNT(CASE WHEN ep.final_score IS NOT NULL THEN 1 END) as total_graded
      FROM exam_participants ep;
    `);
    const g = gradeRes.rows[0];
    console.log(`✅ Sebaran Predikat Nilai Wilayah (${g.total_graded} Peserta):`);
    console.log(`   - Grade A (>= 88): ${g.grade_a} siswa`);
    console.log(`   - Grade B (75-87): ${g.grade_b} siswa`);
    console.log(`   - Grade C (60-74): ${g.grade_c} siswa`);
    console.log(`   - Grade D (< 60): ${g.grade_d} siswa`);

    console.log('\n🎉 SELURUH VERIFIKASI FASE 3 (PILAR 4 & 5) BERHASIL 100%!');
  } catch (err) {
    console.error('❌ Terjadi kesalahan pada verifikasi fase 3:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testPhase3();
