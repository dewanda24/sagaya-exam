'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Building2,
  ArrowLeft,
  Users,
  CalendarCheck,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Archive,
  BookOpen,
  GraduationCap,
  Clock,
  ShieldCheck,
  Layers,
  Edit2,
  RefreshCw,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';

interface SchoolDetailData {
  identity: {
    id: string;
    code: string;
    npsn?: string;
    name: string;
    level: string;
    rayon?: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
    isActive: boolean;
    address?: string;
    phone?: string;
    email?: string;
    principalName?: string;
    principalNip?: string;
    quotaStudents?: number;
    quotaExams?: number;
    subscriptionTier?: string;
    subscriptionExpiresAt?: string;
    createdAt?: string;
  };
  admins: Array<{
    id: string;
    username: string;
    fullName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    lastLoginAt?: string;
  }>;
  summary: {
    totalAdmins: number;
    totalTeachers: number;
    totalStudents: number;
    totalClasses: number;
    totalSubjects: number;
    totalExams: number;
  };
  recentActivities: Array<{
    id: string;
    action: string;
    severity: string;
    createdAt: string;
    actorName: string;
    actorRole: string;
    details?: any;
  }>;
}

export default function SuperAdminSchoolDetailPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const resolvedParams = use(params);
  const schoolId = resolvedParams.schoolId;

  const [data, setData] = useState<SchoolDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Status Action Modal
  const [statusModal, setStatusModal] = useState<'SUSPEND' | 'ACTIVATE' | 'ARCHIVE' | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState('');

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/schools/${schoolId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal memuat detail sekolah.');
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [schoolId]);

  const handleStatusTransition = async () => {
    if (!statusModal) return;
    if (!statusReason.trim() || statusReason.trim().length < 5) {
      setStatusError('Alasan tindakan wajib diisi minimal 5 karakter.');
      return;
    }

    setStatusSubmitting(true);
    setStatusError('');

    try {
      const res = await fetch(`/api/superadmin/schools/${schoolId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: statusModal,
          reason: statusReason.trim(),
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal memproses perubahan status.');

      setStatusModal(null);
      setStatusReason('');
      loadDetail();
    } catch (err: any) {
      setStatusError(err.message || 'Gagal memproses aksi status.');
    } finally {
      setStatusSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout title="Detail Satuan Pendidikan">
        <div className="py-24 text-center text-slate-400 text-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
          Memuat data profil satuan pendidikan...
        </div>
      </SuperAdminLayout>
    );
  }

  if (error || !data) {
    return (
      <SuperAdminLayout title="Detail Satuan Pendidikan">
        <div className="max-w-md mx-auto p-6 bg-white rounded-2xl border border-rose-200 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">Gagal Menampilkan Data</h3>
          <p className="text-xs text-slate-500">{error || 'Satuan pendidikan tidak ditemukan.'}</p>
          <Link
            href="/superadmin/schools"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Daftar Sekolah
          </Link>
        </div>
      </SuperAdminLayout>
    );
  }

  const { identity, admins, summary, recentActivities } = data;

  return (
    <SuperAdminLayout
      title={identity.name}
      subtitle={`Kode: ${identity.code} • NPSN: ${identity.npsn || '-'} • Rayon: ${identity.rayon || 'Pusat'}`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/superadmin/schools"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </Link>

          {identity.status === 'ACTIVE' ? (
            <button
              onClick={() => {
                setStatusModal('SUSPEND');
                setStatusReason('');
                setStatusError('');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold transition"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Tangguhkan (Suspend)</span>
            </button>
          ) : identity.status === 'SUSPENDED' ? (
            <button
              onClick={() => {
                setStatusModal('ACTIVATE');
                setStatusReason('');
                setStatusError('');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Aktifkan Kembali</span>
            </button>
          ) : null}

          {identity.status !== 'ARCHIVED' && (
            <button
              onClick={() => {
                setStatusModal('ARCHIVE');
                setStatusReason('');
                setStatusError('');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Arsipkan</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Status Alert Banner if Suspended or Archived */}
        {identity.status === 'SUSPENDED' && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">Satuan Pendidikan Ini Sedang Ditangguhkan (SUSPENDED)</p>
                <p className="text-amber-700 text-[11px]">
                  Seluruh akses staf dan siswa dari sekolah ini diblokir secara terpusat oleh filter isolasi tenant.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Top 6 Summary KPI Badges (Read-Only Aggregations) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Administrator</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">{summary.totalAdmins}</span>
            <span className="text-[10px] text-slate-500">akun aktif</span>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dewan Guru</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">{summary.totalTeachers}</span>
            <span className="text-[10px] text-slate-500">guru terdaftar</span>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Peserta Didik</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">{summary.totalStudents.toLocaleString('id-ID')}</span>
            <span className="text-[10px] text-slate-500">kuota: {identity.quotaStudents || 1000}</span>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rombel / Kelas</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">{summary.totalClasses}</span>
            <span className="text-[10px] text-slate-500">kelas aktif</span>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mata Pelajaran</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">{summary.totalSubjects}</span>
            <span className="text-[10px] text-slate-500">mapel kurikulum</span>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Paket Ujian</span>
            <span className="text-xl font-black text-slate-800 mt-1 block">{summary.totalExams}</span>
            <span className="text-[10px] text-slate-500">kuota: {identity.quotaExams || 50}</span>
          </div>
        </div>

        {/* Two Column Layout: Left Identity & Admins, Right Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Identity & Admin List (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Identity Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-sky-600" />
                Profil Legalitas & Kontak Sekolah
              </h3>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">Nama Resmi Satuan Pendidikan:</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{identity.name}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">Status Operasional:</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                    identity.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : identity.status === 'SUSPENDED'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {identity.status}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">Kepala Sekolah:</span>
                  <p className="font-semibold text-slate-800">{identity.principalName || '-'}</p>
                  <p className="text-[11px] text-slate-400">NIP: {identity.principalNip || '-'}</p>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">Jenjang & Rayon:</span>
                  <p className="font-semibold text-slate-800">{identity.level} &bull; {identity.rayon || 'Rayon 1 - Pusat'}</p>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">Email & Telepon:</span>
                  <p className="text-slate-700 flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {identity.email || '-'}
                  </p>
                  <p className="text-slate-700 flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {identity.phone || '-'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] font-semibold">Alamat Fisik:</span>
                  <p className="text-slate-700 flex items-start gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{identity.address || 'Alamat belum diatur'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Administrators Table */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Akun Administrator Satuan Pendidikan
                </h3>
                <span className="text-xs text-slate-400">{admins.length} akun terdaftar</span>
              </div>

              {admins.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada akun Administrator Sekolah yang dibuat untuk sekolah ini.
                </div>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {admins.map((admin) => (
                    <div key={admin.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{admin.fullName}</p>
                        <p className="text-[11px] text-slate-400">
                          Username: <span className="font-mono font-semibold text-slate-600">{admin.username}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          admin.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {admin.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {admin.lastLoginAt ? `Login: ${new Date(admin.lastLoginAt).toLocaleDateString('id-ID')}` : 'Belum pernah login'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: School Activity Log (1 Col) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
                <Clock className="w-4 h-4 text-slate-500" />
                Aktivitas Audit Satuan Pendidikan
              </h3>

              {recentActivities.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada rekam jejak aktivitas audit untuk sekolah ini.
                </div>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {recentActivities.map((log) => (
                    <div key={log.id} className="py-2.5 text-xs">
                      <p className="font-semibold text-slate-800">{log.action}</p>
                      <p className="text-[11px] text-slate-500">
                        Oleh: <span className="font-medium">{log.actorName}</span> ({log.actorRole})
                      </p>
                      <span className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 mt-4">
              <Link
                href={`/superadmin/audit?schoolId=${schoolId}`}
                className="w-full text-center block text-xs font-semibold text-slate-600 hover:text-sky-600 py-1"
              >
                Lihat Seluruh Audit Sekolah Ini &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Modal: Status Action Confirmation */}
        {statusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  statusModal === 'SUSPEND'
                    ? 'bg-amber-100 text-amber-700'
                    : statusModal === 'ARCHIVE'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {statusModal === 'SUSPEND' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : statusModal === 'ARCHIVE' ? (
                    <Archive className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Konfirmasi {statusModal === 'SUSPEND' ? 'Penangguhan' : statusModal === 'ARCHIVE' ? 'Pengarsipan' : 'Pengaktifan'} Sekolah
                  </h3>
                  <p className="text-xs text-slate-500">{identity.name}</p>
                </div>
              </div>

              {statusError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {statusError}
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                Tindakan ini akan mempengaruhi seluruh wewenang pengguna dan pelaksanaan ujian pada satuan pendidikan ini.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Perubahan Status <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Jelaskan alasan tindakan ini (wajib dicatat pada audit log)..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStatusModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleStatusTransition}
                  disabled={statusSubmitting}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs disabled:opacity-50 ${
                    statusModal === 'SUSPEND'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : statusModal === 'ARCHIVE'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {statusSubmitting ? 'Memproses...' : 'Konfirmasi & Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
