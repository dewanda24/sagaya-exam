'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Award,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Edit3,
  TrendingUp,
  Clock,
  Sparkles,
  BookOpen,
  Calendar,
  Building2,
  Check,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  ShieldCheck,
  Percent,
  RefreshCw,
  Send,
  Slash,
  Eye,
  X,
} from 'lucide-react';

interface ParticipantItem {
  participantId: string;
  studentId: string;
  studentName: string;
  nisn: string;
  nis: string;
  gender: string;
  className: string;
  sessionId: string;
  sessionStatus: string;
  startedAt: string | null;
  submittedAt: string | null;
  resultId: string | null;
  rawScore: number | null;
  maxScore: number | null;
  finalScore: number | null;
  percentage: number | null;
  isPassed: boolean | null;
  status: string;
  gradedAt: string | null;
  publishedAt: string | null;
}

export default function AdminResultsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Memuat modul hasil ujian...</div>}>
      <AdminResultsContent />
    </Suspense>
  );
}

function AdminResultsContent() {
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [examMeta, setExamMeta] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal State for Result Correction
  const [correctModal, setCorrectModal] = useState<{
    open: boolean;
    resultId: string;
    studentName: string;
    currentScore: number;
  } | null>(null);
  const [newScoreVal, setNewScoreVal] = useState<number>(0);
  const [correctionReason, setCorrectionReason] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);

  // Modal State for Void
  const [voidModal, setVoidModal] = useState<{
    open: boolean;
    resultId: string;
    studentName: string;
  } | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [savingVoid, setSavingVoid] = useState(false);

  // Action status message
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchResults = async (targetExamId?: string) => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/admin/results';
      const params = new URLSearchParams();
      if (targetExamId) params.append('examId', targetExamId);
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const json = await res.json();

      if (json.success) {
        setExams(json.data?.exams || []);
        setExamMeta(json.data?.exam || null);
        setStatistics(json.data?.statistics || null);
        setParticipants(json.data?.participants || []);
        if (json.data?.exam?.id && !selectedExamId) {
          setSelectedExamId(json.data.exam.id);
        }
      } else {
        setError(json.error || 'Gagal memuat hasil ujian.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults(selectedExamId);
  }, [selectedExamId, statusFilter]);

  const handleReview = async (resultId: string) => {
    try {
      const res = await fetch(`/api/admin/results/${resultId}/review`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setActionMsg('Hasil ujian berhasil disetujui (REVIEWED).');
        fetchResults(selectedExamId);
      } else {
        alert(json.error || 'Gagal melakukan review hasil.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    }
  };

  const handlePublish = async (resultId: string) => {
    try {
      const res = await fetch(`/api/admin/results/${resultId}/publish`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setActionMsg('Hasil ujian berhasil dipublikasikan ke siswa (PUBLISHED).');
        fetchResults(selectedExamId);
      } else {
        alert(json.error || 'Gagal mempublikasikan hasil.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    }
  };

  const handleBatchPublish = async () => {
    if (!selectedExamId) return;
    if (!confirm('Apakah Anda yakin ingin mempublikasikan seluruh hasil ujian yang siap terbit?')) return;
    try {
      const res = await fetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: selectedExamId }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMsg(json.message || 'Seluruh hasil ujian berhasil dipublikasikan.');
        fetchResults(selectedExamId);
      } else {
        alert(json.error || 'Gagal mempublikasikan hasil.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    }
  };

  const handleRegradeExam = async () => {
    if (!selectedExamId) return;
    const reason = prompt('Masukkan alasan pelaksanaan regrading massal:');
    if (!reason || !reason.trim()) return;

    try {
      const res = await fetch('/api/admin/results/regrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId: selectedExamId, reason: reason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMsg(json.message);
        fetchResults(selectedExamId);
      } else {
        alert(json.error || 'Gagal menjalankan regrading.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    }
  };

  const handleOpenCorrectModal = (p: ParticipantItem) => {
    if (!p.resultId) {
      alert('Peserta belum memiliki rekap hasil ujian (belum submit atau dinilai).');
      return;
    }
    setCorrectModal({
      open: true,
      resultId: p.resultId,
      studentName: p.studentName,
      currentScore: p.finalScore || 0,
    });
    setNewScoreVal(p.finalScore || 0);
    setCorrectionReason('');
  };

  const submitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctModal) return;
    if (!correctionReason.trim()) {
      alert('Alasan koreksi nilai wajib diisi.');
      return;
    }

    setSavingCorrection(true);
    try {
      const res = await fetch(`/api/admin/results/${correctModal.resultId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newScore: Number(newScoreVal),
          reason: correctionReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMsg('Nilai ujian berhasil dikoreksi dan tercatat pada audit jejak rekam.');
        setCorrectModal(null);
        fetchResults(selectedExamId);
      } else {
        alert(json.error || 'Gagal mengoreksi nilai.');
      }
    } catch {
      alert('Terjadi kesalahan sistem.');
    } finally {
      setSavingCorrection(false);
    }
  };

  const handleOpenVoidModal = (p: ParticipantItem) => {
    if (!p.resultId) return;
    setVoidModal({
      open: true,
      resultId: p.resultId,
      studentName: p.studentName,
    });
    setVoidReason('');
  };

  const submitVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidModal) return;
    if (!voidReason.trim()) {
      alert('Alasan pembatalan nilai (VOID) wajib diisi.');
      return;
    }

    setSavingVoid(true);
    try {
      const res = await fetch(`/api/admin/results/${voidModal.resultId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMsg('Hasil ujian berhasil dibatalkan (VOID).');
        setVoidModal(null);
        fetchResults(selectedExamId);
      } else {
        alert(json.error || 'Gagal membatalkan hasil.');
      }
    } catch {
      alert('Terjadi kesalahan sistem.');
    } finally {
      setSavingVoid(false);
    }
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    if (!selectedExamId) return;
    window.open(`/api/admin/results/export?examId=${selectedExamId}&format=${format}`, '_blank');
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <Award className="w-7 h-7 text-emerald-600" /> Hasil Ujian & Publikasi Nilai
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Pusat kendali penilaian server-authoritative, audit koreksi nilai, review, dan publikasi rapor ujian.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRegradeExam}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className="w-4 h-4 text-amber-500" /> Regrade Ujian
            </button>

            <button
              type="button"
              onClick={handleBatchPublish}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <Send className="w-4 h-4" /> Publikasikan Semua
            </button>

            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => handleExport('xlsx')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel
              </button>
              <button
                type="button"
                onClick={() => handleExport('csv')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" /> CSV
              </button>
            </div>
          </div>
        </div>

        {/* Action message */}
        {actionMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{actionMsg}</span>
            </div>
            <button type="button" onClick={() => setActionMsg(null)}>
              <X className="w-4 h-4 text-emerald-600" />
            </button>
          </div>
        )}

        {/* Exam Selection & Filters */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[240px]">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Pilih Ujian:
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({ex.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Status Hasil:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="">Semua Status</option>
                <option value="PENDING">PENDING</option>
                <option value="PARTIALLY_GRADED">PARTIALLY GRADED</option>
                <option value="GRADED">GRADED</option>
                <option value="REVIEWED">REVIEWED</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="VOID">VOID</option>
              </select>
            </div>
          </div>

          <div className="w-full sm:w-64">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Cari Siswa:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchResults(selectedExamId)}
                placeholder="Nama atau NISN..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Peserta</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {statistics.totalParticipants}
              </div>
              <span className="text-[11px] text-slate-500">Ternilai: {statistics.scoredParticipants}</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rata-Rata Nilai</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {statistics.averageScore}
              </div>
              <span className="text-[11px] text-slate-500">KKM: {examMeta?.passingGrade || 75}</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tertinggi / Terendah</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {statistics.highestScore} / {statistics.lowestScore}
              </div>
              <span className="text-[11px] text-slate-500">Rentang skor</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tingkat Kelulusan</span>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                {statistics.passedRate}%
              </div>
              <span className="text-[11px] text-slate-500">{statistics.passedCount} Siswa Lulus</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status Publikasi</span>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                {statistics.statusCounts?.published || 0}
              </div>
              <span className="text-[11px] text-slate-500">
                Graded: {statistics.statusCounts?.graded || 0}
              </span>
            </div>
          </div>
        )}

        {/* Participants Table */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Peserta</th>
                  <th className="p-4">Kelas</th>
                  <th className="p-4 text-center">Status Sesi</th>
                  <th className="p-4 text-right">Nilai Akhir</th>
                  <th className="p-4 text-center">Status Hasil</th>
                  <th className="p-4 text-center">Aksi Manajemen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Memuat data hasil ujian...
                    </td>
                  </tr>
                ) : participants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Tidak ada data hasil peserta untuk kriteria filter ini.
                    </td>
                  </tr>
                ) : (
                  participants.map((p) => (
                    <tr key={p.participantId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white">{p.studentName}</div>
                        <div className="text-[11px] text-slate-500">NISN: {p.nisn || '-'} • NIS: {p.nis || '-'}</div>
                      </td>
                      <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">{p.className}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.sessionStatus === 'SUBMITTED'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : p.sessionStatus === 'IN_PROGRESS'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {p.sessionStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {p.finalScore !== null ? (
                          <div>
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              {p.finalScore}
                            </span>
                            <span className="text-[10px] text-slate-400 block">{p.percentage}%</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Belum ternilai</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            p.status === 'PUBLISHED'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200'
                              : p.status === 'REVIEWED'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200'
                              : p.status === 'GRADED'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                              : p.status === 'PARTIALLY_GRADED'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200'
                              : p.status === 'VOID'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {p.resultId && (
                            <Link
                              href={`/admin/results/${p.resultId}`}
                              title="Lihat Detail Hasil"
                              className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 transition-all inline-flex items-center justify-center"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                          )}

                          {p.resultId && p.status === 'GRADED' && (
                            <button
                              type="button"
                              onClick={() => handleReview(p.resultId!)}
                              title="Setujui Review"
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {p.resultId && ['GRADED', 'REVIEWED'].includes(p.status) && (
                            <button
                              type="button"
                              onClick={() => handlePublish(p.resultId!)}
                              title="Publikasikan ke Siswa"
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {p.resultId && (
                            <button
                              type="button"
                              onClick={() => handleOpenCorrectModal(p)}
                              title="Koreksi Nilai"
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {p.resultId && p.status !== 'VOID' && (
                            <button
                              type="button"
                              onClick={() => handleOpenVoidModal(p)}
                              title="Batalkan Hasil (VOID)"
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all"
                            >
                              <Slash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Koreksi Nilai */}
        {correctModal?.open && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-600" /> Koreksi Nilai Hasil Ujian
                </h3>
                <button type="button" onClick={() => setCorrectModal(null)}>
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Siswa: <strong>{correctModal.studentName}</strong> • Nilai Saat Ini:{' '}
                <strong>{correctModal.currentScore}</strong>
              </p>

              <form onSubmit={submitCorrection} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nilai Baru (0 s/d 100) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={newScoreVal}
                    onChange={(e) => setNewScoreVal(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Alasan Koreksi Nilai <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="Contoh: Perbaikan kunci jawaban soal no 4 atau penyesuaian rubrik..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">
                    Alasan ini akan dicatat permanen dalam audit jejak rekam koreksi nilai.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCorrectModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingCorrection}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md disabled:opacity-50"
                  >
                    {savingCorrection ? 'Menyimpan...' : 'Simpan Koreksi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Void Nilai */}
        {voidModal?.open && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
                  <Slash className="w-5 h-5" /> Pembatalan Hasil Ujian (VOID)
                </h3>
                <button type="button" onClick={() => setVoidModal(null)}>
                  <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Siswa: <strong>{voidModal.studentName}</strong>. Tindakan ini akan membatalkan status kelulusan dan
                nilai peserta.
              </p>

              <form onSubmit={submitVoid} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Alasan Pembatalan <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="Contoh: Terbukti melakukan pelanggaran berat tata tertib..."
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setVoidModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingVoid}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md disabled:opacity-50"
                  >
                    {savingVoid ? 'Membatalkan...' : 'Konfirmasi VOID'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
