'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  Users,
  Calendar,
  Sparkles,
  ShieldCheck,
  DoorOpen,
  Clock,
  Shuffle,
  Filter,
  Check,
  UserCheck,
  ArrowRight,
  Maximize2,
  Printer,
  ChevronRight,
} from 'lucide-react';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import Pagination from '@/components/common/Pagination';

interface ExamRoom {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  capacity: number;
  proctorName: string;
  location: string;
  isActive: boolean;
  allocatedCount: number;
}

interface ParticipantAllocation {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  nisn: string;
  nis: string;
  className: string;
  token: string;
  assignedPackage: string;
  roomId: string | null;
  roomName: string;
  roomCode: string;
  sessionNumber: number;
  seatNumber: string;
}

interface ExamItem {
  id: string;
  title: string;
  status: string;
  start_time: string;
  end_time: string;
}

interface ProctorAssignment {
  id: string;
  examId: string;
  roomId: string;
  roomName: string;
  roomCode: string;
  sessionNumber: number;
  proctorId: string;
  proctorName: string;
  proctorUsername: string;
  notes: string;
}

export default function AdminRuangSesiPage() {
  const [activeTab, setActiveTab] = useState<'RUANG' | 'ALOKASI' | 'PENGAWAS'>('RUANG');
  const [rooms, setRooms] = useState<ExamRoom[]>([]);
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals for Room CRUD
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ExamRoom | null>(null);
  const [roomFormData, setRoomFormData] = useState({
    code: '',
    name: '',
    capacity: 30,
    proctorName: '',
    location: '',
  });
  const [deleteTargetRoom, setDeleteTargetRoom] = useState<ExamRoom | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);

  // State for Participant Allocations
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [participants, setParticipants] = useState<ParticipantAllocation[]>([]);
  const [allocationStats, setAllocationStats] = useState({ total: 0, allocated: 0, unallocated: 0 });
  const [filterRoom, setFilterRoom] = useState('');
  const [filterSession, setFilterSession] = useState('');
  const [allocationSearch, setAllocationSearch] = useState('');

  // Pagination for Allocations
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Auto-Distribution Modal
  const [showAutoDistModal, setShowAutoDistModal] = useState(false);
  const [autoDistRoomIds, setAutoDistRoomIds] = useState<string[]>([]);
  const [autoDistSessions, setAutoDistSessions] = useState(2);
  const [isDistributing, setIsDistributing] = useState(false);

  // Manual Participant Edit Modal
  const [editingParticipant, setEditingParticipant] = useState<ParticipantAllocation | null>(null);
  const [manualAllocForm, setManualAllocForm] = useState({
    roomId: '',
    sessionNumber: 1,
    seatNumber: '01',
  });

  // State for Proctor Assignments
  const [proctorAssignments, setProctorAssignments] = useState<ProctorAssignment[]>([]);
  const [availableProctors, setAvailableProctors] = useState<any[]>([]);
  const [showProctorModal, setShowProctorModal] = useState(false);
  const [proctorForm, setProctorForm] = useState({
    roomId: '',
    sessionNumber: 1,
    proctorId: '',
    notes: '',
  });

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Rooms
  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/admin/rooms');
      const json = await res.json();
      if (json.success && json.data) {
        setRooms(json.data.rooms || []);
        setTotalCapacity(json.data.totalCapacity || 0);
        if (autoDistRoomIds.length === 0 && json.data.rooms.length > 0) {
          setAutoDistRoomIds(json.data.rooms.map((r: ExamRoom) => r.id));
        }
      }
    } catch {
      showNotification('Gagal memuat data ruangan.', 'error');
    }
  };

  // Fetch Allocations
  const fetchAllocations = async (targetExamId?: string) => {
    const examToFetch = targetExamId || selectedExamId;
    try {
      let url = `/api/admin/room-allocations?`;
      const params = new URLSearchParams();
      if (examToFetch) params.set('examId', examToFetch);
      if (filterRoom) params.set('roomId', filterRoom);
      if (filterSession) params.set('sessionNumber', filterSession);

      const res = await fetch(url + params.toString());
      const json = await res.json();
      if (json.success && json.data) {
        setParticipants(json.data.participants || []);
        setAllocationStats(json.data.stats || { total: 0, allocated: 0, unallocated: 0 });
        setExams(json.data.exams || []);
        if (!selectedExamId && json.data.exams?.length > 0) {
          setSelectedExamId(json.data.exams[0].id);
        }
      }
    } catch {
      showNotification('Gagal memuat alokasi peserta.', 'error');
    }
  };

  // Fetch Proctors
  const fetchProctors = async (targetExamId?: string) => {
    const examToFetch = targetExamId || selectedExamId;
    if (!examToFetch) return;
    try {
      const res = await fetch(`/api/admin/room-proctors?examId=${examToFetch}`);
      const json = await res.json();
      if (json.success && json.data) {
        setProctorAssignments(json.data.assignments || []);
        setAvailableProctors(json.data.availableProctors || []);
      }
    } catch {
      showNotification('Gagal memuat data pengawas ruang.', 'error');
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchRooms();
      await fetchAllocations();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      fetchAllocations(selectedExamId);
      fetchProctors(selectedExamId);
    }
  }, [selectedExamId, filterRoom, filterSession]);

  // Handle Room CRUD
  const openCreateRoomModal = () => {
    setEditingRoom(null);
    setRoomFormData({
      code: `LAB-0${rooms.length + 1}`,
      name: `Lab Komputer ${rooms.length + 1}`,
      capacity: 30,
      proctorName: '',
      location: 'Gedung Lab Lantai 2',
    });
    setShowRoomModal(true);
  };

  const openEditRoomModal = (r: ExamRoom) => {
    setEditingRoom(r);
    setRoomFormData({
      code: r.code,
      name: r.name,
      capacity: r.capacity,
      proctorName: r.proctorName === '-' ? '' : r.proctorName,
      location: r.location === '-' ? '' : r.location,
    });
    setShowRoomModal(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingRoom ? 'PATCH' : 'POST';
      const body = editingRoom ? { id: editingRoom.id, ...roomFormData } : roomFormData;

      const res = await fetch('/api/admin/rooms', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        showNotification(json.message);
        setShowRoomModal(false);
        fetchRooms();
      } else {
        showNotification(json.error || 'Gagal menyimpan ruangan.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    }
  };

  const handleDeleteRoom = async () => {
    if (!deleteTargetRoom) return;
    setIsDeletingRoom(true);
    try {
      const res = await fetch(`/api/admin/rooms?id=${deleteTargetRoom.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showNotification(json.message);
        setDeleteTargetRoom(null);
        fetchRooms();
      } else {
        showNotification(json.error || 'Gagal menghapus ruangan.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsDeletingRoom(false);
    }
  };

  // Handle Auto-Distribute
  const handleRunAutoDistribute = async () => {
    if (!selectedExamId) {
      showNotification('Pilih ujian terlebih dahulu.', 'error');
      return;
    }
    if (autoDistRoomIds.length === 0) {
      showNotification('Pilih minimal satu ruangan/lab komputer.', 'error');
      return;
    }

    setIsDistributing(true);
    try {
      const res = await fetch('/api/admin/room-allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: selectedExamId,
          roomIds: autoDistRoomIds,
          sessionCount: autoDistSessions,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification(json.message);
        setShowAutoDistModal(false);
        fetchAllocations(selectedExamId);
      } else {
        showNotification(json.error || 'Gagal menjalankan distribusi otomatis.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsDistributing(false);
    }
  };

  // Handle Manual Participant Edit
  const openEditParticipantModal = (p: ParticipantAllocation) => {
    setEditingParticipant(p);
    setManualAllocForm({
      roomId: p.roomId || (rooms[0]?.id ?? ''),
      sessionNumber: p.sessionNumber || 1,
      seatNumber: p.seatNumber === '-' ? '01' : p.seatNumber,
    });
  };

  const handleSaveParticipantAlloc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParticipant) return;
    try {
      const res = await fetch('/api/admin/room-allocations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: editingParticipant.id,
          ...manualAllocForm,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification('Alokasi siswa berhasil diperbarui.');
        setEditingParticipant(null);
        fetchAllocations(selectedExamId);
      } else {
        showNotification(json.error || 'Gagal menyimpan.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    }
  };

  // Handle Proctor Assignment
  const handleAssignProctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId || !proctorForm.roomId || !proctorForm.proctorId) {
      showNotification('Lengkapi seluruh data penugasan.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/admin/room-proctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: selectedExamId,
          ...proctorForm,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification(json.message);
        setShowProctorModal(false);
        fetchProctors(selectedExamId);
      } else {
        showNotification(json.error || 'Gagal menyimpan penugasan.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    }
  };

  const handleDeleteProctor = async (assignmentId: string) => {
    if (!confirm('Hapus penugasan pengawas untuk sesi ini?')) return;
    try {
      const res = await fetch(`/api/admin/room-proctors?id=${assignmentId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showNotification(json.message);
        fetchProctors(selectedExamId);
      } else {
        showNotification(json.error || 'Gagal menghapus.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    }
  };

  // Filtered Participants
  const filteredParticipants = participants.filter((p) => {
    if (!allocationSearch.trim()) return true;
    const term = allocationSearch.toLowerCase();
    return (
      p.studentName.toLowerCase().includes(term) ||
      p.nisn.includes(term) ||
      p.className.toLowerCase().includes(term) ||
      p.roomName.toLowerCase().includes(term)
    );
  });

  const paginatedParticipants = filteredParticipants.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <AdminLayout>
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all animate-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="space-y-6">
        {/* Header Title */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <DoorOpen className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Manajemen Ruangan, Sesi & Alokasi Meja
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Atur kapasitas lab komputer, distribusi peserta ujian ke ruang & sesi, serta plotting pengawas ruang resmi.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {activeTab === 'RUANG' && (
              <button
                type="button"
                onClick={openCreateRoomModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Ruang / Lab Baru</span>
              </button>
            )}

            {activeTab === 'ALOKASI' && (
              <button
                type="button"
                onClick={() => setShowAutoDistModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                <Shuffle className="w-4 h-4" />
                <span>Auto-Distribusi Peserta (1-Klik)</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('RUANG')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'RUANG'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <DoorOpen className="w-4 h-4" />
            <span>1. Ruang Ujian & Lab Komputer ({rooms.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ALOKASI')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ALOKASI'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            <span>2. Alokasi Peserta & Nomor Meja</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PENGAWAS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'PENGAWAS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>3. Plotting Pengawas Ruang</span>
          </button>
        </div>

        {/* =========================================================
            TAB 1: DAFTAR RUANG UJIAN & LAB KOMPUTER
            ========================================================= */}
        {activeTab === 'RUANG' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Summary Banner */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <DoorOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900">{rooms.length} Ruangan</div>
                  <div className="text-xs font-medium text-slate-500">Lab Komputer Aktif</div>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900">{totalCapacity} Unit PC</div>
                  <div className="text-xs font-medium text-slate-500">Total Kapasitas Kursi</div>
                </div>
              </div>

              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-2xl font-black text-emerald-600">Siap Operasi</div>
                  <div className="text-xs font-medium text-slate-500">Kondisi Jaringan Normal</div>
                </div>
              </div>
            </div>

            {/* Room Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rooms.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:border-blue-300 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 font-mono">
                        {r.code}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditRoomModal(r)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
                          title="Edit Ruang"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetRoom(r)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                          title="Hapus Ruang"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-1">{r.name}</h3>
                    <p className="text-xs text-slate-500 mb-4">{r.location}</p>

                    <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Kapasitas Kursi/PC:</span>
                        <span className="font-bold text-slate-900">{r.capacity} Siswa</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Proktor / Teknisi:</span>
                        <span className="font-semibold text-slate-700">{r.proctorName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Alokasi Aktif:</span>
                        <span className="font-bold text-blue-600">{r.allocatedCount} Peserta</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: ALOKASI PESERTA & NOMOR MEJA
            ========================================================= */}
        {activeTab === 'ALOKASI' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Exam Selector & Stats */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 max-w-md">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pilih Jadwal Ujian yang Dikelola
                  </label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-bold text-slate-800"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.status})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stats Pills */}
                <div className="flex items-center gap-3">
                  <div className="bg-slate-50 rounded-2xl px-4 py-2 border border-slate-200 text-center">
                    <div className="text-base font-black text-slate-900">
                      {allocationStats.total}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">
                      Total Peserta
                    </div>
                  </div>

                  <div className="bg-emerald-50 rounded-2xl px-4 py-2 border border-emerald-200 text-center">
                    <div className="text-base font-black text-emerald-700">
                      {allocationStats.allocated}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-700 uppercase">
                      Teralokasi
                    </div>
                  </div>

                  <div className="bg-rose-50 rounded-2xl px-4 py-2 border border-rose-200 text-center">
                    <div className="text-base font-black text-rose-700">
                      {allocationStats.unallocated}
                    </div>
                    <div className="text-[10px] font-semibold text-rose-700 uppercase">
                      Belum Diatur
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-100">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={allocationSearch}
                    onChange={(e) => setAllocationSearch(e.target.value)}
                    placeholder="Cari nama siswa, NISN, atau kelas..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 text-slate-800"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={filterRoom}
                    onChange={(e) => setFilterRoom(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 text-slate-800 font-medium"
                  >
                    <option value="">Semua Ruangan</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterSession}
                    onChange={(e) => setFilterSession(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 text-slate-800 font-medium"
                  >
                    <option value="">Semua Sesi</option>
                    <option value="1">Sesi 1</option>
                    <option value="2">Sesi 2</option>
                    <option value="3">Sesi 3</option>
                    <option value="4">Sesi 4</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Participants Allocation Table */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/80 font-bold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5">No</th>
                      <th className="px-5 py-3.5">Nama Siswa</th>
                      <th className="px-5 py-3.5">NISN / Kelas</th>
                      <th className="px-5 py-3.5">Token Peserta</th>
                      <th className="px-5 py-3.5">Ruang Ujian</th>
                      <th className="px-5 py-3.5 text-center">Sesi</th>
                      <th className="px-5 py-3.5 text-center">No. Meja</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                          Tidak ada data peserta ditemukan.
                        </td>
                      </tr>
                    ) : (
                      paginatedParticipants.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-5 py-3.5 font-medium text-slate-400">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {p.studentName}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-mono text-slate-700">{p.nisn}</div>
                            <div className="text-[11px] text-slate-400">{p.className}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {p.token}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-semibold">
                            {p.roomId ? (
                              <span className="text-slate-800">{p.roomName}</span>
                            ) : (
                              <span className="text-rose-500 font-bold italic">Belum Diatur</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Sesi {p.sessionNumber}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center font-mono font-bold text-slate-900">
                            Meja {p.seatNumber}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => openEditParticipantModal(p)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            >
                              Ubah
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredParticipants.length > pageSize && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Menampilkan {(currentPage - 1) * pageSize + 1} -{' '}
                    {Math.min(currentPage * pageSize, filteredParticipants.length)} dari{' '}
                    {filteredParticipants.length} siswa
                  </span>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredParticipants.length / pageSize)}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3: PLOTTING PENGAWAS RUANG
            ========================================================= */}
        {activeTab === 'PENGAWAS' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Jadwal Ujian
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-bold text-slate-800"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  setProctorForm({
                    roomId: rooms[0]?.id ?? '',
                    sessionNumber: 1,
                    proctorId: availableProctors[0]?.id ?? '',
                    notes: 'Bertugas dengan tertib',
                  });
                  setShowProctorModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tugaskan Pengawas Ruang</span>
              </button>
            </div>

            {/* Assignments Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {proctorAssignments.length === 0 ? (
                <div className="sm:col-span-3 bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200">
                  Belum ada pengawas yang ditugaskan pada ujian ini. Klik &quot;Tugaskan Pengawas Ruang&quot; di atas.
                </div>
              ) : (
                proctorAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                          Sesi {a.sessionNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteProctor(a.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Hapus Penugasan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase mb-1">
                        <DoorOpen className="w-3.5 h-3.5" />
                        <span>{a.roomName} ({a.roomCode})</span>
                      </div>

                      <h3 className="text-base font-black text-slate-900 mb-1">
                        {a.proctorName}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mb-3">
                        @{a.proctorUsername}
                      </p>

                      <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl">
                        Catatan: {a.notes}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL: TAMBAH / EDIT RUANG
            ========================================================= */}
        {showRoomModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {editingRoom ? 'Edit Ruang Ujian / Lab' : 'Tambah Ruang Ujian / Lab Komputer'}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Informasi ruangan akan dicantumkan pada kartu peserta dan berita acara (BAPU).
              </p>

              <form onSubmit={handleSaveRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kode Ruang</label>
                  <input
                    type="text"
                    required
                    value={roomFormData.code}
                    onChange={(e) => setRoomFormData({ ...roomFormData, code: e.target.value })}
                    placeholder="Contoh: LAB-01"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Ruangan</label>
                  <input
                    type="text"
                    required
                    value={roomFormData.name}
                    onChange={(e) => setRoomFormData({ ...roomFormData, name: e.target.value })}
                    placeholder="Contoh: Lab Komputer 1"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kapasitas Kursi / PC Klien</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    required
                    value={roomFormData.capacity}
                    onChange={(e) => setRoomFormData({ ...roomFormData, capacity: parseInt(e.target.value, 10) || 30 })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Proktor / Teknisi Default</label>
                  <input
                    type="text"
                    value={roomFormData.proctorName}
                    onChange={(e) => setRoomFormData({ ...roomFormData, proctorName: e.target.value })}
                    placeholder="Contoh: Budi Santoso, S.Kom."
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi Gedung</label>
                  <input
                    type="text"
                    value={roomFormData.location}
                    onChange={(e) => setRoomFormData({ ...roomFormData, location: e.target.value })}
                    placeholder="Contoh: Gedung B Lantai 2"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowRoomModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition cursor-pointer"
                  >
                    Simpan Ruangan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL: AUTO-DISTRIBUSI PESERTA (1-KLIK)
            ========================================================= */}
        {showAutoDistModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Shuffle className="w-5 h-5" />
                <h3 className="text-base font-black text-slate-900">
                  Generator Auto-Distribusi Peserta Ujian
                </h3>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                Sistem akan membagi seluruh peserta ({allocationStats.total} siswa) secara berurutan ke dalam ruang dan sesi yang Anda pilih, serta menetapkan nomor meja secara otomatis.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Pilih Ruangan / Lab Komputer yang Digunakan:
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {rooms.map((r) => {
                      const checked = autoDistRoomIds.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                            checked ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAutoDistRoomIds([...autoDistRoomIds, r.id]);
                                } else {
                                  setAutoDistRoomIds(autoDistRoomIds.filter((id) => id !== r.id));
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-0"
                            />
                            <div>
                              <div className="text-xs font-bold text-slate-900">{r.name}</div>
                              <div className="text-[10px] text-slate-500">{r.code} • {r.location}</div>
                            </div>
                          </div>
                          <span className="text-xs font-extrabold text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                            {r.capacity} Kursi
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jumlah Sesi Ujian per Hari:
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[1, 2, 3].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setAutoDistSessions(s)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          autoDistSessions === s
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {s} Sesi ({s === 1 ? 'Sekaligus' : `${s} Gelombang`})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Capacity vs Need Calculation */}
                {(() => {
                  const selectedCap = rooms
                    .filter((r) => autoDistRoomIds.includes(r.id))
                    .reduce((acc, r) => acc + r.capacity, 0);
                  const totalCap = selectedCap * autoDistSessions;
                  const isEnough = totalCap >= allocationStats.total;

                  return (
                    <div
                      className={`p-3.5 rounded-2xl text-xs border ${
                        isEnough
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      <div className="font-bold mb-0.5">
                        {isEnough ? '✓ Kapasitas Mencukupi' : '⚠️ Kapasitas Kurang!'}
                      </div>
                      <div>
                        Total Kapasitas: <span className="font-black">{totalCap} Kursi</span> ({selectedCap} unit x {autoDistSessions} sesi) untuk <span className="font-black">{allocationStats.total} Peserta</span>.
                      </div>
                    </div>
                  );
                })()}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAutoDistModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleRunAutoDistribute}
                    disabled={isDistributing}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isDistributing ? 'Memproses...' : 'Mulai Distribusi Otomatis'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL: EDIT MANUAL ALOKASI SISWA
            ========================================================= */}
        {editingParticipant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Ubah Alokasi Meja Siswa
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                {editingParticipant.studentName} ({editingParticipant.className})
              </p>

              <form onSubmit={handleSaveParticipantAlloc} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ruang Ujian</label>
                  <select
                    value={manualAllocForm.roomId}
                    onChange={(e) => setManualAllocForm({ ...manualAllocForm, roomId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sesi Ujian</label>
                  <select
                    value={manualAllocForm.sessionNumber}
                    onChange={(e) => setManualAllocForm({ ...manualAllocForm, sessionNumber: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="1">Sesi 1</option>
                    <option value="2">Sesi 2</option>
                    <option value="3">Sesi 3</option>
                    <option value="4">Sesi 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Meja</label>
                  <input
                    type="text"
                    value={manualAllocForm.seatNumber}
                    onChange={(e) => setManualAllocForm({ ...manualAllocForm, seatNumber: e.target.value })}
                    placeholder="01"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-mono font-bold"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingParticipant(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition cursor-pointer"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================
            MODAL: TUGASKAN PENGAWAS RUANG
            ========================================================= */}
        {showProctorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Tugaskan Pengawas Ruang
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Nama pengawas ini otomatis dicetak di Berita Acara dan Daftar Hadir ruang terkait.
              </p>

              <form onSubmit={handleAssignProctor} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ruang Ujian</label>
                  <select
                    value={proctorForm.roomId}
                    onChange={(e) => setProctorForm({ ...proctorForm, roomId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sesi Ujian</label>
                  <select
                    value={proctorForm.sessionNumber}
                    onChange={(e) => setProctorForm({ ...proctorForm, sessionNumber: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="1">Sesi 1</option>
                    <option value="2">Sesi 2</option>
                    <option value="3">Sesi 3</option>
                    <option value="4">Sesi 4</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Guru / Pengawas</label>
                  <select
                    value={proctorForm.proctorId}
                    onChange={(e) => setProctorForm({ ...proctorForm, proctorId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    {availableProctors.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} (@{u.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Tugas</label>
                  <input
                    type="text"
                    value={proctorForm.notes}
                    onChange={(e) => setProctorForm({ ...proctorForm, notes: e.target.value })}
                    placeholder="Contoh: Mengawasi baris 1 s/d 30"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowProctorModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition cursor-pointer"
                  >
                    Simpan Penugasan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        <DeleteConfirmModal
          isOpen={!!deleteTargetRoom}
          onClose={() => setDeleteTargetRoom(null)}
          onConfirm={handleDeleteRoom}
          title="Hapus Ruang Ujian"
          itemName={deleteTargetRoom?.name || 'Ruangan'}
          description="Apakah Anda yakin ingin menghapus ruangan ini? Tindakan ini tidak dapat dibatalkan."
          isLoading={isDeletingRoom}
        />
      </div>
    </AdminLayout>
  );
}
