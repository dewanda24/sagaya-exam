import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { SchoolExamService } from '@/lib/services/school-exam.service';
import { SubjectService } from '@/lib/services/subject.service';
import { AcademicYearService } from '@/lib/services/academic-year.service';
import { ClassService } from '@/lib/services/class.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('exams.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const detail = await SchoolExamService.getExamById(schoolId, id);
      if (!detail) {
        return NextResponse.json({ success: false, error: 'Ujian tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: detail });
    }

    const status = (searchParams.get('status') as any) || undefined;
    const subjectId = searchParams.get('subjectId') || undefined;
    const academicYearId = searchParams.get('academicYearId') || undefined;
    const search = searchParams.get('search') || undefined;

    const [exams, subjects, years, classes] = await Promise.all([
      SchoolExamService.listExams(schoolId, { status, subjectId, academicYearId, search }),
      SubjectService.listSubjects(schoolId),
      AcademicYearService.listAcademicYears(schoolId),
      ClassService.listClasses(schoolId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        exams,
        subjects,
        academicYears: years,
        classes,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat ujian.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('exams.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const created = await SchoolExamService.createExam(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: `Ujian '${created.title}' berhasil dibuat.`,
      data: created,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal membuat ujian.' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiPermission('exams.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { id, action, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Ujian diperlukan.' }, { status: 400 });
    }

    const actor = { id: auth.user.id, username: auth.user.username, role: auth.user.role };

    if (action === 'PUBLISH_AND_LOCK') {
      const res = await SchoolExamService.publishAndLockExam(schoolId, id, actor);
      return NextResponse.json({
        success: true,
        message: `Ujian berhasil dipublish dan dikunci. ${res.totalSnapshotQuestions} soal dibekukan ke snapshot.`,
        data: res,
      });
    }

    const updated = await SchoolExamService.updateExam(schoolId, id, data, actor);
    return NextResponse.json({
      success: true,
      message: 'Ujian berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memperbarui ujian.' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireApiPermission('exams.archive');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Ujian diperlukan.' }, { status: 400 });
    }

    const res = await SchoolExamService.deleteExam(schoolId, id, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menghapus ujian.' }, { status: 400 });
  }
}
