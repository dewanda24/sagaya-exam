'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Users,
  CalendarCheck,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Filter,
  Copy,
  Check,
  Eye,
  ShieldAlert,
  Archive,
  ArrowUpDown,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import Pagination from '@/components/common/Pagination';

interface SchoolItem {
  id: string;
  code: string;
  npsn?: string;
  name: string;
  level: string;
  rayon?: string;
  address?: string;
  phone?: string;
  email?: string;
  principalName?: string;
  principalNip?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  isActive: boolean;
  quotaStudents?: number;
  quotaExams?: number;
  createdAt?: string;
  stats?: {
    totalStudents?: number;
    totalExams?: number;
    totalClasses?: number;
    totalTeachers?: number;
    totalAdmins?: number;
  };
}

interface NewCredential {
  schoolName: string;
  username: string;
  tempPassword: string;
}

export default function SuperAdminSchoolsPage() {
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [rayonFilter, setRayonFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 15;

  // Add School Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    npsn: '',
    level: 'SMA',
    rayon: 'Rayon 1 - Pusat',
    address: '',
    phone: '',
    email: '',
    principalName: '',
    principalNip: '',
    quotaStudents: 1000,
    quotaExams: 50,
  });

  // Credential Modal
  const [createdCredential, setCreatedCredential] = useState<NewCredential | null>(null);
  const [copied, setCopied] = useState(false);

  // Status Action Modal
  const [statusModal, setStatusModal] = useState<{
    school: SchoolItem | null;
    action: 'SUSPEND' | 'ACTIVATE' | 'ARCHIVE' | null;
  }>({ school: null, action: null });
  const [statusReason, setStatusReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState('');

  const loadSchools = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });
      if (search.trim()) params.append('search', search.trim());
      if (levelFilter !== 'ALL') params.append('level', levelFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (rayonFilter !== 'ALL') params.append('rayon', rayonFilter);

      const res = await fetch(`/api/superadmin/schools?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setSchools(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load schools:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, [currentPage, levelFilter, statusFilter, rayonFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadSchools();
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const res = await fetch('/api/superadmin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Gagal membuat satuan pendidikan.');
      }

      setShowAddModal(false);
      setCreatedCredential({
        schoolName: json.data.school.name,
        username: json.data.initialAdmin.username,
        tempPassword: json.data.initialAdmin.tempPassword,
      });

      // Reset form
      setFormData({
        name: '',
        code: '',
        npsn: '',
        level: 'SMA',
        rayon: 'Rayon 1 - Pusat',
        address: '',
        phone: '',
        email: '',
        principalName: '',
        principalNip: '',
        quotaStudents: 1000,
        quotaExams: 50,
      });

      loadSchools();
    } catch (err: any) {
      setFormError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusAction = async () => {
    if (!statusModal.school || !statusModal.action) return;
    if (!statusReason.trim() || statusReason.trim().length < 5) {
      setStatusError('Alasan tindakan wajib diisi minimal 5 karakter.');
      return;
    }

    setStatusSubmitting(true);
    setStatusError('');

    try {
      const res = await fetch(`/api/superadmin/schools/${statusModal.school.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: statusModal.action,
          reason: statusReason.trim(),
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Gagal mengubah status sekolah.');
      }

      setStatusModal({ school: null, action: null });
      setStatusReason('');
      loadSchools();
    } catch (err: any) {
      setStatusError(err.message || 'Gagal memproses aksi status.');
    } finally {
      setStatusSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SuperAdminLayout
      title="Manajemen Satuan Pendidikan"
      subtitle="Tata kelola direktori sekolah, kuota operasional, dan status keaktifan tenant"
      actions={
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Satuan Pendidikan</span>
        </button>
      }
    >
      <div className="space-y-5">
        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama sekolah, kode, NPSN, atau kepala sekolah..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-800"
              />
            </form>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <select
                value={levelFilter}
                onChange={(e) => {
                  setLevelFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium"
              >
                <option value="ALL">Semua Jenjang</option>
                <option value="SD">SD</option>
                <option value="SMP">SMP</option>
                <option value="SMA">SMA</option>
                <option value="SMK">SMK</option>
                <option value="MADRASAH">Madrasah</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">Aktif (ACTIVE)</option>
                <option value="SUSPENDED">Ditangguhkan (SUSPENDED)</option>
                <option value="ARCHIVED">Diarsipkan (ARCHIVED)</option>
              </select>

              <button
                onClick={loadSchools}
                title="Muat Ulang"
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Schools Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Satuan Pendidikan</th>
                  <th className="py-3 px-3">Jenjang / Rayon</th>
                  <th className="py-3 px-3">Kepala Sekolah</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Statistik</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 text-xs">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
                      Memuat data direktori satuan pendidikan...
                    </td>
                  </tr>
                ) : schools.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 text-xs">
                      Tidak ada data satuan pendidikan yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  schools.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/superadmin/schools/${s.id}`}
                              className="font-bold text-slate-900 hover:text-sky-600 transition block truncate"
                            >
                              {s.name}
                            </Link>
                            <p className="text-[11px] text-slate-400">
                              Kode: <span className="font-mono font-semibold text-slate-600">{s.code}</span> &bull; NPSN: {s.npsn || '-'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                            {s.level}
                          </span>
                          <p className="text-[10px] text-slate-500 truncate">{s.rayon || 'Rayon 1 - Pusat'}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-medium text-slate-800 truncate">{s.principalName || '-'}</p>
                        <p className="text-[10px] text-slate-400">NIP: {s.principalNip || '-'}</p>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {s.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            ACTIVE
                          </span>
                        ) : s.status === 'SUSPENDED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" />
                            SUSPENDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <Archive className="w-3 h-3" />
                            ARCHIVED
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <div className="inline-flex items-center gap-2 text-[11px] text-slate-600">
                          <span title="Siswa Terdaftar">{s.stats?.totalStudents || 0} Siswa</span>
                          &bull;
                          <span title="Paket Ujian">{s.stats?.totalExams || 0} Ujian</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/superadmin/schools/${s.id}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
                            title="Buka Detail Satuan Pendidikan"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {s.status === 'ACTIVE' ? (
                            <button
                              onClick={() => {
                                setStatusModal({ school: s, action: 'SUSPEND' });
                                setStatusReason('');
                                setStatusError('');
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition"
                              title="Tangguhkan Sekolah (Suspend)"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          ) : s.status === 'SUSPENDED' ? (
                            <button
                              onClick={() => {
                                setStatusModal({ school: s, action: 'ACTIVATE' });
                                setStatusReason('');
                                setStatusError('');
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                              title="Aktifkan Kembali Sekolah"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          ) : null}

                          {s.status !== 'ARCHIVED' && (
                            <button
                              onClick={() => {
                                setStatusModal({ school: s, action: 'ARCHIVE' });
                                setStatusReason('');
                                setStatusError('');
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Arsipkan Sekolah"
                            >
                              <Archive className="w-4 h-4" />
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

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Menampilkan {schools.length} dari {totalCount} satuan pendidikan
            </p>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        </div>

        {/* Modal 1: Create School */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Tambah Satuan Pendidikan Baru</h3>
                    <p className="text-[11px] text-slate-500">Akun Admin Sekolah awal akan dibuat otomatis secara aman</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateSchool} className="p-6 space-y-4 overflow-y-auto flex-1">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Satuan Pendidikan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: SMAN 1 Jakarta"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kode Sekolah (Unik) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: SMAN1JKT"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">NPSN</label>
                    <input
                      type="text"
                      placeholder="8 digit NPSN"
                      value={formData.npsn}
                      onChange={(e) => setFormData({ ...formData, npsn: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Jenjang</label>
                    <select
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="SD">SD / MI</option>
                      <option value="SMP">SMP / MTs</option>
                      <option value="SMA">SMA / MA</option>
                      <option value="SMK">SMK</option>
                      <option value="MADRASAH">Madrasah</option>
                      <option value="UMUM">Umum / PKBM</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Rayon / Wilayah</label>
                    <input
                      type="text"
                      placeholder="Contoh: Rayon 1 - Pusat"
                      value={formData.rayon}
                      onChange={(e) => setFormData({ ...formData, rayon: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kepala Sekolah</label>
                    <input
                      type="text"
                      placeholder="Nama lengkap & gelar"
                      value={formData.principalName}
                      onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">NIP Kepala Sekolah</label>
                    <input
                      type="text"
                      placeholder="NIP Kepala Sekolah"
                      value={formData.principalNip}
                      onChange={(e) => setFormData({ ...formData, principalNip: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email Resmi</label>
                    <input
                      type="email"
                      placeholder="kontak@sekolah.sch.id"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Telepon</label>
                    <input
                      type="text"
                      placeholder="021-xxxxxx"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Satuan Pendidikan</label>
                    <textarea
                      rows={2}
                      placeholder="Alamat lengkap jalan, kelurahan, kecamatan..."
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'Memproses...' : 'Simpan Satuan Pendidikan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Generated Credential Display */}
        {createdCredential && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Satuan Pendidikan Berhasil Dibuat</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Akun awal Administrator Sekolah telah di-generate dengan kata sandi acak yang aman.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Sekolah:</span>
                  <p className="font-bold text-slate-800">{createdCredential.schoolName}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Username Admin:</span>
                  <p className="font-mono font-bold text-sky-700">{createdCredential.username}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Password Sementara:</span>
                  <p className="font-mono font-bold text-rose-600 bg-white p-2 rounded-lg border border-slate-200 select-all">
                    {createdCredential.tempPassword}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 text-left">
                ⚠️ Catat atau salin kredensial ini sekarang. Admin sekolah diwajibkan mengganti kata sandi saat pertama kali login.
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    copyToClipboard(
                      `Kredensial Sagaya Exam - ${createdCredential.schoolName}\nUsername: ${createdCredential.username}\nPassword: ${createdCredential.tempPassword}`
                    )
                  }
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Tersalin!' : 'Salin Kredensial'}</span>
                </button>
                <button
                  onClick={() => setCreatedCredential(null)}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 3: Status Transition (Suspend / Activate / Archive) */}
        {statusModal.school && statusModal.action && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  statusModal.action === 'SUSPEND'
                    ? 'bg-amber-100 text-amber-700'
                    : statusModal.action === 'ARCHIVE'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {statusModal.action === 'SUSPEND' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : statusModal.action === 'ARCHIVE' ? (
                    <Archive className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Konfirmasi {statusModal.action === 'SUSPEND' ? 'Penangguhan' : statusModal.action === 'ARCHIVE' ? 'Pengarsipan' : 'Pengaktifan'} Sekolah
                  </h3>
                  <p className="text-xs text-slate-500">{statusModal.school.name}</p>
                </div>
              </div>

              {statusError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {statusError}
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                {statusModal.action === 'SUSPEND' ? (
                  'Saat ditangguhkan (SUSPENDED), akses seluruh guru dan admin sekolah akan ditolak oleh sistem isolasi tenant. Sesi aktif akan segera dicabut.'
                ) : statusModal.action === 'ARCHIVE' ? (
                  'Sekolah yang diarsipkan (ARCHIVED) tidak lagi dapat menyelenggarakan ujian aktif. Status arsip bersifat permanen.'
                ) : (
                  'Sekolah akan diaktifkan kembali dan seluruh wewenang admin serta guru dipulihkan.'
                )}
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Tindakan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Jelaskan alasan perubahan status (wajib dicatat pada audit log)..."
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStatusModal({ school: null, action: null })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleStatusAction}
                  disabled={statusSubmitting}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs disabled:opacity-50 ${
                    statusModal.action === 'SUSPEND'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : statusModal.action === 'ARCHIVE'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {statusSubmitting ? 'Memproses...' : 'Eksekusi Perubahan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
