'use client';

import { useState, useEffect } from 'react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import {
  FileSpreadsheet,
  Download,
  FileText,
  School,
  BarChart3,
  Layers,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Building2,
} from 'lucide-react';

export default function SuperAdminReportsPage() {
  const [level, setLevel] = useState('ALL');
  const [rayon, setRayon] = useState('ALL');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDownloadMaster = (format: 'csv' | 'xlsx' = 'csv') => {
    setDownloading(format);
    const q = new URLSearchParams();
    if (level !== 'ALL') q.set('level', level);
    if (rayon !== 'ALL') q.set('rayon', rayon);

    window.open(`/api/superadmin/reports/master-export?${q.toString()}`, '_blank');
    setTimeout(() => {
      setDownloading(null);
      showToast('Permintaan ekspor data skala nasional telah diproses.');
    }, 1500);
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <FileSpreadsheet className="w-4 h-4" />
              National Reporting & Audit Engine
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Pusat Laporan & Ekspor Wilayah
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Unduh data agregasi nasional, rekapitulasi nilai dinas pendidikan, dan berkas audit terverifikasi seluruh tenant sekolah.
            </p>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Jenjang Sekolah</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="ALL">Semua Jenjang (SD, SMP, SMA, SMK)</option>
                <option value="SD">SD / MI</option>
                <option value="SMP">SMP / MTs</option>
                <option value="SMA">SMA / MA</option>
                <option value="SMK">SMK</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Rayon / Wilayah</label>
              <select
                value={rayon}
                onChange={(e) => setRayon(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="ALL">Semua Rayon / Seluruh Wilayah</option>
                <option value="RAYON-1">Rayon 01 - Wilayah Barat</option>
                <option value="RAYON-2">Rayon 02 - Wilayah Pusat</option>
                <option value="RAYON-3">Rayon 03 - Wilayah Timur</option>
              </select>
            </div>
          </div>
        </div>

        {/* Report Download Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Master Export Nilai CSV */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500/50 transition shadow-lg">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Master Export Nilai (CSV)</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                Seluruh rekaman nilai peserta didik dari semua sekolah terdaftar, mencakup NISN, nama peserta, sekolah asal, dan skor akhir.
              </p>
            </div>
            <button
              onClick={() => handleDownloadMaster('csv')}
              disabled={downloading !== null}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 transition"
            >
              <Download className="w-4 h-4" />
              <span>{downloading === 'csv' ? 'Menyiapkan...' : 'Unduh Master CSV'}</span>
            </button>
          </div>

          {/* Card 2: Agregasi Benchmark Rayon */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500/50 transition shadow-lg">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Benchmark Wilayah & Dinas</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                Data komparatif performa antar sekolah, disparitas capaian KKM, dan distribusi grade (A-D) per mata pelajaran wilayah.
              </p>
            </div>
            <a
              href="/superadmin/analitik"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Buka Analisis Wilayah</span>
            </a>
          </div>

          {/* Card 3: Audit Trail & Security Log */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-indigo-500/50 transition shadow-lg">
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Arsip Audit Trail & Integritas</h3>
              <p className="text-slate-400 text-xs leading-relaxed mb-6">
                Jejak audit perubahan nilai, rekapitulasi pelanggaran browser lock, pembatalan hasil ujian (VOID), dan riwayat regrading massal.
              </p>
            </div>
            <a
              href="/superadmin/audit-logs"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-sm font-semibold transition"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Buka Jejak Rekam Audit</span>
            </a>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
