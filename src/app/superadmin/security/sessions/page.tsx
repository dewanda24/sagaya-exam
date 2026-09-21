'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  LogOut,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Laptop,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import Pagination from '@/components/common/Pagination';

interface SessionItem {
  sessionId: string;
  userId: string;
  username: string;
  fullName: string;
  role: string;
  schoolName: string;
  ipAddress?: string;
  userAgent?: string;
  loginTime: string;
  lastActivity: string;
  sessionStatus: 'ACTIVE' | 'IDLE' | 'REVOKED';
}

export default function SuperAdminSessionsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Revoke Modal
  const [revokeModal, setRevokeModal] = useState<SessionItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/security/sessions?page=${currentPage}&limit=${pageSize}`);
      const json = await res.json();
      if (json.success) {
        setSessions(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load active sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [currentPage]);

  const handleRevokeSession = async () => {
    if (!revokeModal) return;
    if (!revokeReason.trim() || revokeReason.trim().length < 5) {
      setError('Alasan pencabutan sesi wajib diisi minimal 5 karakter.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/superadmin/security/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: revokeModal.sessionId,
          reason: revokeReason.trim(),
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal mencabut sesi.');

      setRevokeModal(null);
      setRevokeReason('');
      loadSessions();
    } catch (err: any) {
      setError(err.message || 'Gagal memproses pencabutan sesi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SuperAdminLayout
      title="Manajemen Sesi Login Staf"
      subtitle="Daftar seluruh sesi login aktif pengelola platform & satuan pendidikan"
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/superadmin/security"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Security Center</span>
          </Link>
          <button
            onClick={loadSessions}
            title="Muat Ulang"
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Information Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-3">Peran & Sekolah</th>
                  <th className="py-3 px-3">Waktu Login</th>
                  <th className="py-3 px-3">Aktivitas Terakhir</th>
                  <th className="py-3 px-3">IP Address & Browser</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400 text-xs">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
                      Memuat daftar sesi login aktif...
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400 text-xs">
                      Tidak ada data sesi aktif yang tercatat.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.sessionId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{s.fullName}</p>
                        <p className="text-[11px] font-mono text-slate-400">{s.username}</p>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] inline-block mb-0.5">
                          {s.role}
                        </span>
                        <p className="text-[11px] text-slate-500 truncate max-w-[160px]">{s.schoolName}</p>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {new Date(s.loginTime).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {new Date(s.lastActivity).toLocaleTimeString('id-ID')}
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-mono text-[11px] text-slate-700">{s.ipAddress || 'Unknown IP'}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[180px]" title={s.userAgent}>
                          {s.userAgent || '-'}
                        </p>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          s.sessionStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : s.sessionStatus === 'IDLE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.sessionStatus === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                          {s.sessionStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setRevokeModal(s);
                            setRevokeReason('');
                            setError('');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 font-bold text-[11px] border border-rose-200/80 transition"
                          title="Cabut Sesi Ini"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Menampilkan {sessions.length} dari {totalCount} sesi login
            </p>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        </div>

        {/* Modal: Revoke Session Confirmation */}
        {revokeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Konfirmasi Pencabutan Sesi</h3>
                  <p className="text-xs text-slate-500">
                    {revokeModal.fullName} ({revokeModal.username})
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {error}
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                Pencabutan sesi ini akan segera membatalkan token JWT dan memaksa pengguna keluar pada permintaan berikutnya.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Pencabutan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Contoh: Sesi mencurigakan / permintaan pemilik akun..."
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRevokeModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleRevokeSession}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Memproses...' : 'Cabut Sesi Sekarang'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
