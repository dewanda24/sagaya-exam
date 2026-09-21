import { NextResponse } from 'next/server';
import { db } from '@/lib/school/db-service';
import { requireApiAuth } from '@/lib/core/rbac';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU'], searchParams);
    if (!auth.authorized) return auth.response;

    const myOnly = searchParams.get('myOnly') === 'true';
    const teacherIdParam = searchParams.get('teacherId');

    let targetTeacherId: string | null = null;
    if (myOnly && auth.user.role === 'GURU') {
      targetTeacherId = auth.user.id;
    } else if (teacherIdParam) {
      targetTeacherId = teacherIdParam;
    }

    const questions = await db.getQuestionBanks(auth.tenant.schoolId, targetTeacherId);
    return NextResponse.json({ 
      success: true, 
      data: questions,
      currentUserId: auth.user.id,
      userRole: auth.user.role 
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat bank soal.' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const targetSchoolId = auth.user.role === 'SUPER_ADMIN' ? body.schoolId : auth.user.schoolId;

    const created = await db.addQuestionBankItem(body, targetSchoolId, auth.user.id);
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menambahkan butir soal.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID butir soal wajib disertakan.' }, { status: 400 });
    }

    const schoolId = auth.user.role === 'SUPER_ADMIN' ? null : auth.user.schoolId;
    const teacherId = auth.user.role === 'GURU' ? auth.user.id : null;

    const updated = await db.updateQuestionBankItem(id, updates, schoolId, teacherId);

    if (!updated) {
      return NextResponse.json({ 
        success: false, 
        error: 'Butir soal tidak ditemukan atau Anda tidak memiliki hak akses untuk mengedit soal ini.' 
      }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memperbarui butir soal.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireApiAuth(['SUPER_ADMIN', 'ADMIN', 'GURU']);
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Parameter ID wajib disertakan.' }, { status: 400 });
    }

    const schoolId = auth.user.role === 'SUPER_ADMIN' ? null : auth.user.schoolId;
    const teacherId = auth.user.role === 'GURU' ? auth.user.id : null;

    const deleted = await db.deleteQuestionBankItem(id, schoolId, teacherId);

    if (!deleted) {
      return NextResponse.json({ 
        success: false, 
        error: 'Butir soal tidak ditemukan atau Anda tidak memiliki hak akses untuk menghapus soal milik guru lain.' 
      }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: 'Butir soal berhasil dihapus.' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghapus butir soal.' },
      { status: 500 }
    );
  }
}

