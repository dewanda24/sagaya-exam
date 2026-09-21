import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamParticipantService } from '@/lib/services/exam-participant.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiPermission('participants.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { id: examId } = await params;
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId') || undefined;
    const roomId = searchParams.get('roomId') || undefined;
    const search = searchParams.get('search') || undefined;

    const participants = await ExamParticipantService.listParticipants(schoolId, examId, { classId, roomId, search });
    return NextResponse.json({ success: true, data: participants });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat peserta ujian.' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiPermission('participants.assign');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { id: examId } = await params;
    const body = await req.json();
    const { mode, classIds, studentIds } = body;

    const actor = { id: auth.user.id, username: auth.user.username, role: auth.user.role };

    if (mode === 'BY_CLASS') {
      if (!classIds || !Array.isArray(classIds)) {
        return NextResponse.json({ success: false, error: 'classIds (array) wajib diisi.' }, { status: 400 });
      }
      const res = await ExamParticipantService.assignParticipantsByClass(schoolId, examId, classIds, actor);
      return NextResponse.json({
        success: true,
        message: `${res.assignedCount} peserta berhasil ditugaskan ke ujian.`,
        data: res,
      });
    }

    if (mode === 'INDIVIDUAL') {
      if (!studentIds || !Array.isArray(studentIds)) {
        return NextResponse.json({ success: false, error: 'studentIds (array) wajib diisi.' }, { status: 400 });
      }
      const res = await ExamParticipantService.assignIndividualStudents(schoolId, examId, studentIds, actor);
      return NextResponse.json({
        success: true,
        message: `${res.assignedCount} peserta berhasil ditugaskan ke ujian.`,
        data: res,
      });
    }

    return NextResponse.json({ success: false, error: 'Mode penugasan harus BY_CLASS atau INDIVIDUAL.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menugaskan peserta ujian.' }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiPermission('participants.remove');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get('participantId');

    if (!participantId) {
      return NextResponse.json({ success: false, error: 'participantId wajib diisi.' }, { status: 400 });
    }

    await ExamParticipantService.removeParticipant(schoolId, participantId, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({ success: true, message: 'Peserta berhasil dikeluarkan dari ujian.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal menghapus peserta ujian.' }, { status: 400 });
  }
}
