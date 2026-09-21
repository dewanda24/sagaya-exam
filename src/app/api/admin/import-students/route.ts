import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken } from '@/lib/core/auth';
import { getTenantContext } from '@/lib/core/tenant';
import * as XLSX from 'xlsx';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const tenant = await getTenantContext(user);
    let targetSchoolId = tenant.schoolId;

    const contentType = req.headers.get('content-type') || '';
    let rawRows: any[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const schoolIdForm = formData.get('schoolId') as string | null;
      if (schoolIdForm) targetSchoolId = schoolIdForm;

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'Silakan pilih file Excel (.xlsx, .xls) atau CSV.' },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    } else {
      const body = await req.json();
      rawRows = body.rows || [];
      if (body.schoolId) targetSchoolId = body.schoolId;
    }

    if (!targetSchoolId) {
      const defaultSchoolRes = await queryPostgres('SELECT id FROM schools LIMIT 1;');
      targetSchoolId = defaultSchoolRes.rows[0]?.id;
    }

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'File kosong atau format data tidak valid.' },
        { status: 400 }
      );
    }

    // Pillar 1: Enforce student quota for bulk import
    const quotaRes = await queryPostgres(
      `SELECT quota_students, is_active FROM schools WHERE id = $1 LIMIT 1;`,
      [targetSchoolId]
    );
    if (quotaRes.rows.length > 0) {
      const school = quotaRes.rows[0];
      if (school.is_active === false) {
        return NextResponse.json(
          { success: false, error: 'Satuan pendidikan ini sedang dinonaktifkan oleh Administrator Platform.' },
          { status: 403 }
        );
      }
      const countRes = await queryPostgres(
        `SELECT COUNT(*) as current_count FROM students WHERE school_id = $1 AND is_active = true;`,
        [targetSchoolId]
      );
      const currentCount = parseInt(countRes.rows[0]?.current_count || '0', 10);
      const quota = school.quota_students || 1000;
      if (currentCount + rawRows.length > quota) {
        return NextResponse.json(
          {
            success: false,
            error: `Batas kuota siswa aktif tidak mencukupi untuk mengimpor ${rawRows.length} siswa (saat ini ${currentCount}/${quota} siswa). Silakan hubungi Administrator Platform / Super Admin untuk penambahan kuota.`,
          },
          { status: 400 }
        );
      }
    }

    // Cache existing class rooms for target school
    const classRes = await queryPostgres(
      `SELECT id, name FROM class_rooms WHERE school_id = $1;`,
      [targetSchoolId]
    );
    const classMap = new Map<string, string>();
    for (const c of classRes.rows) {
      classMap.set(c.name.trim().toLowerCase(), c.id);
    }

    let insertedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];

      const nisn = String(
        row['NISN'] || row['nisn'] || row['No NISN'] || row['Nomor NISN'] || ''
      ).trim();
      const nis = String(
        row['NIS'] || row['nis'] || row['No Induk'] || row['Nomor Induk'] || nisn
      ).trim();
      const fullName = String(
        row['Nama Lengkap'] || row['Nama'] || row['nama'] || row['nama_lengkap'] || row['nama_siswa'] || ''
      ).trim();
      let gender = String(
        row['Jenis Kelamin'] || row['JK'] || row['jk'] || row['gender'] || 'L'
      ).trim().toUpperCase();
      if (gender !== 'L' && gender !== 'P') {
        gender = gender.startsWith('P') ? 'P' : 'L';
      }

      const className = String(
        row['Kelas'] || row['kelas'] || row['Rombel'] || row['rombel'] || 'XII Umum'
      ).trim();

      if (!fullName || !nisn) {
        errors.push(`Baris ${i + 2}: Nama atau NISN kosong.`);
        continue;
      }

      // Resolve class room ID
      let classId = classMap.get(className.toLowerCase());
      if (!classId) {
        const newClassRes = await queryPostgres(
          `INSERT INTO class_rooms (id, name, level, academic_year, school_id)
           VALUES (uuid_generate_v4(), $1, '12', '2025/2026', $2)
           RETURNING id;`,
          [className, targetSchoolId]
        );
        const resolvedId: string = newClassRes.rows[0]?.id || '';
        classId = resolvedId;
        classMap.set(className.toLowerCase(), resolvedId);
      }

      // Generate Access PIN
      const pin = `SG-${Math.floor(1000 + Math.random() * 9000)}`;

      // Upsert into students
      const upsertRes = await queryPostgres(
        `INSERT INTO students (id, nis, nisn, full_name, gender, class_room_id, card_access_code, school_id)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (nisn) 
         DO UPDATE SET 
           full_name = EXCLUDED.full_name,
           nis = EXCLUDED.nis,
           gender = EXCLUDED.gender,
           class_room_id = EXCLUDED.class_room_id,
           school_id = COALESCE(EXCLUDED.school_id, students.school_id)
         RETURNING (xmax = 0) AS is_insert;`,
        [nis, nisn, fullName, gender, classId, pin, targetSchoolId]
      );

      if (upsertRes.rows[0]?.is_insert) {
        insertedCount++;
      } else {
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import selesai: ${insertedCount} siswa baru ditambahkan, ${updatedCount} siswa diperbarui.`,
      data: {
        totalRead: rawRows.length,
        insertedCount,
        updatedCount,
        errorCount: errors.length,
        errors: errors.slice(0, 5),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses import data siswa.' },
      { status: 500 }
    );
  }
}
