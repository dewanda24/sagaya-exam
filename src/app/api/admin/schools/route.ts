import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryPostgres } from '@/lib/core/postgres';
import { verifySessionToken, hashPassword } from '@/lib/core/auth';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';

    // If user is ADMIN (not SUPER_ADMIN), only return their assigned school
    let query = `
      SELECT 
        s.*,
        COALESCE(stu.student_count, 0) as total_students,
        COALESCE(cls.class_count, 0) as total_classes,
        COALESCE(ex.exam_count, 0) as total_exams,
        COALESCE(tch.teacher_count, 0) as total_teachers
      FROM schools s
      LEFT JOIN (
        SELECT school_id, COUNT(*) as student_count 
        FROM students GROUP BY school_id
      ) stu ON s.id = stu.school_id
      LEFT JOIN (
        SELECT school_id, COUNT(*) as class_count 
        FROM class_rooms GROUP BY school_id
      ) cls ON s.id = cls.school_id
      LEFT JOIN (
        SELECT school_id, COUNT(*) as exam_count 
        FROM exams GROUP BY school_id
      ) ex ON s.id = ex.school_id
      LEFT JOIN (
        SELECT school_id, COUNT(*) as teacher_count 
        FROM users WHERE role IN ('GURU', 'PENGAWAS') GROUP BY school_id
      ) tch ON s.id = tch.school_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user.role !== 'SUPER_ADMIN' && user.schoolId) {
      params.push(user.schoolId);
      query += ` AND s.id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (LOWER(s.name) LIKE $${params.length} OR LOWER(s.code) LIKE $${params.length} OR LOWER(s.principal_name) LIKE $${params.length})`;
    }

    query += ` ORDER BY s.name ASC;`;

    const res = await queryPostgres(query, params);

    const schools = res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      level: r.level,
      address: r.address,
      phone: r.phone,
      email: r.email,
      principalName: r.principal_name,
      principalNip: r.principal_nip,
      logoUrl: r.logo_url,
      headerTitle1: r.header_title_1,
      headerTitle2: r.header_title_2,
      isActive: r.is_active,
      quotaStudents: r.quota_students,
      quotaExams: r.quota_exams,
      settings: r.settings || {},
      createdAt: r.created_at,
      stats: {
        totalStudents: parseInt(r.total_students || '0', 10),
        totalClasses: parseInt(r.total_classes || '0', 10),
        totalExams: parseInt(r.total_exams || '0', 10),
        totalTeachers: parseInt(r.total_teachers || '0', 10),
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        schools,
        userRole: user.role,
        currentSchoolId: user.schoolId,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat data sekolah.' },
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
      return NextResponse.json(
        { success: false, error: 'Hanya Super Admin yang dapat mendaftarkan sekolah baru.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      code,
      name,
      level,
      address,
      phone,
      email,
      principalName,
      principalNip,
      logoUrl,
      headerTitle1,
      headerTitle2,
      quotaStudents = 1000,
      quotaExams = 50,
    } = body;

    if (!code || !name || !level) {
      return NextResponse.json(
        { success: false, error: 'Kode/NPSN, Nama Sekolah, dan Jenjang wajib diisi.' },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();

    // Check conflict
    const checkRes = await queryPostgres('SELECT id FROM schools WHERE code = $1 LIMIT 1;', [cleanCode]);
    if (checkRes.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: `Sekolah dengan kode / NPSN ${cleanCode} sudah terdaftar.` },
        { status: 400 }
      );
    }

    const insertRes = await queryPostgres(
      `INSERT INTO schools (
        code, name, level, address, phone, email, 
        principal_name, principal_nip, logo_url, 
        header_title_1, header_title_2, quota_students, quota_exams, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
      RETURNING *;`,
      [
        cleanCode,
        name.trim(),
        level,
        address || '',
        phone || '',
        email || '',
        principalName || '',
        principalNip || '',
        logoUrl || '',
        headerTitle1 || '',
        headerTitle2 || '',
        quotaStudents,
        quotaExams,
      ]
    );

    const newSchool = insertRes.rows[0];

    // Generate a secure, one-time temporary password for the new school admin
    const randomChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomSuffix = '';
    for (let i = 0; i < 6; i++) {
      randomSuffix += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    const tempPassword = `SAGAYA-${randomSuffix}`;
    const passwordHash = await hashPassword(tempPassword);

    // Create a default admin account for this new school automatically
    const adminUsername = `admin.${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    await queryPostgres(
      `INSERT INTO users (username, password_hash, full_name, role, school_id, is_active)
       VALUES ($1, $2, $3, 'ADMIN', $4, true)
       ON CONFLICT (username) DO UPDATE SET password_hash = $2, school_id = $4, is_active = true;`,
      [adminUsername, passwordHash, `Admin ${name.trim()}`, newSchool.id]
    );

    return NextResponse.json({
      success: true,
      message: `Sekolah ${name} berhasil ditambahkan dengan akun admin: ${adminUsername}`,
      data: newSchool,
      adminAccount: {
        username: adminUsername,
        tempPassword,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan sekolah.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sagaya_session')?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      code,
      name,
      level,
      address,
      phone,
      email,
      principalName,
      principalNip,
      logoUrl,
      headerTitle1,
      headerTitle2,
      isActive,
      quotaStudents,
      quotaExams,
      settings,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID sekolah wajib disertakan.' }, { status: 400 });
    }

    // Permission check: ADMIN can only update their own school; SUPER_ADMIN can update any
    if (user.role !== 'SUPER_ADMIN' && user.schoolId !== id) {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki hak mengubah data sekolah ini.' },
        { status: 403 }
      );
    }

    await queryPostgres(
      `UPDATE schools SET
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        level = COALESCE($3, level),
        address = COALESCE($4, address),
        phone = COALESCE($5, phone),
        email = COALESCE($6, email),
        principal_name = COALESCE($7, principal_name),
        principal_nip = COALESCE($8, principal_nip),
        logo_url = COALESCE($9, logo_url),
        header_title_1 = COALESCE($10, header_title_1),
        header_title_2 = COALESCE($11, header_title_2),
        is_active = COALESCE($12, is_active),
        quota_students = COALESCE($13, quota_students),
        quota_exams = COALESCE($14, quota_exams),
        settings = CASE WHEN $15::jsonb IS NOT NULL THEN settings || $15::jsonb ELSE settings END
       WHERE id = $16;`,
      [
        code ? code.trim().toUpperCase() : undefined,
        name,
        level,
        address,
        phone,
        email,
        principalName,
        principalNip,
        logoUrl,
        headerTitle1,
        headerTitle2,
        isActive,
        user.role === 'SUPER_ADMIN' ? quotaStudents : undefined,
        user.role === 'SUPER_ADMIN' ? quotaExams : undefined,
        settings ? JSON.stringify(settings) : null,
        id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Data sekolah berhasil diperbarui.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui data sekolah.' },
      { status: 500 }
    );
  }
}
