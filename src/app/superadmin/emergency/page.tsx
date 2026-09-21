'use client';

import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Clock,
  Unlock,
  CheckSquare,
  AlertTriangle,
  RefreshCw,
  Search,
  Building2,
  Users,
  Activity,
  CheckCircle2,
  XCircle,
  HelpCircle,
  History,
  Send,
  Zap,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import Pagination from '@/components/common/Pagination';

interface ActiveUnit {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  rayon: string;
  examId: string;
  examTitle: string;
  examStatus: string;
  startTime: string;
  endTime: string;
  metrics: {
    totalSessions: number;
    inProgress: number;
    disconnected: number;
    locked: number;
    submitted: number;
  };
}

interface EmergencyLog {
  id: string;
  action: string;
  details: {
    schoolName?: string;
    extraMinutes?: number;
    affectedCount?: number;
    reason?: string;
    executedAt?: string;
  };
  operatorName: string;
  createdAt: string;
}

export default function SuperAdminEmergencyPage() {
  const [activeUnits, setActiveUnits] = useState<ActiveUnit[]>([]);
  const [recentLogs, setRecentLogs] = useState<EmergencyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rayonFilter, setRayonFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal Aksi Darurat
  const [actionModal, setActionModal] = useState<{
    unit: ActiveUnit;
    action: 'EXTEND_TIME' | 'RESET_LOGIN' | 'FORCE_FINISH';
  } | null>(null);

  const [extraMinutes, setExtraMinutes] = useState(15);
  const [reason, setReason] = useState('');
  const [executing, setExecuting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchEmergencyData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/emergency');
      const json = await res.json();
      if (json.success && json.data) {
        setActiveUnits(json.data.activeUnits || []);
        setRecentLogs(json.data.recentLogs || []);
      }
    } catch (err) {
      console.error('Failed to load emergency status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmergencyData();
    // Auto refresh status setiap 20 detik
    const timer = setInterval(fetchEmergencyData, 20000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, rayonFilter]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleExecute = async () => {
    if (!actionModal) return;

    if (!reason.trim() || reason.trim().length < 5) {
      showToast('error', 'Alasan tindakan darurat wajib diisi minimal 5 karakter (Audit Trail).');
      return;
    }

    setExecuting(true);
    try {
      const res = await fetch('/api/superadmin/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionModal.action,
          schoolId: actionModal.unit.schoolId,
          examId: actionModal.unit.examId,
          extraMinutes,
          reason: reason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', json.message);
        setActionModal(null);
        setReason('');
        fetchEmergencyData();
      } else {
        showToast('error', json.error || 'Gagal mengeksekusi aksi darurat.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan sistem saat menghubungi server.');
    } finally {
      setExecuting(false);
    }
  };

  // Kalkulasi agregat statistik live
  const totalLiveInProgress = activeUnits.reduce((acc, u) => acc + u.metrics.inProgress, 0);
  const totalLiveDisconnected = activeUnits.reduce((acc, u) => acc + u.metrics.disconnected + u.metrics.locked, 0);
  const totalLiveSubmitted = activeUnits.reduce((acc, u) => acc + u.metrics.submitted, 0);

  const filteredUnits = activeUnits.filter((u) => {
    const term = search.toLowerCase();
    const matchSearch =
      u.schoolName.toLowerCase().includes(term) ||
      u.schoolCode.toLowerCase().includes(term) ||
      u.examTitle.toLowerCase().includes(term);
    const matchRayon = rayonFilter === 'ALL' || u.rayon === rayonFilter;
    return matchSearch && matchRayon;
  });

  return (
    <SuperAdminLayout
      title="Pusat Aksi & Intervensi Darurat Ujian"
      subtitle="Fasilitas penanganan cepat hari-H: Perpanjangan waktu massal, pemulihan crash lab komputer (reset login), dan pengumpulan paksa"
      actions={
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Live Ops Aktif
          </span>
          <button
            onClick={fetchEmergencyData}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Toast */}
        {toastMessage && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm transition-all animate-in fade-in duration-200 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="opacity-70 hover:opacity-100 font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        {/* Live Metrics Summary Cards (Modern & Clean) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Siswa Sedang Mengerjakan
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                {totalLiveInProgress}
              </h3>
              <p className="text-[11px] text-sky-600 font-medium">Sesi aktif terkoneksi</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Kendala / Terputus (Crash)
              </p>
              <h3 className="text-2xl font-black text-amber-600 mt-0.5">
                {totalLiveDisconnected}
              </h3>
              <p className="text-[11px] text-amber-700 font-medium">Membutuhkan reset login</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Sudah Mengumpulkan
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">
                {totalLiveSubmitted}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium">Jawaban aman tersimpan</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari sekolah atau judul ujian..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <select
              value={rayonFilter}
              onChange={(e) => setRayonFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-sky-500 font-medium"
            >
              <option value="ALL">Semua Rayon</option>
              <option value="Rayon 1 - Pusat">Rayon 1 - Pusat</option>
              <option value="Rayon 2 - Utara">Rayon 2 - Utara</option>
              <option value="Rayon 3 - Selatan">Rayon 3 - Selatan</option>
              <option value="Rayon 4 - Barat">Rayon 4 - Barat</option>
              <option value="Rayon 5 - Timur">Rayon 5 - Timur</option>
            </select>
          </div>
        </div>

        {/* Active Units Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Unit Ujian Sekolah yang Terdeteksi Aktif ({filteredUnits.length})
              </h3>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Memeriksa denyut sesi ujian di seluruh sekolah...
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Tidak ada sesi ujian aktif yang sedang berjalan saat ini.
            </div>
          ) : (
            <div>
              <div className="w-full">
                <table className="w-full text-left text-xs table-fixed">
                  <thead>
                    <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 border-b border-slate-200/80">
                      <th className="py-3 px-4 sm:px-6 w-[24%]">Sekolah & Wilayah</th>
                      <th className="py-3 px-3 w-[22%]">Paket Ujian</th>
                      <th className="py-3 px-3 w-[12%]">Mengerjakan</th>
                      <th className="py-3 px-3 w-[12%]">Kendala/Crash</th>
                      <th className="py-3 px-3 w-[10%]">Selesai</th>
                      <th className="py-3 px-4 sm:px-6 text-right w-[20%]">Tindakan Intervensi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUnits
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map((u, idx) => (
                        <tr key={`${u.schoolId}-${u.examId}-${idx}`} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 sm:px-6">
                            <p className="font-bold text-slate-900 text-xs truncate">
                              {u.schoolName}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {u.rayon} &bull; <span className="font-mono">{u.schoolCode}</span>
                            </p>
                          </td>
                          <td className="py-3.5 px-3">
                            <p className="font-semibold text-slate-800 text-xs truncate">
                              {u.examTitle}
                            </p>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 mt-0.5">
                              {u.examStatus}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="inline-block font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md text-[11px]">
                              {u.metrics.inProgress} siswa
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            {u.metrics.disconnected + u.metrics.locked > 0 ? (
                              <span className="inline-block font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md text-[11px] animate-pulse">
                                {u.metrics.disconnected + u.metrics.locked} siswa
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium text-[11px]">0</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 font-semibold text-slate-700 text-[11px]">
                            {u.metrics.submitted} siswa
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {/* Button 1: Tambah Waktu */}
                              <button
                                onClick={() =>
                                  setActionModal({
                                    unit: u,
                                    action: 'EXTEND_TIME',
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] font-bold transition"
                                title="Tambah Waktu Ujian Sekolah Ini"
                              >
                                <Clock className="w-3 h-3" />
                                <span>+Waktu</span>
                              </button>

                              {/* Button 2: Reset Kunci Login */}
                              <button
                                onClick={() =>
                                  setActionModal({
                                    unit: u,
                                    action: 'RESET_LOGIN',
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold transition"
                                title="Reset Kunci Login Massal (Lab Crash Recovery)"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>Reset</span>
                              </button>

                              {/* Button 3: Force Submit */}
                              <button
                                onClick={() =>
                                  setActionModal({
                                    unit: u,
                                    action: 'FORCE_FINISH',
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-bold transition"
                                title="Paksa Kumpulkan Jawaban Serentak"
                              >
                                <CheckSquare className="w-3 h-3" />
                                <span>Selesai</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Component */}
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredUnits.length / pageSize) || 1}
                totalItems={filteredUnits.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                itemName="unit ujian aktif"
              />
            </div>
          )}
        </div>

        {/* Audit Log Intervensi Terakhir */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-800">
                Catatan Jejak Intervensi Darurat Terakhir
              </h3>
            </div>
          </div>

          {recentLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Belum ada intervensi darurat yang tercatat.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentLogs.map((log) => (
                <div key={log.id} className="p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900">
                      {log.action.replace('EMERGENCY_', '')}
                    </span>
                    <p className="text-slate-600 mt-0.5">
                      Sekolah: <strong>{log.details.schoolName || '-'}</strong> &bull; Dampak: <strong>{log.details.affectedCount ?? 0} peserta</strong>
                    </p>
                    {log.details.reason && (
                      <p className="text-[11px] text-slate-400 italic mt-0.5">
                        Alasan: &quot;{log.details.reason}&quot;
                      </p>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-slate-400 flex-shrink-0">
                    <p>{new Date(log.createdAt).toLocaleString('id-ID')}</p>
                    <p>Oleh: {log.operatorName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MODAL AKSI DARURAT */}
        {actionModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div
                className={`p-5 text-white ${
                  actionModal.action === 'EXTEND_TIME'
                    ? 'bg-gradient-to-r from-sky-600 to-blue-700'
                    : actionModal.action === 'RESET_LOGIN'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-700'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-2">
                  {actionModal.action === 'EXTEND_TIME' ? (
                    <Clock className="w-5 h-5 text-white" />
                  ) : actionModal.action === 'RESET_LOGIN' ? (
                    <Unlock className="w-5 h-5 text-white" />
                  ) : (
                    <CheckSquare className="w-5 h-5 text-white" />
                  )}
                </div>
                <h3 className="text-base font-bold">
                  {actionModal.action === 'EXTEND_TIME' && 'Perpanjangan Waktu Darurat'}
                  {actionModal.action === 'RESET_LOGIN' && 'Pemulihan Crash Lab (Reset Login)'}
                  {actionModal.action === 'FORCE_FINISH' && 'Paksa Selesai & Kumpulkan Jawaban'}
                </h3>
                <p className="text-xs opacity-90 mt-0.5">
                  Sasaran: {actionModal.unit.schoolName}
                </p>
              </div>

              <div className="p-5 space-y-4">
                {/* Penjelasan Aksi */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                  {actionModal.action === 'EXTEND_TIME' && (
                    <p>
                      Waktu ujian seluruh siswa yang saat ini sedang aktif (<code>IN_PROGRESS</code>) di <strong>{actionModal.unit.schoolName}</strong> akan diperpanjang secara otomatis di server tanpa perlu siswa refresh.
                    </p>
                  )}
                  {actionModal.action === 'RESET_LOGIN' && (
                    <p>
                      Seluruh ikatan perangkat (device fingerprint) siswa sekolah ini akan dibebaskan. Siswa yang komputernya mati/rusak dapat langsung login kembali di komputer lain tanpa terblokir.
                    </p>
                  )}
                  {actionModal.action === 'FORCE_FINISH' && (
                    <p>
                      Seluruh sesi yang masih menggantung akan ditandai selesai (<code>SUBMITTED</code>). Jawaban yang sudah tersimpan di sistem akan langsung dievaluasi nilainya.
                    </p>
                  )}
                </div>

                {/* Input Tambahan untuk EXTEND_TIME */}
                {actionModal.action === 'EXTEND_TIME' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Durasi Tambahan Waktu
                    </label>
                    <select
                      value={extraMinutes}
                      onChange={(e) => setExtraMinutes(parseInt(e.target.value) || 15)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                    >
                      <option value={10}>+10 Menit</option>
                      <option value={15}>+15 Menit (Standar)</option>
                      <option value={20}>+20 Menit</option>
                      <option value={30}>+30 Menit (Genset/Kendala Listrik)</option>
                      <option value={45}>+45 Menit</option>
                      <option value={60}>+60 Menit (1 Jam Penuh)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Alasan Intervensi
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Genset lab mati 15 menit, kendala switch jaringan..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActionModal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleExecute}
                    disabled={executing}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                  >
                    {executing ? 'Mengeksekusi...' : 'Eksekusi Sekarang'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
