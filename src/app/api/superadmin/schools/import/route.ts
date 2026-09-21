import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken, hashPassword } from '@/lib/core/auth';

interface ImportSchoolRow {
  code: string;
  name: string;
  level: string;
  rayon?: string;
  quotaStudents?: number;
  quotaExams?: number;
  subscriptionTier?: string;
  subscriptionDays?: number;
  principalName?: string;
  address?: string;
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
    const { schools }: { schools: ImportSchoolRow[] } = body;

    if (!Array.isArray(schools) || schools.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Data satuan pendidikan tidak boleh kosong.' },
        { status: 400 }
      );
    }

    if (schools.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Maksimal 200 satuan pendidikan dalam satu kali impor.' },
        { status: 400 }
      );
    }

    const createdSchools: Array<{
      id: string;
      name: string;
      code: string;
      adminUsername: string;
      tempPassword: string;
    }> = [];

    const skippedCodes: string[] = [];

    for (const item of schools) {
      const cleanCode = (item.code || '').trim().toUpperCase();
      const cleanName = (item.name || '').trim();
      const cleanLevel = (item.level || 'SMA').trim().toUpperCase();

      if (!cleanCode || !cleanName) {
        continue;
      }

      // Periksa apakah kode/NPSN sudah terdaftar
      const checkRes = await queryPostgres(
        'SELECT id FROM schools WHERE code = $1 OR npsn = $1 LIMIT 1;',
        [cleanCode]
      );

      if (checkRes.rows.length > 0) {
        skippedCodes.push(cleanCode);
        continue;
      }

      const rayon = (item.rayon || 'Rayon 1 - Pusat').trim();
      const quotaStudents = Number(item.quotaStudents) || 500;
      const quotaExams = Number(item.quotaExams) || 25;
      const subscriptionTier = (item.subscriptionTier || 'TAHUNAN').trim().toUpperCase();
      const subscriptionDays = Number(item.subscriptionDays) || 365;
      const principalName = (item.principalName || '').trim();
      const address = (item.address || '').trim();

      // Insert school
      const insertRes = await queryPostgres(
        `INSERT INTO schools (
          code, npsn, name, level, rayon, quota_students, quota_exams,
          principal_name, address, is_active, subscription_tier, 
          subscription_expires_at, subscription_status
        ) VALUES (
          $1, $1, $2, $3, $4, $5, $6, $7, $8, true, $9,
          NOW() + ($10 || ' days')::interval, 'ACTIVE'
        ) RETURNING id;`,
        [
          cleanCode,
          cleanName,
          cleanLevel,
          rayon,
          quotaStudents,
          quotaExams,
          principalName,
          address,
          subscriptionTier,
          subscriptionDays,
        ]
      );

      const newSchoolId = insertRes.rows[0].id;

      // Generate One-Time Password
      const randomChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let randomSuffix = '';
      for (let i = 0; i < 6; i++) {
        randomSuffix += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
      }
      const tempPassword = `SAGAYA-${randomSuffix}`;
      const passwordHash = await hashPassword(tempPassword);

      const adminUsername = `admin.${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      await queryPostgres(
        `INSERT INTO users (username, password_hash, full_name, role, school_id, is_active)
         VALUES ($1, $2, $3, 'ADMIN', $4, true)
         ON CONFLICT (username) DO UPDATE SET password_hash = $2, school_id = $4, is_active = true;`,
        [adminUsername, passwordHash, `Admin ${cleanName}`, newSchoolId]
      );

      createdSchools.push({
        id: newSchoolId,
        name: cleanName,
        code: cleanCode,
        adminUsername,
        tempPassword,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Impor massal selesai. ${createdSchools.length} sekolah berhasil didaftarkan. ${
        skippedCodes.length > 0 ? `${skippedCodes.length} sekolah dilewati karena kode sudah terdaftar.` : ''
      }`,
      importedCount: createdSchools.length,
      skippedCount: skippedCodes.length,
      skippedCodes,
      createdCredentials: createdSchools,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses impor massal sekolah.' },
      { status: 500 }
    );
  }
}
