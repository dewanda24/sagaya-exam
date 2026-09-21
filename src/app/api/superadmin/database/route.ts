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
      return NextResponse.json({ success: false, error: 'Forbidden: Khusus Super Admin' }, { status: 403 });
    }

    // 1. Ukur latency ping database
    const startPing = Date.now();
    const timeRes = await queryPostgres('SELECT NOW() as db_time, current_database() as db_name, version() as db_version;');
    const latencyMs = Date.now() - startPing;
    const dbName = timeRes.rows[0]?.db_name || 'PostgreSQL';
    const dbVersion = timeRes.rows[0]?.db_version || '';

    // 2. Ukuran Database
    let dbSize = 'N/A';
    try {
      const sizeRes = await queryPostgres('SELECT pg_size_pretty(pg_database_size(current_database())) as size;');
      dbSize = sizeRes.rows[0]?.size || 'N/A';
    } catch {
      dbSize = 'Managed Cloud';
    }

    // 3. Hitung jumlah baris tabel-tabel utama
    const tablesCountQuery = `
      SELECT
        (SELECT COUNT(*) FROM schools) as schools_count,
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM students) as students_count,
        (SELECT COUNT(*) FROM class_rooms) as classes_count,
        (SELECT COUNT(*) FROM subjects) as subjects_count,
        (SELECT COUNT(*) FROM question_banks) as questions_count,
        (SELECT COUNT(*) FROM exams) as exams_count,
        (SELECT COUNT(*) FROM exam_participants) as participants_count,
        (SELECT COUNT(*) FROM exam_sessions) as sessions_count,
        (SELECT COUNT(*) FROM student_answers) as answers_count,
        (SELECT COUNT(*) FROM audit_logs) as audit_count,
        (SELECT COUNT(*) FROM broadcast_announcements) as broadcast_count;
    `;
    const countRes = await queryPostgres(tablesCountQuery);
    const rowCounts = countRes.rows[0] || {};

    const tableMetrics = [
      { name: 'schools', label: 'Satuan Pendidikan', count: parseInt(rowCounts.schools_count || '0', 10), category: 'Master' },
      { name: 'users', label: 'Pengguna & Administrator', count: parseInt(rowCounts.users_count || '0', 10), category: 'Master' },
      { name: 'students', label: 'Data Peserta Didik (Siswa)', count: parseInt(rowCounts.students_count || '0', 10), category: 'Master' },
      { name: 'class_rooms', label: 'Rombongan Belajar / Kelas', count: parseInt(rowCounts.classes_count || '0', 10), category: 'Master' },
      { name: 'subjects', label: 'Mata Pelajaran', count: parseInt(rowCounts.subjects_count || '0', 10), category: 'Master' },
      { name: 'question_banks', label: 'Butir Bank Soal', count: parseInt(rowCounts.questions_count || '0', 10), category: 'Akademik' },
      { name: 'exams', label: 'Paket Ujian', count: parseInt(rowCounts.exams_count || '0', 10), category: 'Ujian' },
      { name: 'exam_participants', label: 'Pendaftaran Peserta Ujian', count: parseInt(rowCounts.participants_count || '0', 10), category: 'Ujian' },
      { name: 'exam_sessions', label: 'Sesi Lembar Ujian', count: parseInt(rowCounts.sessions_count || '0', 10), category: 'Transaksi' },
      { name: 'student_answers', label: 'Rekap Jawaban Siswa', count: parseInt(rowCounts.answers_count || '0', 10), category: 'Transaksi' },
      { name: 'broadcast_announcements', label: 'Siaran Pengumuman', count: parseInt(rowCounts.broadcast_count || '0', 10), category: 'Sistem' },
      { name: 'audit_logs', label: 'Log Jejak Audit', count: parseInt(rowCounts.audit_count || '0', 10), category: 'Keamanan' },
    ];

    // 4. Statistik Keamanan & Kredensial
    const secRes = await queryPostgres(`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN password_hash LIKE 'sha256$%' THEN 1 END) as sha256_passwords,
        COUNT(CASE WHEN role = 'SUPER_ADMIN' THEN 1 END) as superadmin_count,
        COUNT(CASE WHEN role = 'ADMIN' THEN 1 END) as schooladmin_count
      FROM users;
    `);
    const secRow = secRes.rows[0] || {};

    const activeSessionsRes = await queryPostgres(`
      SELECT
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as live_in_progress,
        COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_sessions
      FROM exam_sessions;
    `);
    const sessionRow = activeSessionsRes.rows[0] || {};

    // 5. Riwayat Backup dari Audit Logs
    const backupLogsRes = await queryPostgres(`
      SELECT id, action, details_json, created_at, user_id
      FROM audit_logs
      WHERE action LIKE 'DATABASE_BACKUP%' OR action LIKE 'DATABASE_CLEANUP%'
      ORDER BY created_at DESC
      LIMIT 10;
    `);

    const backupHistory = backupLogsRes.rows.map((r: any) => ({
      id: r.id,
      action: r.action,
      details: r.details_json,
      createdAt: r.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        health: {
          status: 'CONNECTED',
          latencyMs,
          dbName,
          dbSize,
          dbVersion: dbVersion.split(' ')[0] + ' ' + dbVersion.split(' ')[1],
          connectionLimit: 20,
        },
        tableMetrics,
        security: {
          totalUsers: parseInt(secRow.total_users || '0', 10),
          sha256Passwords: parseInt(secRow.sha256_passwords || '0', 10),
          superadminCount: parseInt(secRow.superadmin_count || '0', 10),
          schooladminCount: parseInt(secRow.schooladmin_count || '0', 10),
          liveActiveSessions: parseInt(sessionRow.live_in_progress || '0', 10),
          expiredSessions: parseInt(sessionRow.expired_sessions || '0', 10),
        },
        backupHistory,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memeriksa kesehatan database.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Khusus Super Admin' }, { status: 403 });
    }

    const body = await req.json();
    const { action, scope = 'CONFIG_SCHOOLS', reason = 'Cadangan data berkala' } = body;

    // 1. AKSI: CREATE_BACKUP
    if (action === 'CREATE_BACKUP') {
      const now = new Date();
      const timestampStr = now.toISOString().replace(/[:.]/g, '-');
      const backupPayload: Record<string, any> = {
        platform: 'SAGAYA EXAM',
        edition: 'Platform Master Owner',
        generatedAt: now.toISOString(),
        generatedBy: user.username,
        scope,
        data: {},
      };

      if (scope === 'CONFIG_SCHOOLS' || scope === 'FULL') {
        const schoolsRes = await queryPostgres('SELECT * FROM schools ORDER BY name ASC;');
        const settingsRes = await queryPostgres('SELECT * FROM system_settings;');
        backupPayload.data.schools = schoolsRes.rows;
        backupPayload.data.systemSettings = settingsRes.rows;
      }

      if (scope === 'QUESTION_BANKS' || scope === 'FULL') {
        const questionsRes = await queryPostgres('SELECT * FROM question_banks ORDER BY created_at DESC;');
        const subjectsRes = await queryPostgres('SELECT * FROM subjects ORDER BY name ASC;');
        backupPayload.data.questionBanks = questionsRes.rows;
        backupPayload.data.subjects = subjectsRes.rows;
      }

      if (scope === 'EXAM_RESULTS' || scope === 'FULL') {
        const examsRes = await queryPostgres('SELECT id, school_id, title, status, start_time, end_time, duration_minutes FROM exams;');
        const participantsRes = await queryPostgres(`
          SELECT ep.id, ep.exam_id, ep.student_id, ep.final_score, ep.graded_status, s.name as student_name, s.nisn, sch.name as school_name
          FROM exam_participants ep
          JOIN students s ON ep.student_id = s.id
          JOIN schools sch ON s.school_id = sch.id
          ORDER BY ep.created_at DESC
          LIMIT 10000;
        `);
        backupPayload.data.exams = examsRes.rows;
        backupPayload.data.participants = participantsRes.rows;
      }

      // Catat ke audit_logs
      await queryPostgres(
        `INSERT INTO audit_logs (user_id, role, action, details_json, ip_address)
         VALUES ($1, 'SUPER_ADMIN', $2, $3, $4);`,
        [
          user.id,
          `DATABASE_BACKUP_${scope}`,
          JSON.stringify({
            scope,
            timestamp: now.toISOString(),
            reason,
          }),
          '127.0.0.1',
        ]
      );

      const filename = `sagaya_backup_${scope.toLowerCase()}_${timestampStr}.json`;

      return NextResponse.json({
        success: true,
        message: `Cadangan data ${scope} berhasil dibuat.`,
        filename,
        backupData: backupPayload,
      });
    }

    // 2. AKSI: CLEAN_EXPIRED_SESSIONS (Pembersihan storage)
    if (action === 'CLEAN_EXPIRED_SESSIONS') {
      const cleanRes = await queryPostgres(`
        DELETE FROM exam_sessions
        WHERE status = 'EXPIRED'
          AND created_at < NOW() - INTERVAL '7 days'
        RETURNING id;
      `);
      const deletedCount = cleanRes.rows.length;

      await queryPostgres(
        `INSERT INTO audit_logs (user_id, role, action, details_json, ip_address)
         VALUES ($1, 'SUPER_ADMIN', 'DATABASE_CLEANUP_EXPIRED', $2, '127.0.0.1');`,
        [
          user.id,
          JSON.stringify({
            deletedCount,
            executedAt: new Date().toISOString(),
          }),
        ]
      );

      return NextResponse.json({
        success: true,
        message: `Pembersihan selesai. Sebanyak ${deletedCount} sesi kedaluwarsa berhasil dibersihkan dari database.`,
        deletedCount,
      });
    }

    // 3. AKSI: INVALIDATE_ALL_SESSIONS (Darurat Keamanan Global)
    if (action === 'INVALIDATE_ALL_SESSIONS') {
      const resetRes = await queryPostgres(`
        UPDATE exam_sessions
        SET status = 'DISCONNECTED',
            device_fingerprint = 'REVOKED_BY_MASTER_' || substr(md5(random()::text), 1, 8)
        WHERE status = 'IN_PROGRESS'
        RETURNING id;
      `);
      const affectedCount = resetRes.rows.length;

      await queryPostgres(
        `INSERT INTO audit_logs (user_id, role, action, details_json, ip_address)
         VALUES ($1, 'SUPER_ADMIN', 'DATABASE_SECURITY_INVALIDATE_SESSIONS', $2, '127.0.0.1');`,
        [
          user.id,
          JSON.stringify({
            affectedCount,
            executedAt: new Date().toISOString(),
            reason,
          }),
        ]
      );

      return NextResponse.json({
        success: true,
        message: `Tindakan keamanan darurat dieksekusi: ${affectedCount} sesi siswa aktif berhasil diputus serentak.`,
        affectedCount,
      });
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak valid.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses aksi database.' },
      { status: 500 }
    );
  }
}
