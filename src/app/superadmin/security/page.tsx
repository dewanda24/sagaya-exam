'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  KeyRound,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowUpRight,
  Lock,
  Activity,
  UserX,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';

interface SecurityData {
  metrics: {
    activeSessions: number;
    failedLoginsLast24h: number;
    lockedAccounts: number;
    rateLimitAlerts: number;
    activeStudentSessions: number;
  };
  recentEvents: Array<{
    id: string;
    action: string;
    severity: string;
    createdAt: string;
    ipAddress?: string;
    actorName: string;
    actorRole: string;
    schoolName: string;
    details?: any;
  }>;
}

export default function SuperAdminSecurityCenterPage() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSecurityData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/security');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to load security metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecurityData();
  }, []);

  const metrics = data?.metrics;

  return (
    <SuperAdminLayout
      title="Pusat Keamanan Platform (Security Center)"
      subtitle="Pemantauan sesi aktif, mitigasi brute force, dan integritas otentikasi platform"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={loadSecurityData}
            title="Muat Ulang Metrik"
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 transition shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>
          <Link
            href="/superadmin/security/sessions"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Kelola Sesi Staf</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top 4 Security KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/superadmin/security/sessions"
            className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:border-sky-300 hover:shadow-xs transition group block"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sesi Staf Aktif</span>
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition shadow-2xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {loading ? '...' : metrics?.activeSessions ?? 0}
                </span>
                <span className="text-xs text-slate-500">sesi terverifikasi</span>
              </div>
              <p className="mt-2 text-xs text-sky-600 font-semibold flex items-center gap-1">
                Buka daftar sesi &rarr;
              </p>
            </div>
          </Link>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gagal Login (24 Jam)</span>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-2xs">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {loading ? '...' : metrics?.failedLoginsLast24h ?? 0}
                </span>
                <span className="text-xs text-slate-500">percobaan</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Rate limiting aktif: 5 req/menit per IP
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Akun Dinonaktifkan</span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-2xs">
                <UserX className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {loading ? '...' : metrics?.lockedAccounts ?? 0}
                </span>
                <span className="text-xs text-slate-500">akun terkunci</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Akses ditolak di level rbac
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sesi Siswa Ujian</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {loading ? '...' : metrics?.activeStudentSessions ?? 0}
                </span>
                <span className="text-xs text-slate-500">siswa pengerjaan</span>
              </div>
              <p className="mt-2 text-xs text-emerald-600 font-semibold">
                Device binding & heartbeat aktif
              </p>
            </div>
          </div>
        </div>

        {/* Security Audit Feed & Security Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Security Incidents Table (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Log Insiden & Peringatan Keamanan Terkini
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daftar event audit berbobot WARNING atau CRITICAL dari seluruh platform
                </p>
              </div>
              <Link
                href="/superadmin/audit?severity=WARNING"
                className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                Lihat Semua
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Memuat log keamanan...</div>
            ) : !data?.recentEvents || data.recentEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-emerald-600 font-semibold flex flex-col items-center justify-center gap-1">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                Tidak ada insiden atau peringatan keamanan dalam 24 jam terakhir.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-2 text-xs">
                {data.recentEvents.map((event) => (
                  <div key={event.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          event.severity === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {event.severity}
                        </span>
                        <span className="font-bold text-slate-800">{event.action}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        Pelaku: {event.actorName} ({event.actorRole || 'Anonim'}) &bull; {event.schoolName}
                      </p>
                      {event.details && (
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                          {JSON.stringify(event.details)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 text-[10px] text-slate-400">
                      <span>{new Date(event.createdAt).toLocaleTimeString('id-ID')}</span>
                      {event.ipAddress && <span className="block font-mono">{event.ipAddress}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions & Policy Checklist (1 Col) */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-sky-600" />
                Status Penegakan Keamanan
              </h3>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">Session Versioning</span>
                    <p className="text-[11px] text-slate-500">Pencabutan token instan saat password/peran berubah.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">Tenant Status Policy</span>
                    <p className="text-[11px] text-slate-500">Sekolah berstatus SUSPENDED ditolak secara terpusat.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">Token Hashing Safe Storage</span>
                    <p className="text-[11px] text-slate-500">Token mentah tidak pernah tersimpan di basis data.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">Immutable Audit Logs</span>
                    <p className="text-[11px] text-slate-500">Catatan audit tidak dapat diubah atau dihapus.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">Aksi Darurat Cepat</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Butuh menghentikan ujian serentak atau mereset perangkat laboratorium yang hang?
              </p>
              <Link
                href="/superadmin/emergency"
                className="block text-center py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition"
              >
                Buka Emergency Center &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
