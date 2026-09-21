import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { TeacherService } from '@/lib/services/teacher.service';
import { SubjectService } from '@/lib/services/subject.service';
import { queryPostgres } from '@/lib/core/postgres';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('teachers.read');
    if (!auth.authorized) return auth.response;

    const isSuperAdmin = auth.tenant.isSuperAdmin;
    const { searchParams } = new URL(req.url);
    const schoolId = auth.tenant.schoolId;

    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const id = searchParams.get('id');
    const search = searchParams.get('search') || undefined;
    const isActive = searchParams.has('isActive')
      ? searchParams.get('isActive') === 'true'
      : undefined;

    if (id) {
      const teacher = await TeacherService.getTeacherById(schoolId, id);
      if (!teacher) {
        return NextResponse.json(
          { success: false, error: 'Guru tidak ditemukan.' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: teacher });
    }

    // Ambil semua pengguna dengan role GURU, PENGAWAS, atau ADMIN untuk sekolah ini
    let sql = `
      SELECT u.id, u.username, u.full_name, u.role, u.is_active, u.created_at,
             u.nip, u.school_id, u.last_login_at,
             s.name as school_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE u.school_id = $1
        AND u.role IN ('GURU', 'PENGAWAS', 'ADMIN')
    `;
    const params: any[] = [schoolId];

    if (isActive !== undefined) {
      params.push(isActive);
      sql += ` AND u.is_active = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
    }

    sql += ` ORDER BY u.full_name ASC`;

    const usersRes = await queryPostgres(sql, params);

    // Ambil assigned subjects untuk semua user yang ditemukan
    let assignedSubjectsMap: Map<string, string[]> = new Map();
    if (usersRes.rows.length > 0) {
      const userIds = usersRes.rows.map((r: any) => r.id);
      const tsRes = await queryPostgres(
        `SELECT teacher_id, subject_id FROM teacher_subjects WHERE school_id = $1 AND teacher_id = ANY($2::uuid[])`,
        [schoolId, userIds]
      );
      tsRes.rows.forEach((r: any) => {
        const arr = assignedSubjectsMap.get(r.teacher_id) || [];
        arr.push(r.subject_id);
        assignedSubjectsMap.set(r.teacher_id, arr);
      });
    }

    const users = usersRes.rows.map((r: any) => ({
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      role: r.role,
      schoolId: r.school_id,
      schoolName: r.school_name,
      nip: r.nip,
      isActive: r.is_active,
      lastLoginAt: r.last_login_at,
      createdAt: r.created_at,
      assignedSubjects: assignedSubjectsMap.get(r.id) || [],
    }));

    const subjects = await SubjectService.listSubjects(schoolId);

    return NextResponse.json({
      success: true,
      data: {
        users,
        subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
        schools: [],       // Admin sekolah hanya mengelola satu sekolah
        isSuperAdmin,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat data guru.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('teachers.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    // Petakan field form (assignedSubjects) ke field yang diharapkan TeacherService (subjectIds)
    const created = await TeacherService.createTeacher(
      schoolId,
      {
        username: body.username,
        fullName: body.fullName,
        password: body.password,
        nip: body.nip,
        subjectIds: body.assignedSubjects || [],
      },
      {
        id: auth.user.id,
        username: auth.user.username,
        role: auth.user.role,
      }
    );

    // Jika role bukan GURU, update role setelah user dibuat
    if (body.role && body.role !== 'GURU') {
      await queryPostgres(
        `UPDATE users SET role = $1 WHERE id = $2 AND school_id = $3`,
        [body.role, created.id, schoolId]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Guru '${created.fullName}' berhasil ditambahkan.`,
      data: created,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan guru.' },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiPermission('teachers.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { id, fullName, nip, nuptk, phone, role, isActive, password, assignedSubjects } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID Guru diperlukan.' },
        { status: 400 }
      );
    }

    // Update field dasar + role + isActive menggunakan SQL langsung
    // karena TeacherService.updateTeacher tidak mendukung role/isActive
    const setParts: string[] = [];
    const params: any[] = [];

    if (fullName !== undefined) { params.push(fullName?.trim()); setParts.push(`full_name = $${params.length}`); }
    if (nip !== undefined) { params.push(nip?.trim() || null); setParts.push(`nip = $${params.length}`); }
    if (nuptk !== undefined) { params.push(nuptk?.trim() || null); setParts.push(`nuptk = $${params.length}`); }
    if (phone !== undefined) { params.push(phone?.trim() || null); setParts.push(`phone = $${params.length}`); }
    if (role !== undefined) { params.push(role); setParts.push(`role = $${params.length}`); }
    if (isActive !== undefined) { params.push(isActive); setParts.push(`is_active = $${params.length}`); }
    if (password) {
      const { hashPassword } = await import('@/lib/core/auth');
      const hashed = await hashPassword(password);
      params.push(hashed);
      setParts.push(`password_hash = $${params.length}`);
      params.push(0);
      setParts.push(`session_version = $${params.length}`);
    }

    if (setParts.length === 0 && !assignedSubjects) {
      return NextResponse.json({ success: false, error: 'Tidak ada data yang diperbarui.' }, { status: 400 });
    }

    let updatedUser: any = null;
    if (setParts.length > 0) {
      params.push(id);
      params.push(schoolId);
      const updateRes = await queryPostgres(
        `UPDATE users SET ${setParts.join(', ')} WHERE id = $${params.length - 1} AND school_id = $${params.length} RETURNING id, username, full_name, role, is_active, school_id, nip`,
        params
      );
      if (updateRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Akun tidak ditemukan.' }, { status: 404 });
      }
      updatedUser = updateRes.rows[0];
    }

    // Update mata pelajaran yang diampu
    if (assignedSubjects !== undefined) {
      await queryPostgres(`DELETE FROM teacher_subjects WHERE school_id = $1 AND teacher_id = $2`, [schoolId, id]);
      for (const subId of (assignedSubjects as string[])) {
        await queryPostgres(
          `INSERT INTO teacher_subjects (school_id, teacher_id, subject_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [schoolId, id, subId]
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Data pengguna berhasil diperbarui.',
      data: updatedUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui guru.' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireApiPermission('teachers.delete');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: 'Konteks sekolah tidak ditemukan.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Guru diperlukan.' }, { status: 400 });
    }

    // Nonaktifkan user (soft delete)
    const deactivateRes = await queryPostgres(
      `UPDATE users SET is_active = false WHERE id = $1 AND school_id = $2 RETURNING id, full_name`,
      [id, schoolId]
    );

    if (deactivateRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Akun tidak ditemukan di sekolah ini.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Akun berhasil dinonaktifkan.' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menonaktifkan guru.' },
      { status: 400 }
    );
  }
}
