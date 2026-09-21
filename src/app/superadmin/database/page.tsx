'use client';

import { useState, useEffect } from 'react';
import {
  Database,
  HardDrive,
  ShieldCheck,
  Download,
  Trash2,
  RefreshCw,
  Activity,
  Layers,
  Lock,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Server,
  KeyRound,
  ShieldAlert,
  ArrowDownToLine,
  History,
  Sparkles,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';

interface TableMetric {
  name: string;
  label: string;
  count: number;
  category: string;
}

interface DatabaseInfo {
  health: {
    status: string;
    latencyMs: number;
    dbName: string;
    dbSize: string;
    dbVersion: string;
    connectionLimit: number;
  };
  tableMetrics: TableMetric[];
  security: {
    totalUsers: number;
    sha256Passwords: number;
    superadminCount: number;
    schooladminCount: number;
    liveActiveSessions: number;
    expiredSessions: number;
  };
  backupHistory: Array<{
    id: string;
    action: string;
    details: any;
    createdAt: string;
  }>;
}

export default function SuperAdminDatabasePage() {
  const [activeTab, setActiveTab] = useState<'HEALTH' | 'BACKUP' | 'SECURITY'>('HEALTH');
  const [data, setData] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Backup Modal / Action
  const [backupScope, setBackupScope] = useState<'FULL' | 'CONFIG_SCHOOLS' | 'QUESTION_BANKS' | 'EXAM_RESULTS'>('CONFIG_SCHOOLS');
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Maintenance & Security Action States
  const [cleaningSessions, setCleaningSessions] = useState(false);
  const [invalidatingSessions, setInvalidatingSessions] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDatabaseStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/database');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load database metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabaseStatus();
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // 1. Eksekusi Backup & Trigger Download File
  const handleGenerateBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await fetch('/api/superadmin/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_BACKUP',
          scope: backupScope,
        }),
      });
      const json = await res.json();

      if (json.success && json.backupData) {
        // Trigger direct browser download
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
          JSON.stringify(json.backupData, null, 2)
        )}`;
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', jsonString);
        downloadAnchor.setAttribute('download', json.filename || 'sagaya_backup.json');
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        showToast('success', `Berkas cadangan "${json.filename}" berhasil dibuat dan diunduh ke komputer Anda.`);
        fetchDatabaseStatus();
      } else {
        showToast('error', json.error || 'Gagal membuat berkas cadangan.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan sistem saat membuat berkas cadangan.');
    } finally {
      setCreatingBackup(false);
    }
  };

  // 2. Pembersihan Sesi Kedaluwarsa
  const handleCleanSessions = async () => {
    if (!window.confirm('Bersihkan sesi ujian kedaluwarsa yang sudah tidak aktif lebih dari 7 hari?')) return;

    setCleaningSessions(true);
    try {
      const res = await fetch('/api/superadmin/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLEAN_EXPIRED_SESSIONS' }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', json.message);
        fetchDatabaseStatus();
      } else {
        showToast('error', json.error || 'Gagal melakukan pembersihan.');
      }
    } catch {
      showToast('error', 'Gagal menghubungi server database.');
    } finally {
      setCleaningSessions(false);
    }
  };

  // 3. Putus Sesi Siswa Darurat
  const handleInvalidateAllSessions = async () => {
    const confirmation = window.prompt(
      'PERINGATAN KEAMANAN: Anda akan memutus seluruh sesi ujian siswa yang sedang berlangsung se-wilayah!\n\nKetik "SAYASADAR" untuk mengonfirmasi tindakan ini:'
    );
    if (confirmation !== 'SAYASADAR') return;

    setInvalidatingSessions(true);
    try {
      const res = await fetch('/api/superadmin/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'INVALIDATE_ALL_SESSIONS',
          reason: 'Pemutusan darurat integritas sesi platform',
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', json.message);
        fetchDatabaseStatus();
      } else {
        showToast('error', json.error || 'Gagal memutus sesi.');
      }
    } catch {
      showToast('error', 'Gagal memproses tindakan keamanan darurat.');
    } finally {
      setInvalidatingSessions(false);
    }
  };

  return (
    <SuperAdminLayout
      title="Basis Data, Keamanan & Cadangan"
      subtitle="Pemantauan kesehatan database PostgreSQL, pencadangan snapshot terpusat, dan tata kelola keamanan platform"
      actions={
        <button
          onClick={fetchDatabaseStatus}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
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

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white border border-slate-200 w-fit">
          <button
            onClick={() => setActiveTab('HEALTH')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'HEALTH'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Kesehatan & Volume Database</span>
          </button>

          <button
            onClick={() => setActiveTab('BACKUP')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'BACKUP'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Pencadangan Data (Backup)</span>
          </button>

          <button
            onClick={() => setActiveTab('SECURITY')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'SECURITY'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Pusat Keamanan & Kredensial</span>
          </button>
        </div>

        {/* TAB 1: KESEHATAN DATABASE */}
        {activeTab === 'HEALTH' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Health Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Status Koneksi
                  </p>
                  <h3 className="text-base font-bold text-emerald-700 flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Terhubung Normal
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Latency: {data?.health.latencyMs ?? 0} ms
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Kapasitas Terpakai
                  </p>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {data?.health.dbSize ?? 'Menghitung...'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Ukuran data aktif</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Database Engine
                  </p>
                  <h3 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                    {data?.health.dbName || 'PostgreSQL'}
                  </h3>
                  <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                    {data?.health.dbVersion || 'Supabase Managed'}
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Sesi Kedaluwarsa
                  </p>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {data?.security.expiredSessions ?? 0} Sesi
                  </h3>
                  <button
                    onClick={handleCleanSessions}
                    disabled={cleaningSessions || (data?.security.expiredSessions ?? 0) === 0}
                    className="text-[11px] font-bold text-sky-600 hover:text-sky-700 disabled:opacity-40 hover:underline"
                  >
                    {cleaningSessions ? 'Membersihkan...' : 'Bersihkan Sekarang'}
                  </button>
                </div>
              </div>
            </div>

            {/* Table Records Volume */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Volume Data Per Tabel Sistem
                  </h3>
                </div>
              </div>

              <div className="w-full">
                <table className="w-full text-left text-xs table-fixed">
                  <thead>
                    <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 border-b border-slate-200/80">
                      <th className="py-3 px-4 sm:px-6 w-[28%]">Nama Tabel</th>
                      <th className="py-3 px-3 w-[37%]">Deskripsi Objek</th>
                      <th className="py-3 px-3 w-[15%]">Kategori</th>
                      <th className="py-3 px-4 sm:px-6 w-[20%] text-right">Jumlah Baris</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.tableMetrics.map((t) => (
                      <tr key={t.name} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-slate-800 truncate" title={t.name}>
                          {t.name}
                        </td>
                        <td className="py-3.5 px-3 text-slate-600 truncate" title={t.label}>
                          {t.label}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {t.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-bold text-slate-900">
                          {t.count.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PENCADANGAN DATA (BACKUP) */}
        {activeTab === 'BACKUP' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Backup Generator Card */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Buat Snapshot Cadangan Baru (One-Click Backup)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Ekspor arsip data platform dalam format JSON terstruktur untuk pemulihan bencana (*disaster recovery*) atau arsip audit berkala.
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold flex-shrink-0">
                  <FileJson className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label
                  onClick={() => setBackupScope('CONFIG_SCHOOLS')}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    backupScope === 'CONFIG_SCHOOLS'
                      ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 block">
                    Konfigurasi Sekolah
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block leading-relaxed">
                    Data profil sekolah, kuota, rayon, dan pengaturan sistem.
                  </span>
                </label>

                <label
                  onClick={() => setBackupScope('QUESTION_BANKS')}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    backupScope === 'QUESTION_BANKS'
                      ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 block">
                    Master Bank Soal
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block leading-relaxed">
                    Seluruh naskah butir soal, kunci jawaban, dan rubrik penilaian.
                  </span>
                </label>

                <label
                  onClick={() => setBackupScope('EXAM_RESULTS')}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    backupScope === 'EXAM_RESULTS'
                      ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 block">
                    Rekap Hasil & Nilai Siswa
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block leading-relaxed">
                    Riwayat paket ujian dan perolehan skor peserta didik se-wilayah.
                  </span>
                </label>

                <label
                  onClick={() => setBackupScope('FULL')}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    backupScope === 'FULL'
                      ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 block">
                    Full Platform Snapshot
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block leading-relaxed">
                    Seluruh database gabungan (sekolah, soal, ujian, dan hasil).
                  </span>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  onClick={handleGenerateBackup}
                  disabled={creatingBackup}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm shadow-sky-600/20 transition disabled:opacity-50"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>{creatingBackup ? 'Menghasilkan Berkas Cadangan...' : 'Buat & Unduh Cadangan (.JSON)'}</span>
                </button>
              </div>
            </div>

            {/* Riwayat Backup */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Catatan Jejak Pencadangan Terakhir
                  </h3>
                </div>
              </div>

              {data?.backupHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada riwayat pencadangan data yang dicatat.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data?.backupHistory.map((b) => (
                    <div key={b.id} className="p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900">
                          {b.action.replace('DATABASE_BACKUP_', 'Cadangan: ')}
                        </span>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Cakupan: <strong>{b.details?.scope || 'CONFIG'}</strong> &bull; Dibuat pada: {new Date(b.createdAt).toLocaleString('id-ID')}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 w-fit">
                        Berhasil Disimpan
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PUSAT KEAMANAN & KREDENSIAL */}
        {activeTab === 'SECURITY' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Security Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <KeyRound className="w-5 h-5" />
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Enkripsi Kata Sandi
                </p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {data?.security.sha256Passwords ?? 0} / {data?.security.totalUsers ?? 0} Akun
                </h3>
                <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                  100% Menggunakan SHA-256 + Unique Salt
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Akun Tingkat Tinggi
                </p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {data?.security.superadminCount ?? 0} Master / {data?.security.schooladminCount ?? 0} Admin Sekolah
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Hak istimewa tata kelola terisolasi per sekolah
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Sesi Siswa Aktif Terkoneksi
                </p>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {data?.security.liveActiveSessions ?? 0} Sesi Live
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Terikat pada device fingerprint unik
                </p>
              </div>
            </div>

            {/* Emergency Global Invalidation Card */}
            <div className="p-6 rounded-2xl bg-rose-50/60 border border-rose-200/80 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-900">
                    Tindakan Keamanan Darurat: Putus Seluruh Sesi Siswa Serentak
                  </h3>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed max-w-2xl">
                    Jika dicurigai terjadi kebocoran token ujian massal atau serangan brute-force, Anda dapat memutus seluruh sesi siswa yang sedang berlangsung. Siswa akan diwajibkan meminta token login baru.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleInvalidateAllSessions}
                  disabled={invalidatingSessions}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {invalidatingSessions ? 'Memproses Pemutusan...' : 'Putus Semua Sesi Aktif'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
