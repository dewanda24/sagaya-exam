'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  UserX,
  Unlock,
  FastForward,
  Wifi,
  WifiOff,
  Radio,
  Sliders,
  AlertCircle,
  Eye,
} from 'lucide-react';

interface SessionItem {
  id: string;
  studentId: string;
  studentName: string;
  nisn: string;
  className: string;
  examId: string;
  examTitle: string;
  roomName: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'FORCE_STOPPED' | 'VIOLATION_BLOCKED';
  answeredCount: number;
  totalQuestions: number;
  progressPercent: number;
  remainingSeconds: number;
  deviceInfo?: string;
  ipAddress?: string;
  lastHeartbeat?: string;
  connectionStatus: 'ONLINE' | 'WEAK' | 'OFFLINE';
  violationCount: number;
}

export default function ExamMonitoringPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals for actions
  const [actionTarget, setActionTarget] = useState<SessionItem | null>(null);
  const [actionType, setActionType] = useState<'EXTEND' | 'FORCE_SUBMIT' | 'RESET' | 'UNLOCK' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchMonitoringData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const query = new URLSearchParams();
      if (selectedExamId) query.set('examId', selectedExamId);
      if (statusFilter) query.set('status', statusFilter);
      if (search) query.set('search', search);

      const res = await fetch(`/api/admin/monitoring?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setSessions(json.data.sessions || []);
        if (json.data.exams) setExams(json.data.exams);
      } else {
        showNotification(json.error?.message || 'Gagal memuat data monitoring', 'error');
      }
    } catch {
      showNotification('Koneksi monitoring gagal', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(() => {
      fetchMonitoringData();
    }, 15000); // Polling every 15s for live monitoring
    return () => clearInterval(interval);
  }, [selectedExamId, statusFilter, search]);

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTarget || !actionType) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:
            actionType === 'EXTEND'
              ? 'EXTEND_TIME'
              : actionType === 'FORCE_SUBMIT'
              ? 'FORCE_SUBMIT'
              : actionType === 'RESET'
              ? 'RESET_LOGIN'
              : 'UNLOCK_DEVICE',
          sessionId: actionTarget.id,
          reason: actionReason || 'Aksi pengawas ruang ujian',
          minutes: actionType === 'EXTEND' ? 15 : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification('Aksi berhasil diterapkan ke peserta!');
        setActionTarget(null);
        setActionType(null);
        setActionReason('');
        fetchMonitoringData(true);
      } else {
        showNotification(json.error?.message || 'Gagal menjalankan aksi', 'error');
      }
    } catch {
      showNotification('Terjadi kegagalan komunikasi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Aggregates
  const totalStudents = sessions.length;
  const inProgressCount = sessions.filter((s) => s.status === 'IN_PROGRESS').length;
  const submittedCount = sessions.filter((s) => s.status === 'SUBMITTED').length;
  const violationCount = sessions.filter((s) => (s.violationCount || 0) > 0 || s.status === 'VIOLATION_BLOCKED').length;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {toast && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-rose-600 text-white shadow-rose-500/20'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl relative">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    Live Exam Monitoring & Proctor Control
                  </h1>
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 animate-pulse">
                    LIVE
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Pantau koneksi, laju pengerjaan, dan anomali kecurangan peserta secara real-time.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => fetchMonitoringData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Segarkan Data
          </button>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase">Total Peserta</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalStudents}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-emerald-500 uppercase">Sedang Mengerjakan</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{inProgressCount}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-indigo-500 uppercase">Selesai / Submit</span>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{submittedCount}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-semibold text-rose-500 uppercase">Terindikasi Curang / Diblokir</span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{violationCount}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari nama siswa, NISN, atau kelas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <option value="">Semua Ujian Berlangsung</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <option value="">Semua Status</option>
              <option value="IN_PROGRESS">Mengerjakan</option>
              <option value="SUBMITTED">Selesai</option>
              <option value="VIOLATION_BLOCKED">Terblokir</option>
            </select>
          </div>
        </div>

        {/* Participants Monitoring Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <Clock className="w-6 h-6 animate-spin mx-auto mb-2" />
              Menghubungkan ke node pengawas ujian...
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Tidak ada sesi ujian aktif yang cocok dengan filter saat ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Peserta & Kelas</th>
                    <th className="py-3 px-4">Ujian & Ruang</th>
                    <th className="py-3 px-4">Status & Koneksi</th>
                    <th className="py-3 px-4">Progres Soal</th>
                    <th className="py-3 px-4">Sisa Waktu</th>
                    <th className="py-3 px-4">Pelanggaran</th>
                    <th className="py-3 px-4 text-right">Aksi Pengawas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{sess.studentName}</div>
                        <div className="text-[11px] text-slate-400">
                          NISN: {sess.nisn || '-'} • {sess.className || 'Tanpa Kelas'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{sess.examTitle}</div>
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                          {sess.roomName || 'Ruang Utama'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sess.status === 'IN_PROGRESS'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : sess.status === 'SUBMITTED'
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            }`}
                          >
                            {sess.status}
                          </span>
                          <span title={sess.connectionStatus} className="flex items-center">
                            {sess.connectionStatus === 'ONLINE' ? (
                              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                            )}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{sess.ipAddress || '127.0.0.1'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-28 bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-1 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all"
                            style={{ width: `${sess.progressPercent || 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {sess.answeredCount} / {sess.totalQuestions} ({sess.progressPercent || 0}%)
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {sess.remainingSeconds > 0
                          ? `${Math.floor(sess.remainingSeconds / 60)}m ${sess.remainingSeconds % 60}s`
                          : 'Habis'}
                      </td>
                      <td className="py-3 px-4">
                        {sess.violationCount > 0 ? (
                          <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 font-bold rounded">
                            {sess.violationCount}x Insiden
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setActionTarget(sess);
                              setActionType('EXTEND');
                            }}
                            title="Tambah Waktu 15 Menit"
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-lg cursor-pointer transition-colors"
                          >
                            <FastForward className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setActionTarget(sess);
                              setActionType('UNLOCK');
                            }}
                            title="Buka Kunci Perangkat"
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 rounded-lg cursor-pointer transition-colors"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setActionTarget(sess);
                              setActionType('RESET');
                            }}
                            title="Reset Sesi Login Peserta"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 rounded-lg cursor-pointer transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setActionTarget(sess);
                              setActionType('FORCE_SUBMIT');
                            }}
                            title="Hentikan / Paksa Kumpul Ujian"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-lg cursor-pointer transition-colors"
                          >
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Confirmation Modal */}
        {actionTarget && actionType && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                {actionType === 'EXTEND' && 'Perpanjang Waktu Ujian (+15 Menit)'}
                {actionType === 'FORCE_SUBMIT' && 'Paksa Selesai & Kumpulkan Jawaban'}
                {actionType === 'RESET' && 'Reset Sesi Login Peserta'}
                {actionType === 'UNLOCK' && 'Buka Kunci Perangkat / Token'}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Peserta: <strong className="text-slate-800 dark:text-slate-200">{actionTarget.studentName}</strong> (
                {actionTarget.nisn})
              </p>

              <form onSubmit={handleExecuteAction} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Alasan Tindakan Pengawas (Wajib dicatat di Audit Log) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Contoh: Terkendala mati lampu / kendala browser crash"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionTarget(null);
                      setActionType(null);
                    }}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                  >
                    {submitting ? 'Memproses...' : 'Konfirmasi Aksi'}
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
