'use client';

import { useState, useEffect, useCallback, use, Suspense } from 'react';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Search,
  Check,
  DoorOpen,
  Radio,
  UserCheck,
  UserX,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

function ProctorAttendanceContent({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const searchParams = useSearchParams();
  const initialRoomId = searchParams.get('roomId') || '';

  const [examData, setExamData] = useState<any>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Fetch exam & assigned rooms
  useEffect(() => {
    async function loadExam() {
      try {
        const res = await fetch(`/api/proctor/exams/${examId}`);
        const json = await res.json();
        if (json.success) {
          setExamData(json.data);
          if (!selectedRoomId && json.data.assignedRooms && json.data.assignedRooms.length > 0) {
            setSelectedRoomId(json.data.assignedRooms[0].id);
          }
        }
      } catch (err) {
        console.error('Gagal memuat ujian:', err);
      }
    }
    loadExam();
  }, [examId, selectedRoomId]);

  // 2. Fetch attendance for selected room
  const fetchAttendance = useCallback(async () => {
    if (!selectedRoomId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/proctor/exams/${examId}/attendance?roomId=${selectedRoomId}`);
      const json = await res.json();
      if (json.success) {
        setParticipants(json.data || []);
      } else {
        showToast(json.error || 'Gagal memuat daftar presensi.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [examId, selectedRoomId]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // 3. Update attendance
  const handleUpdateStatus = async (participantId: string, status: string) => {
    setUpdatingId(participantId);
    try {
      const res = await fetch(`/api/proctor/exams/${examId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selectedRoomId,
          participantId,
          status,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setParticipants((prev) =>
          prev.map((p) => (p.participantId === participantId ? { ...p, attendanceStatus: status } : p))
        );
        showToast('Presensi berhasil diperbarui.');
      } else {
        showToast(json.error || 'Gagal memperbarui presensi.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat menyimpan presensi.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = participants.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.studentName?.toLowerCase().includes(q) ||
      p.nis?.toLowerCase().includes(q) ||
      p.nisn?.toLowerCase().includes(q)
    );
  });

  const presentCount = participants.filter((p) => p.attendanceStatus === 'PRESENT').length;
  const absentCount = participants.filter((p) => p.attendanceStatus === 'ABSENT').length;
  const lateCount = participants.filter((p) => p.attendanceStatus === 'LATE').length;
  const excusedCount = participants.filter((p) => p.attendanceStatus === 'EXCUSED').length;

  return (
    <PengawasLayout
      title="Presensi Peserta Ujian"
      subtitle="Pencatatan status kehadiran resmi peserta per ruang pengawasan."
      breadcrumbs={[
        { label: 'Dasbor', href: '/pengawas/dashboard' },
        { label: 'Ujian Aktif', href: '/pengawas/exams' },
        { label: examData?.exam?.title || 'Detail Ujian', href: `/pengawas/exams/${examId}` },
        { label: 'Presensi' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAttendance}
            isLoading={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Segarkan
          </Button>
          <Link href={`/pengawas/exams/${examId}/monitoring`}>
            <Button variant="primary" size="sm" leftIcon={<Radio className="w-3.5 h-3.5" />}>
              Live Monitoring
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Room Switcher Tabs (if multiple rooms assigned) */}
        {examData?.assignedRooms && examData.assignedRooms.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-500 shrink-0">Pilih Ruang:</span>
            {examData.assignedRooms.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoomId(r.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border whitespace-nowrap flex items-center gap-1.5 ${
                  selectedRoomId === r.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5" />
                {r.name} ({r.code})
              </button>
            ))}
          </div>
        )}

        {/* Attendance Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 bg-white border-slate-200 hover:border-emerald-300 transition shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Hadir (PRESENT)</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{presentCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Siswa hadir di ruangan</div>
          </Card>

          <Card className="p-4 bg-white border-slate-200 hover:border-rose-300 transition shadow-2xs">
            <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Alpa (ABSENT)</div>
            <div className="text-2xl font-black text-rose-700 mt-1">{absentCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Tidak hadir tanpa izin</div>
          </Card>

          <Card className="p-4 bg-white border-slate-200 hover:border-amber-300 transition shadow-2xs">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Terlambat (LATE)</div>
            <div className="text-2xl font-black text-amber-700 mt-1">{lateCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Hadir melewati jadwal mulai</div>
          </Card>

          <Card className="p-4 bg-white border-slate-200 hover:border-blue-300 transition shadow-2xs">
            <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Izin (EXCUSED)</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{excusedCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Dispensasi resmi / sakit</div>
          </Card>
        </div>

        {/* Search Input Bar */}
        <Card className="p-3.5 bg-white border-slate-200 shadow-2xs flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Cari nama, NIS, atau NISN peserta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </Card>

        {/* Attendance Table */}
        <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-12">No</th>
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">NIS / NISN</th>
                  <th className="py-3 px-4">Kelas & Meja</th>
                  <th className="py-3 px-4 text-center">Status Kehadiran</th>
                  <th className="py-3 px-4">Status Sesi CBT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length > 0 ? (
                  filtered.map((p, idx) => (
                    <tr key={p.participantId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{p.studentName}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {p.nis || '-'} / {p.nisn || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{p.className}</span>
                        <span className="text-slate-400 ml-2">Meja {p.seatNumber || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                          <button
                            disabled={updatingId === p.participantId}
                            onClick={() => handleUpdateStatus(p.participantId, 'PRESENT')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                              p.attendanceStatus === 'PRESENT'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            Hadir
                          </button>
                          <button
                            disabled={updatingId === p.participantId}
                            onClick={() => handleUpdateStatus(p.participantId, 'LATE')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                              p.attendanceStatus === 'LATE'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            Terlambat
                          </button>
                          <button
                            disabled={updatingId === p.participantId}
                            onClick={() => handleUpdateStatus(p.participantId, 'EXCUSED')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                              p.attendanceStatus === 'EXCUSED'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            Izin
                          </button>
                          <button
                            disabled={updatingId === p.participantId}
                            onClick={() => handleUpdateStatus(p.participantId, 'ABSENT')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                              p.attendanceStatus === 'ABSENT'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                            }`}
                          >
                            Alpa
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            p.sessionStatus === 'IN_PROGRESS'
                              ? 'success'
                              : p.sessionStatus === 'SUBMITTED'
                              ? 'info'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {p.sessionStatus || 'NOT_STARTED'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                      Tidak ada peserta terdaftar untuk kriteria ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Floating Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </PengawasLayout>
  );
}

export default function ProctorAttendancePage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 text-xs">Memuat Presensi Ujian...</div>}>
      <ProctorAttendanceContent params={params} />
    </Suspense>
  );
}
