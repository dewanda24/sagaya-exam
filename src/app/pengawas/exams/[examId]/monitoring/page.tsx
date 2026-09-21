'use client';

import { useState, useEffect, useCallback, use, Suspense } from 'react';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  DoorOpen,
  Users,
  Clock,
  Radio,
  Search,
  AlertTriangle,
  WifiOff,
  CheckCircle2,
  Lock,
  LogOut,
  RefreshCw,
  FileText,
  AlertCircle,
  PlusCircle,
  MoreVertical,
  ArrowLeft,
  X,
  Send,
  Zap,
  LayoutGrid,
  List,
  AlignJustify,
  ExternalLink,
  RotateCcw,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';

function ProctorLiveMonitoringContent({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryRoomId = searchParams.get('roomId') || '';

  const [examInfo, setExamInfo] = useState<any>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(queryRoomId);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [channelConnected, setChannelConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // View Mode: 'grid' | 'table' | 'compact'
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'compact'>('grid');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [connFilter, setConnFilter] = useState('ALL');

  // Countdown timer in seconds
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Modals
  const [noteModalParticipant, setNoteModalParticipant] = useState<any>(null);
  const [noteContent, setNoteContent] = useState('');
  const [revokeModalParticipant, setRevokeModalParticipant] = useState<any>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [endSessionParticipant, setEndSessionParticipant] = useState<any>(null);
  const [endSessionReason, setEndSessionReason] = useState('');
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyDuration, setEmergencyDuration] = useState(15);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch exam details to know assigned rooms
  useEffect(() => {
    async function loadExam() {
      try {
        const res = await fetch(`/api/proctor/exams/${examId}`);
        const json = await res.json();
        if (json.success) {
          setExamInfo(json.data);
          if (!selectedRoomId && json.data.assignedRooms?.length > 0) {
            setSelectedRoomId(json.data.assignedRooms[0].id);
          }
        }
      } catch (err) {
        console.error('Gagal mengambil data ujian:', err);
      }
    }
    loadExam();
  }, [examId, selectedRoomId]);

  // 2. Fetch monitoring data for selected room
  const fetchMonitoring = useCallback(async () => {
    if (!selectedRoomId) return;
    try {
      const res = await fetch(`/api/proctor/exams/${examId}/rooms/${selectedRoomId}/monitoring`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setRemainingSeconds(json.data.header?.remainingSeconds || 0);
        setChannelConnected(true);
        setLastUpdated(new Date().toLocaleTimeString('id-ID'));
      } else {
        setChannelConnected(false);
      }
    } catch {
      setChannelConnected(false);
    } finally {
      setLoading(false);
    }
  }, [examId, selectedRoomId]);

  // Polling loop
  useEffect(() => {
    fetchMonitoring();
    if (!autoRefresh || !selectedRoomId) return;
    const interval = setInterval(() => {
      fetchMonitoring();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchMonitoring, autoRefresh, selectedRoomId]);

  // Server countdown timer decrement
  useEffect(() => {
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Actions
  const handleResetDevice = async () => {
    if (!revokeModalParticipant || !selectedRoomId) return;
    setIsProcessing(true);
    try {
      const res = await fetch(
        `/api/proctor/exams/${examId}/rooms/${selectedRoomId}/revoke-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: revokeModalParticipant.participantId,
            reason: revokeReason || 'Reset sesi perangkat siswa oleh pengawas.',
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        showToast('Sesi perangkat berhasil direset. Siswa dapat login kembali pada perangkat baru.');
        setRevokeModalParticipant(null);
        setRevokeReason('');
        fetchMonitoring();
      } else {
        showToast(json.error || 'Gagal mereset sesi perangkat.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndSession = async () => {
    if (!endSessionParticipant || !selectedRoomId) return;
    if (!endSessionReason.trim()) {
      showToast('Alasan penghentian sesi wajib diisi demi audit.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(
        `/api/proctor/exams/${examId}/rooms/${selectedRoomId}/end-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: endSessionParticipant.participantId,
            reason: endSessionReason,
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        showToast('Sesi peserta berhasil dihentikan secara paksa.');
        setEndSessionParticipant(null);
        setEndSessionReason('');
        fetchMonitoring();
      } else {
        showToast(json.error || 'Gagal menghentikan sesi peserta.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteModalParticipant) return;
    if (!noteContent.trim()) {
      showToast('Isi catatan tidak boleh kosong.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/proctor/exams/${examId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: noteModalParticipant.participantId,
          roomId: selectedRoomId,
          content: noteContent,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Catatan pengawas berhasil disimpan.');
        setNoteModalParticipant(null);
        setNoteContent('');
      } else {
        showToast(json.error || 'Gagal menyimpan catatan.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat menyimpan catatan.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddEmergencyTime = async () => {
    if (!selectedRoomId) return;
    if (!emergencyReason.trim()) {
      showToast('Alasan penambahan waktu wajib dicantumkan.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(
        `/api/proctor/exams/${examId}/rooms/${selectedRoomId}/emergency-time`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            additionalMinutes: Number(emergencyDuration),
            reason: emergencyReason,
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        showToast(`Waktu ujian berhasil diperpanjang +${emergencyDuration} menit.`);
        setEmergencyModalOpen(false);
        setEmergencyReason('');
        fetchMonitoring();
      } else {
        showToast(json.error || 'Gagal menambah waktu darurat.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!selectedRoomId || !broadcastMessage.trim()) {
      showToast('Pesan siaran tidak boleh kosong.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(
        `/api/proctor/exams/${examId}/rooms/${selectedRoomId}/broadcast`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: broadcastMessage }),
        }
      );
      const json = await res.json();
      if (json.success) {
        showToast('Pesan siaran terkirim ke seluruh layar peserta di ruang ini.');
        setBroadcastModalOpen(false);
        setBroadcastMessage('');
      } else {
        showToast(json.error || 'Gagal mengirim pesan siaran.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat mengirim pesan.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const participantsList = data?.participants || [];
  const filtered = participantsList.filter((p: any) => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        p.studentName?.toLowerCase().includes(q) ||
        p.nis?.toLowerCase().includes(q) ||
        p.nisn?.toLowerCase().includes(q) ||
        p.seatNumber?.toString().includes(q);
      if (!match) return false;
    }
    if (statusFilter !== 'ALL' && p.sessionStatus !== statusFilter) return false;
    if (connFilter !== 'ALL' && p.connectionStatus !== connFilter) return false;
    return true;
  });

  const summary = data?.summary || {
    totalParticipants: participantsList.length,
    countOnline: 0,
    countRecentlyDisconnected: 0,
    countOffline: 0,
    countSubmitted: 0,
  };

  return (
    <PengawasLayout
      title={`Live Monitoring — ${data?.header?.room_name || 'Ruang Ujian'}`}
      subtitle="Radar pemantauan pengerjaan siswa, konektivitas, detak jantung sesi, dan kendali darurat."
      breadcrumbs={[
        { label: 'Dasbor', href: '/pengawas/dashboard' },
        { label: 'Ujian Aktif', href: '/pengawas/exams' },
        { label: data?.header?.exam_title || 'Detail Ujian', href: `/pengawas/exams/${examId}` },
        { label: 'Live Monitoring' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMonitoring}
            isLoading={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            {lastUpdated ? `Segarkan (${lastUpdated})` : 'Segarkan'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBroadcastModalOpen(true)}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            Siaran
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEmergencyModalOpen(true)}
            leftIcon={<Zap className="w-3.5 h-3.5 text-amber-600" />}
          >
            +Waktu Darurat
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Room Switcher Tabs (if multiple rooms assigned) */}
        {examInfo?.assignedRooms && examInfo.assignedRooms.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-500 shrink-0">Pilih Ruang:</span>
            {examInfo.assignedRooms.map((r: any) => (
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

        {/* Operational Header Card */}
        <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="info" size="sm">
                  {data?.header?.subject_name || 'Mata Pelajaran'}
                </Badge>
                <Badge variant={data?.header?.exam_status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
                  {data?.header?.exam_status || 'STATUS'}
                </Badge>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {data?.header?.exam_title} &bull; {data?.header?.room_name} ({data?.header?.room_code})
              </h2>
            </div>

            {/* Live Server Timer & Connection Status */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Sisa Waktu Ujian
                </span>
                <div className="text-2xl font-black font-mono text-emerald-700 tracking-tight">
                  {formatCountdown(remainingSeconds)}
                </div>
              </div>

              <div className="h-10 w-px bg-slate-200" />

              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Saluran Monitoring
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold mt-1">
                  {channelConnected ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-700">Terhubung</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="text-rose-700">Terputus</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Peserta</span>
              <div className="text-lg font-black text-slate-800">{summary.totalParticipants}</div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Online (Pengerjaan)</span>
              <div className="text-lg font-black text-emerald-800">{summary.countOnline}</div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70">
              <span className="text-[10px] font-bold text-amber-700 uppercase">Detak Jantung Lambat</span>
              <div className="text-lg font-black text-amber-800">{summary.countRecentlyDisconnected}</div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/70">
              <span className="text-[10px] font-bold text-rose-700 uppercase">Offline / Belum Masuk</span>
              <div className="text-lg font-black text-rose-800">{summary.countOffline}</div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/70">
              <span className="text-[10px] font-bold text-blue-700 uppercase">Selesai Submit</span>
              <div className="text-lg font-black text-blue-800">{summary.countSubmitted}</div>
            </div>
          </div>
        </Card>

        {/* Filter & View Switcher Bar */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama, NIS, meja..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">Semua Sesi</option>
                <option value="IN_PROGRESS">IN_PROGRESS (Mengerjakan)</option>
                <option value="NOT_STARTED">NOT_STARTED (Belum)</option>
                <option value="SUBMITTED">SUBMITTED (Selesai)</option>
                <option value="TERMINATED">TERMINATED (Dihentikan)</option>
              </select>

              {/* Connection Filter */}
              <select
                value={connFilter}
                onChange={(e) => setConnFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">Semua Koneksi</option>
                <option value="ONLINE">ONLINE</option>
                <option value="RECENTLY_DISCONNECTED">Detak Lambat</option>
                <option value="OFFLINE">OFFLINE</option>
              </select>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'grid' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Tampilan Grid Kartu"
                aria-label="Grid Mode"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'table' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Tampilan Tabel Lengkap"
                aria-label="Table Mode"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'compact' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Tampilan Kompak / Ramping"
                aria-label="Compact Mode"
              >
                <AlignJustify className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Card>

        {/* Participants Content Canvas */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-white border border-slate-200" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <>
            {/* VIEW MODE: GRID CARDS */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((p: any) => {
                  const isOnline = p.connectionStatus === 'ONLINE';
                  const isWarning = p.connectionStatus === 'RECENTLY_DISCONNECTED';
                  const totalQ = data?.header?.total_questions || 40;
                  const percent = Math.min(100, Math.round(((p.answeredCount || 0) / totalQ) * 100));

                  return (
                    <Card
                      key={p.participantId}
                      className="p-4 bg-white border-slate-200 hover:border-emerald-300 transition shadow-2xs flex flex-col justify-between space-y-3"
                    >
                      <div>
                        {/* Header: Name & Seat */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 truncate" title={p.studentName}>
                              {p.studentName}
                            </h3>
                            <div className="text-[11px] text-slate-500 font-mono truncate">
                              Meja {p.seatNumber || '-'} &bull; {p.className || '-'}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                isOnline
                                  ? 'bg-emerald-500 animate-pulse'
                                  : isWarning
                                  ? 'bg-amber-500'
                                  : 'bg-slate-300'
                              }`}
                              title={p.connectionStatus}
                            />
                            <span className="text-[10px] font-bold text-slate-600">
                              {isOnline ? 'Online' : isWarning ? 'Lambat' : 'Offline'}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar & Questions Count */}
                        <div className="pt-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span className="font-semibold">Progres Terjawab</span>
                            <span className="font-bold text-slate-800">
                              {p.answeredCount || 0} / {totalQ} ({percent}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {/* Session & Violations */}
                        <div className="pt-2.5 flex items-center justify-between text-[11px]">
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

                          {p.tabViolationCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              {p.tabViolationCount} Tab
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">0 Pelanggaran</span>
                          )}
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                        <Link
                          href={`/pengawas/exams/${examId}/participants/${p.participantId}`}
                          className="flex-1"
                        >
                          <Button variant="outline" size="sm" className="w-full text-[11px] py-1">
                            Detail
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[11px] py-1 px-2 text-slate-600"
                          onClick={() => {
                            setNoteModalParticipant(p);
                            setNoteContent('');
                          }}
                          title="Tambah Catatan"
                        >
                          Catatan
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[11px] py-1 px-2 text-amber-700 hover:bg-amber-50"
                          onClick={() => {
                            setRevokeModalParticipant(p);
                            setRevokeReason('');
                          }}
                          title="Reset Sesi Perangkat"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[11px] py-1 px-2 text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            setEndSessionParticipant(p);
                            setEndSessionReason('');
                          }}
                          title="Hentikan Sesi Paksa"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* VIEW MODE: TABLE */}
            {viewMode === 'table' && (
              <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Nama Siswa</th>
                        <th className="py-3 px-4">NIS / Meja</th>
                        <th className="py-3 px-4">Koneksi</th>
                        <th className="py-3 px-4">Status Sesi</th>
                        <th className="py-3 px-4">Progres Soal</th>
                        <th className="py-3 px-4">Pelanggaran</th>
                        <th className="py-3 px-4 text-right">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((p: any) => {
                        const isOnline = p.connectionStatus === 'ONLINE';
                        const isWarning = p.connectionStatus === 'RECENTLY_DISCONNECTED';
                        const totalQ = data?.header?.total_questions || 40;
                        const percent = Math.min(100, Math.round(((p.answeredCount || 0) / totalQ) * 100));

                        return (
                          <tr key={p.participantId} className="hover:bg-slate-50/70 transition">
                            <td className="py-3 px-4 font-bold text-slate-900">{p.studentName}</td>
                            <td className="py-3 px-4 font-mono text-slate-500">
                              {p.nis || '-'} &bull; Meja {p.seatNumber || '-'}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                                  isOnline
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : isWarning
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isOnline ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-slate-400'
                                  }`}
                                />
                                {isOnline ? 'Online' : isWarning ? 'Lambat' : 'Offline'}
                              </span>
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
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-600 rounded-full"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <span className="font-semibold text-slate-800">
                                  {p.answeredCount || 0}/{totalQ}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {p.tabViolationCount > 0 ? (
                                <Badge variant="warning" size="sm">
                                  {p.tabViolationCount} Tab
                                </Badge>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <Link href={`/pengawas/exams/${examId}/participants/${p.participantId}`}>
                                  <Button variant="outline" size="sm" className="text-[11px] py-1">
                                    Detail
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-[11px] py-1 text-amber-700"
                                  onClick={() => {
                                    setRevokeModalParticipant(p);
                                    setRevokeReason('');
                                  }}
                                  title="Reset Perangkat"
                                >
                                  Reset
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-[11px] py-1 text-rose-700"
                                  onClick={() => {
                                    setEndSessionParticipant(p);
                                    setEndSessionReason('');
                                  }}
                                  title="Hentikan Sesi"
                                >
                                  Hentikan
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* VIEW MODE: COMPACT */}
            {viewMode === 'compact' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                {filtered.map((p: any) => {
                  const isOnline = p.connectionStatus === 'ONLINE';
                  const totalQ = data?.header?.total_questions || 40;
                  const percent = Math.min(100, Math.round(((p.answeredCount || 0) / totalQ) * 100));

                  return (
                    <Card
                      key={p.participantId}
                      className="p-3 bg-white border-slate-200 hover:border-emerald-300 transition shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500">
                          Meja {p.seatNumber || '-'}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                          }`}
                        />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 truncate" title={p.studentName}>
                        {p.studentName}
                      </h4>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {p.answeredCount || 0}/{totalQ} ({percent}%)
                      </div>
                      <div className="pt-1 flex items-center justify-between">
                        <Badge
                          variant={p.sessionStatus === 'IN_PROGRESS' ? 'success' : 'neutral'}
                          size="sm"
                          className="text-[9px] px-1 py-0"
                        >
                          {p.sessionStatus || 'IDLE'}
                        </Badge>
                        <Link
                          href={`/pengawas/exams/${examId}/participants/${p.participantId}`}
                          className="text-[10px] font-bold text-emerald-700 hover:underline"
                        >
                          Detail →
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <Card className="p-12 text-center bg-white border-slate-200">
            <EmptyState
              title="Tidak ada peserta yang cocok"
              description="Tidak ditemukan peserta dengan filter atau kata kunci yang Anda masukkan."
              actionLabel="Reset Filter"
              onAction={() => {
                setSearch('');
                setStatusFilter('ALL');
                setConnFilter('ALL');
              }}
            />
          </Card>
        )}

        {/* MODAL 1: Reset Perangkat Sesi */}
        <Modal
          isOpen={Boolean(revokeModalParticipant)}
          onClose={() => setRevokeModalParticipant(null)}
          title="Reset Sesi Perangkat Siswa"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Pemberitahuan Audit Tindakan
              </div>
              <p>
                Tindakan ini menghapus pengikatan sidik jari perangkat (fingerprint) dan IP saat ini dari sesi peserta{' '}
                <strong>{revokeModalParticipant?.studentName}</strong>. Gunakan jika komputer siswa mati, restart, atau rusak.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Alasan Reset Perangkat (Wajib Audit):
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Komputer klien restart tiba-tiba, berganti ke PC cadangan..."
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRevokeModalParticipant(null)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleResetDevice}
                isLoading={isProcessing}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Konfirmasi Reset Perangkat
              </Button>
            </div>
          </div>
        </Modal>

        {/* MODAL 2: Hentikan Sesi / Force Logout */}
        <Modal
          isOpen={Boolean(endSessionParticipant)}
          onClose={() => setEndSessionParticipant(null)}
          title="Hentikan Sesi Ujian Siswa Secara Paksa"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Tindakan Darurat Beresiko Tinggi
              </div>
              <p>
                Anda akan mengakhiri sesi peserta <strong>{endSessionParticipant?.studentName}</strong> secara paksa. Siswa akan langsung dikeluarkan dari ujian dan sesi ditandai TERMINATED.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Alasan Penghentian Sesi (Wajib Diisi):
              </label>
              <textarea
                rows={3}
                placeholder="Tuliskan alasan pelanggaran berat atau instruksi penghentian..."
                value={endSessionReason}
                onChange={(e) => setEndSessionReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEndSessionParticipant(null)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleEndSession}
                isLoading={isProcessing}
                disabled={!endSessionReason.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Ya, Hentikan Sesi Peserta
              </Button>
            </div>
          </div>
        </Modal>

        {/* MODAL 3: Tambah Waktu Darurat Ruang */}
        <Modal
          isOpen={emergencyModalOpen}
          onClose={() => setEmergencyModalOpen(false)}
          title="Tambah Waktu Darurat Ruang Ujian"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Menambahkan durasi ujian server bagi seluruh peserta di ruang{' '}
              <strong>{data?.header?.room_name}</strong> karena kendala teknis (listrik padam, gangguan internet ruang).
            </p>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Pilih Durasi Tambahan:</label>
              <select
                value={emergencyDuration}
                onChange={(e) => setEmergencyDuration(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                <option value={5}>+5 Menit</option>
                <option value={10}>+10 Menit</option>
                <option value={15}>+15 Menit</option>
                <option value={20}>+20 Menit</option>
                <option value={30}>+30 Menit</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Alasan Penambahan Waktu:</label>
              <textarea
                rows={3}
                placeholder="Contoh: Terjadi kendala pemadaman listrik selama 15 menit..."
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEmergencyModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddEmergencyTime}
                isLoading={isProcessing}
                disabled={!emergencyReason.trim()}
              >
                Terapkan Penambahan Waktu
              </Button>
            </div>
          </div>
        </Modal>

        {/* MODAL 4: Catatan Pengawas */}
        <Modal
          isOpen={Boolean(noteModalParticipant)}
          onClose={() => setNoteModalParticipant(null)}
          title={`Catatan Pengawas — ${noteModalParticipant?.studentName}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Tambahkan catatan pengawasan khusus untuk peserta ini. Catatan disimpan ke server dan tercatat pada audit trail ujian.
            </p>

            <div>
              <textarea
                rows={4}
                placeholder="Tuliskan catatan kejadian atau pengamatan khusus..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setNoteModalParticipant(null)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveNote}
                isLoading={isProcessing}
                disabled={!noteContent.trim()}
              >
                Simpan Catatan
              </Button>
            </div>
          </div>
        </Modal>

        {/* MODAL 5: Siaran Pesan Ruang */}
        <Modal
          isOpen={broadcastModalOpen}
          onClose={() => setBroadcastModalOpen(false)}
          title="Kirim Pesan Siaran ke Ruang Ujian"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Pesan ini akan tampil langsung sebagai banner pop-up pada layar ujian seluruh siswa di ruang{' '}
              <strong>{data?.header?.room_name}</strong>.
            </p>

            <div>
              <textarea
                rows={3}
                placeholder="Contoh: Perhatian, waktu ujian tersisa 15 menit lagi. Mohon periksa kembali jawaban Anda..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setBroadcastModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendBroadcast}
                isLoading={isProcessing}
                disabled={!broadcastMessage.trim()}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Kirim Siaran
              </Button>
            </div>
          </div>
        </Modal>

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

export default function ProctorLiveMonitoringPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 text-xs">Memuat Live Monitoring...</div>}>
      <ProctorLiveMonitoringContent params={params} />
    </Suspense>
  );
}
