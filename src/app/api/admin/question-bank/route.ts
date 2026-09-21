import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { SchoolQuestionService } from '@/lib/services/school-question.service';
import { SubjectService } from '@/lib/services/subject.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('questions.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const detail = await SchoolQuestionService.getQuestionById(schoolId, id);
      if (!detail) {
        return NextResponse.json({ success: false, error: 'Soal tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: detail });
    }

    const subjectId = searchParams.get('subjectId') || undefined;
    const teacherId = searchParams.get('teacherId') || undefined;
    const lifecycleStatus = searchParams.get('lifecycleStatus') || undefined;
    const type = (searchParams.get('type') as any) || undefined;
    const difficulty = (searchParams.get('difficulty') as any) || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.has('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const offset = searchParams.has('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined;

    const [{ questions, total }, subjects] = await Promise.all([
      SchoolQuestionService.listQuestions(schoolId, {
        subjectId,
        teacherId,
        lifecycleStatus,
        type,
        difficulty,
        search,
        limit,
        offset,
      }),
      SubjectService.listSubjects(schoolId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        questions,
        subjects,
        total,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat bank soal.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('questions.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const created = await SchoolQuestionService.createQuestion(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: 'Soal berhasil disimpan ke bank soal.',
      data: created,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal membuat butir soal.' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiPermission('questions.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { id, action, rejectionReason, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Soal diperlukan.' }, { status: 400 });
    }

    const actor = { id: auth.user.id, username: auth.user.username, role: auth.user.role };

    if (action === 'APPROVE' || action === 'REJECT' || action === 'ARCHIVE' || action === 'PUBLISH') {
      await SchoolQuestionService.moderateQuestion(schoolId, id, action, actor, rejectionReason);
      return NextResponse.json({ success: true, message: `Status soal berhasil diubah menjadi ${action}.` });
    }

    const updated = await SchoolQuestionService.updateQuestion(schoolId, id, data, actor);
    return NextResponse.json({
      success: true,
      message: 'Soal berhasil diperbarui (revisi baru tercatat).',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memperbarui butir soal.' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireApiPermission('questions.delete');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Soal diperlukan.' }, { status: 400 });
    }

    const res = await SchoolQuestionService.deleteQuestion(schoolId, id, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menghapus soal.' }, { status: 400 });
  }
}
