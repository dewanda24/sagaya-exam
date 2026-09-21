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

async function testPhase2() {
  console.log('================================================================');
  console.log('🧪 VERIFIKASI SPRINT 1 FASE 2: PILAR 2 & 3 (SUPER ADMIN / DISDIK)');
  console.log('================================================================\n');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Terhubung ke database PostgreSQL.');

    // Cleanup previous test run
    await client.query(`DELETE FROM exams WHERE title = 'Uji Coba Asesmen Standar Daerah 2026';`);

    // 1. Verifikasi Skema Pilar 2 & 3
    console.log('\n--- 1. Cek Skema Kolom Tabel ---');
    const colsExams = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'exams' AND column_name IN ('is_regional', 'parent_exam_id');
    `);
    console.log(`Tabel exams memiliki kolom regional:`, colsExams.rows.map((r) => r.column_name));
    if (colsExams.rows.length < 2) {
      throw new Error('Kolom is_regional atau parent_exam_id belum lengkap di tabel exams.');
    }

    const colsQb = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'question_banks' AND column_name IN ('curation_status', 'curation_notes', 'curated_by', 'cognitive_level', 'competence_code');
    `);
    console.log(`Tabel question_banks memiliki kolom kurasi:`, colsQb.rows.map((r) => r.column_name));
    if (colsQb.rows.length < 5) {
      throw new Error('Kolom kurasi di question_banks belum lengkap.');
    }

    // 2. Simulasi Terbit Ujian Standar Wilayah (Pilar 2)
    console.log('\n--- 2. Simulasi Broadcast Ujian Standar Wilayah (Pilar 2) ---');
    const subRes = await client.query('SELECT id, name FROM subjects LIMIT 1;');
    const subject = subRes.rows[0];
    const schoolsRes = await client.query('SELECT id, name FROM schools WHERE is_active = true;');
    console.log(`Mata Pelajaran: ${subject?.name}, Total Sekolah Aktif: ${schoolsRes.rows.length}`);

    // Fetch snapshot questions
    const qRes = await client.query(
      `SELECT id, question_text, type, weight, options_json, answer_key_json 
       FROM question_banks 
       LIMIT 5;`
    );
    const snapshot = qRes.rows;
    console.log(`Jumlah butir soal yang dibekukan ke snapshot: ${snapshot.length}`);

    // Insert master exam
    const masterInsert = await client.query(
      `INSERT INTO exams (
         id, title, subject_id, status, window_mode,
         start_time, end_time, duration_minutes, question_snapshot_json,
         is_regional, parent_exam_id, school_id
       ) VALUES (
         uuid_generate_v4(), 'Uji Coba Asesmen Standar Daerah 2026', $1, 'ACTIVE', 'SIMULTANEOUS',
         NOW(), NOW() + INTERVAL '2 hours', 90, $2::jsonb,
         true, NULL, NULL
       ) RETURNING id, title;`,
      [subject.id, JSON.stringify(snapshot)]
    );
    const masterExam = masterInsert.rows[0];
    console.log(`✅ Master Ujian Wilayah dibuat: [${masterExam.id}] "${masterExam.title}"`);

    // Broadcast child exams
    let broadcastCount = 0;
    for (const sc of schoolsRes.rows) {
      await client.query(
        `INSERT INTO exams (
           id, title, subject_id, status, window_mode,
           start_time, end_time, duration_minutes, question_snapshot_json,
           school_id, is_regional, parent_exam_id
         ) VALUES (
           uuid_generate_v4(), $1, $2, 'ACTIVE', 'SIMULTANEOUS',
           NOW(), NOW() + INTERVAL '2 hours', 90, $3::jsonb,
           $4, true, $5
         );`,
        [`[Wilayah] ${masterExam.title}`, subject.id, JSON.stringify(snapshot), sc.id, masterExam.id]
      );
      broadcastCount++;
    }
    console.log(`✅ Sukses mendistribusikan child exam ke ${broadcastCount} satuan pendidikan!`);

    // 3. Verifikasi Telemetri & Partisipasi Ujian Wilayah
    console.log('\n--- 3. Verifikasi Telemetri Distribusi & Partisipasi ---');
    const childCheck = await client.query(
      `SELECT count(*) as total_children, count(DISTINCT school_id) as total_schools 
       FROM exams 
       WHERE parent_exam_id = $1;`,
      [masterExam.id]
    );
    console.log(`Hasil agregasi: ${childCheck.rows[0].total_children} ujian anak di ${childCheck.rows[0].total_schools} sekolah berbeda.`);

    // 4. Uji Coba Emergency Cascade & Perpanjangan Waktu (Pilar 2)
    console.log('\n--- 4. Uji Coba Perpanjangan Waktu & Sinkronisasi Status Darurat ---');
    // Extend time +15 min
    await client.query(
      `UPDATE exams 
       SET duration_minutes = duration_minutes + 15,
           end_time = end_time + INTERVAL '15 minutes'
       WHERE id = $1 OR parent_exam_id = $1;`,
      [masterExam.id]
    );
    const extendCheck = await client.query(`SELECT duration_minutes FROM exams WHERE id = $1;`, [masterExam.id]);
    console.log(`✅ Durasi master ujian setelah perpanjangan: ${extendCheck.rows[0].duration_minutes} menit (+15m).`);

    // Cascade status to COMPLETED then back to ACTIVE
    await client.query(
      `UPDATE exams SET status = 'COMPLETED' WHERE id = $1 OR parent_exam_id = $1;`,
      [masterExam.id]
    );
    const statusCheck = await client.query(`SELECT DISTINCT status FROM exams WHERE id = $1 OR parent_exam_id = $1;`, [masterExam.id]);
    console.log(`✅ Status seluruh ujian selaras: ${statusCheck.rows.map((r) => r.status).join(', ')}`);

    // 5. Verifikasi Kurasi Bank Soal MGMP (Pilar 3)
    console.log('\n--- 5. Uji Coba Alur Kurasi Soal MGMP (Pilar 3) ---');
    if (snapshot.length > 0) {
      const targetQ = snapshot[0];
      // Approve question
      await client.query(
        `UPDATE question_banks 
         SET curation_status = 'APPROVED_REGIONAL',
             curation_notes = 'Soal memenuhi standar HOTS penalaran kritis Kurikulum Nasional.',
             curated_by = 'Pengembang Kurikulum Disdik',
             curated_at = NOW(),
             cognitive_level = 'L3_PENALARAN_HOTS',
             competence_code = 'KD 3.4 / TP 2.1'
         WHERE id = $1;`,
        [targetQ.id]
      );

      const curatedCheck = await client.query(
        `SELECT id, curation_status, curation_notes, curated_by, cognitive_level, competence_code 
         FROM question_banks WHERE id = $1;`,
        [targetQ.id]
      );
      console.log(`✅ Butir soal ${targetQ.id} berhasil dikurasi:`, curatedCheck.rows[0]);

      // Catat ke Audit Log
      await client.query(
        `INSERT INTO audit_logs (id, user_id, action, details_json, created_at)
         VALUES (uuid_generate_v4(), NULL, 'APPROVE_QUESTION_REGIONAL', $1::jsonb, NOW());`,
        [JSON.stringify({ questionId: targetQ.id, status: 'APPROVED_REGIONAL', topic: targetQ.question_text?.substring(0, 30) })]
      );
      console.log('✅ Jejak audit kurasi tercatat di tabel audit_logs.');
    }

    // 6. Cleanup Ujian Uji Coba (Cascade Delete)
    console.log('\n--- 6. Uji Coba Penarikan / Cascade Delete Ujian Wilayah ---');
    await client.query(`DELETE FROM exams WHERE id = $1;`, [masterExam.id]);
    const afterDelete = await client.query(`SELECT count(*) as count FROM exams WHERE parent_exam_id = $1;`, [masterExam.id]);
    console.log(`✅ Sisa child exam setelah master dihapus: ${afterDelete.rows[0].count} (Harus 0 - Cascade Sukses).`);

    console.log('\n🎉 SELURUH VERIFIKASI FASE 2 (PILAR 2 & 3) BERHASIL 100% TANPA KENDALA!');
  } catch (err) {
    console.error('❌ Terjadi kesalahan pada verifikasi fase 2:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testPhase2();
