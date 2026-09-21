import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/core/rbac';
import { ExamRoomService } from '@/lib/services/exam-room.service';

export async function GET(req: Request) {
  try {
    const auth = await requireApiPermission('rooms.read');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const detail = await ExamRoomService.getRoomById(schoolId, id);
      if (!detail) {
        return NextResponse.json({ success: false, error: 'Ruang tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: detail });
    }

    const rooms = await ExamRoomService.listRooms(schoolId);
    return NextResponse.json({ success: true, data: rooms });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memuat ruang ujian.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiPermission('rooms.create');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const created = await ExamRoomService.createRoom(schoolId, body, {
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
    });

    return NextResponse.json({
      success: true,
      message: `Ruang '${created.name}' berhasil dibuat.`,
      data: created,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal membuat ruang ujian.' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiPermission('rooms.update');
    if (!auth.authorized) return auth.response;

    const schoolId = auth.tenant.schoolId;
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'Konteks sekolah tidak ditemukan.' }, { status: 400 });
    }

    const body = await req.json();
    const { id, action, examId, roomId, sessionNumber, participantIds, ...data } = body;

    const actor = { id: auth.user.id, username: auth.user.username, role: auth.user.role };

    if (action === 'ALLOCATE_PARTICIPANTS') {
      if (!examId || !roomId || !sessionNumber || !participantIds || !Array.isArray(participantIds)) {
        return NextResponse.json(
          { success: false, error: 'examId, roomId, sessionNumber, dan participantIds (array) wajib diisi.' },
          { status: 400 }
        );
      }
      const res = await ExamRoomService.allocateParticipantsToRoom(
        schoolId,
        examId,
        roomId,
        sessionNumber,
        participantIds,
        actor
      );
      return NextResponse.json({
        success: true,
        message: `${res.allocatedCount} peserta berhasil diplot ke ruang ujian.`,
        data: res,
      });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Ruang diperlukan.' }, { status: 400 });
    }

    const updated = await ExamRoomService.updateRoom(schoolId, id, data, actor);
    return NextResponse.json({
      success: true,
      message: 'Data ruang ujian berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Gagal memperbarui ruang ujian.' }, { status: 400 });
  }
}
