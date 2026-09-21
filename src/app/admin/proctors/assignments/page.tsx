'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import {
  ShieldCheck,
  Calendar,
  DoorOpen,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Users,
  Clock,
  Plus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface ExamItem {
  id: string;
  title: string;
  subjectName: string;
  durationMinutes: number;
}

interface RoomItem {
  id: string;
  name: string;
  code: string;
  capacity: number;
}

interface ProctorItem {
  id: string;
  fullName: string;
  username: string;
  nip?: string;
  phone?: string;
}

interface ProctorAssignment {
  id: string;
  exam_id: string;
  exam_title: string;
  room_id: string;
  room_name: string;
  room_code: string;
  session_number: number;
  proctor_id: string;
  proctor_name: string;
  proctor_nip?: string;
  notes?: string;
}

export default function ProctorAssignmentsPage() {
  const router = useRouter();

  // Wizard state
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [proctors, setProctors] = useState<ProctorItem[]>([]);
  const [assignments, setAssignments] = useState<ProctorAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Form selections
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedSessionNumber, setSelectedSessionNumber] = useState('1');
  const [selectedProctorId, setSelectedProctorId] = useState('');
  const [notes, setNotes] = useState('');

  // Conflict warning state
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [examsRes, roomsRes, proctorsRes, assignmentsRes] = await Promise.all([
        fetch('/api/admin/exams').then((r) => r.json()),
        fetch('/api/admin/exam-rooms').then((r) => r.json()),
        fetch('/api/admin/proctors').then((r) => r.json()),
        fetch('/api/admin/exam-proctors').then((r) => r.json()),
      ]);

      if (examsRes.success) setExams(examsRes.data.exams || []);
      if (roomsRes.success) setRooms(roomsRes.data || []);
      if (proctorsRes.success) setProctors(proctorsRes.data || []);
      if (assignmentsRes.success) setAssignments(assignmentsRes.data || []);
    } catch {
      showToast('Gagal memuat data penugasan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Conflict Check
  useEffect(() => {
    if (!selectedExamId || !selectedRoomId || !selectedProctorId) {
      setConflictWarning(null);
      return;
    }

    const sessionNum = parseInt(selectedSessionNumber, 10);

    // 1. Proctor Double Booking Check
    const proctorConflict = assignments.find(
      (a) =>
        a.proctor_id === selectedProctorId &&
        a.session_number === sessionNum &&
        (a.room_id !== selectedRoomId || a.exam_id !== selectedExamId)
    );

    if (proctorConflict) {
      setConflictWarning(
        `Konflik Jadwal: Pengawas terpilih sudah ditugaskan pada Sesi ${sessionNum} di ${proctorConflict.room_name} (${proctorConflict.exam_title}).`
      );
      return;
    }

    // 2. Room Overlap Check
    const roomConflict = assignments.find(
      (a) =>
        a.room_id === selectedRoomId &&
        a.session_number === sessionNum &&
        a.proctor_id !== selectedProctorId
    );

    if (roomConflict) {
      setConflictWarning(
        `Perhatian: Ruangan ${roomConflict.room_name} sudah diawasi oleh ${roomConflict.proctor_name} pada Sesi ${sessionNum}. Menetapkan pengawas ini akan menambahkan pengawas pendamping.`
      );
      return;
    }

    setConflictWarning(null);
  }, [selectedExamId, selectedRoomId, selectedSessionNumber, selectedProctorId, assignments]);

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/exam-proctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: selectedExamId,
          roomId: selectedRoomId,
          sessionNumber: parseInt(selectedSessionNumber, 10),
          proctorId: selectedProctorId,
          notes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Pengawas berhasil ditugaskan tanpa bentrok jadwal!');
        setSelectedProctorId('');
        setNotes('');
        loadData();
      } else {
        showToast(json.error || 'Gagal menugaskan pengawas.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const columns: ColumnDef<ProctorAssignment>[] = [
    {
      key: 'exam_title',
      header: 'Ujian & Sesi',
      cell: (row) => (
        <div>
          <span className="font-bold text-slate-900 text-xs block">{row.exam_title}</span>
          <span className="text-[10px] text-blue-600 font-semibold">Sesi {row.session_number}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'room_name',
      header: 'Ruang Ujian',
      cell: (row) => (
        <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
          <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
          {row.room_name} ({row.room_code})
        </span>
      ),
      sortable: true,
    },
    {
      key: 'proctor_name',
      header: 'Pengawas Bertugas',
      cell: (row) => (
        <div>
          <span className="font-bold text-slate-900 text-xs block">{row.proctor_name}</span>
          <span className="text-[10px] text-slate-400 font-mono">NIP: {row.proctor_nip || '—'}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status Penugasan',
      cell: () => (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Terkonfirmasi
        </span>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Penugasan Pengawas Ruang"
      subtitle="Alokasi pengawas ruang per sesi ujian dengan deteksi konflik jadwal otomatis"
      breadcrumbs={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Pengawas', href: '/admin/proctors' },
        { label: 'Penugasan' },
      ]}
      actions={
        <Link href="/admin/proctors">
          <Button variant="outline" size="sm" leftIcon={<Users className="w-4 h-4" />}>
            Daftar Pengawas
          </Button>
        </Link>
      }
    >
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all animate-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Assignment Wizard Form Card */}
        <Card className="border-blue-200 shadow-sm">
          <CardHeader className="bg-blue-50/50 border-b border-blue-100 py-4">
            <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Alur Penetapan Pengawas (Exam &rarr; Sesi &rarr; Ruang &rarr; Pengawas)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setConfirmOpen(true);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Exam */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    1. Pilih Paket Ujian <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                  >
                    <option value="">Pilih Ujian...</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Sesi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    2. Sesi Ujian <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedSessionNumber}
                    onChange={(e) => setSelectedSessionNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                  >
                    <option value="1">Sesi 1 (Pagi)</option>
                    <option value="2">Sesi 2 (Siang)</option>
                    <option value="3">Sesi 3 (Sore)</option>
                  </select>
                </div>

                {/* 3. Ruang */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    3. Ruang Ujian Lab <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                  >
                    <option value="">Pilih Ruang Lab...</option>
                    {rooms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({rm.capacity} Kursi)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Pengawas */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    4. Petugas Pengawas <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedProctorId}
                    onChange={(e) => setSelectedProctorId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                  >
                    <option value="">Pilih Pengawas...</option>
                    {proctors.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conflict Warning Alert Banner */}
              {conflictWarning && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-black">Peringatan Bentrok Jadwal / Konflik</strong>
                    <p className="mt-0.5">{conflictWarning}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  Sistem secara otomatis memverifikasi bentrok jam kerja pengawas di seluruh ruangan.
                </span>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!selectedExamId || !selectedRoomId || !selectedProctorId}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Tetapkan Pengawas
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Current Assignments Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">
              Daftar Penugasan Pengawas Aktif ({assignments.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={loadData}
            >
              Segarkan
            </Button>
          </div>

          <DataTable
            data={assignments}
            columns={columns}
            isLoading={loading}
            emptyTitle="Belum Ada Penugasan Pengawas"
            emptyDescription="Gunakan formulir di atas untuk menugaskan pengawas ruang pada sesi ujian."
            pageSize={10}
            itemName="penugasan"
          />
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSubmit}
        title="Konfirmasi Penugasan Pengawas"
        description={`Apakah Anda yakin ingin menugaskan pengawas ini ke Ruang Ujian pada Sesi ${selectedSessionNumber}? Pastikan tidak ada bentrok waktu yang tidak disengaja.`}
        confirmLabel={isSubmitting ? 'Menyimpan...' : 'Ya, Tetapkan'}
        cancelLabel="Batal"
        confirmVariant="primary"
        isLoading={isSubmitting}
      />
    </AdminLayout>
  );
}
