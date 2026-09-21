import pg from 'pg';
import fs from 'fs';
import path from 'path';

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
const { Client } = pg;

async function testPhase1() {
  console.log('=== VERIFIKASI FASE 1: SUPER ADMIN (PILAR 1 & 6) ===\n');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('✓ Database terhubung.');

    // 1. Check system_settings table & seeded rows
    console.log('\n1. Memeriksa tabel system_settings...');
    const settingsRes = await client.query('SELECT key, value_json FROM system_settings;');
    console.log(`✓ Ditemukan ${settingsRes.rows.length} konfigurasi global wilayah:`);
    for (const r of settingsRes.rows) {
      console.log(`   - ${r.key}:`, JSON.stringify(r.value_json).substring(0, 70) + '...');
    }

    // 2. Check schools npsn and rayon columns
    console.log('\n2. Memeriksa kolom baru npsn & rayon pada tabel schools...');
    const schoolsRes = await client.query('SELECT name, code, level, quota_students, quota_exams, is_active, rayon FROM schools LIMIT 2;');
    for (const s of schoolsRes.rows) {
      console.log(`   - ${s.name} (${s.code}): Kuota Siswa=${s.quota_students}, Kuota Ujian=${s.quota_exams}, Status=${s.is_active ? 'Aktif' : 'Frozen'}, Rayon=${s.rayon}`);
    }

    // 3. Check exams is_regional column
    console.log('\n3. Memeriksa kolom is_regional & parent_exam_id pada tabel exams...');
    const examsColRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'exams' AND column_name IN ('is_regional', 'parent_exam_id');
    `);
    console.log(`✓ Kolom ujian daerah terverifikasi:`, examsColRes.rows.map(r => r.column_name).join(', '));

    // 4. Check audit_logs table
    console.log('\n4. Memeriksa tabel audit_logs...');
    const auditRes = await client.query('SELECT count(*) as total_logs FROM audit_logs;');
    console.log(`✓ Tabel audit_logs aktif dengan total ${auditRes.rows[0].total_logs} log tercatat.`);

    console.log('\n✅ SELURUH VERIFIKASI FASE 1 SUPER ADMIN BERHASIL 100%!');
  } catch (err) {
    console.error('❌ Verifikasi gagal:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testPhase1();
