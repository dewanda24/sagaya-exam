'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  UserCheck,
  Plus,
  Search,
  RefreshCw,
  KeyRound,
  LogOut,
  Power,
  Calendar,
  DoorOpen,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { User } from '@/lib/core/types';

export default function SchoolProctorsPage() {
  const [proctors, setProctors] = useState<(User & { assignedRoomCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    fullName: '',
    password: '',
    nip: '',
    phone: '',
  });

  const [assignmentsProctor, setAssignmentsProctor] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadProctors = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);

      const res = await fetch(`/api/admin/proctors?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProctors(data.data);
      } else {
        showToast(data.error || 'Gagal memuat pengawas.', 'error');
      }
    } catch {
      showToast('Koneksi ke server bermasalah.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProctors();
  }, []);

  const handleCreateProctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/proctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        setShowCreateModal(false);
        setCreateForm({ username: '', fullName: '', password: '', nip: '', phone: '' });
        loadProctors();
      } else {
        showToast(data.error || 'Gagal menambahkan pengawas.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    }
  };

  const loadProctorAssignments = async (proctor: User) => {
    setAssignmentsProctor(proctor);
    setLoadingAssignments(true);
    try {
      const res = await fetch(`/api/admin/exam-proctors?proctorId=${proctor.id}`);
      const data = await res.json();
      if (data.success) {
        setAssignments(data.data);
      } else {
        setAssignments([]);
      }
    } catch {
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    if (!confirm(`Apakah Anda yakin ingin ${user.isActive ? 'menonaktifkan' : 'mengaktifkan'} akun ${user.fullName}?`)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          action: 'TOGGLE_STATUS',
          isActive: !user.isActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        loadProctors();
      } else {
        showToast(data.error, 'error');
      }
    } catch {
      showToast('Gagal memproses perubahan status.', 'error');
    }
  };

  return (
    <AdminLayout
      title="Manajemen Pengawas Ujian"
      subtitle="Kelola akun pengawas ruang ujian sekolah dan tinjau riwayat plotting pengawasan."
      actions={
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pengawas</span>
        </button>
      }
    >
      {/* Toast Notification */}
      {toast && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari pengawas atau NIP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadProctors()}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={loadProctors}
          className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition self-end"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Proctors Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Nama Pengawas</th>
                <th className="px-5 py-3.5">NIP & Kontak</th>
                <th className="px-5 py-3.5">Total Tugas Ruang</th>
                <th className="px-5 py-3.5">Status Akun</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Memuat data pengawas...
                  </td>
                </tr>
              ) : proctors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Belum ada pengawas terdaftar di sekolah ini.
                  </td>
                </tr>
              ) : (
                proctors.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center font-bold text-amber-700 text-xs">
                          {p.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{p.fullName}</p>
                          <p className="text-xs text-slate-500 font-mono">@{p.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs text-slate-700">NIP: {p.nip || '-'}</p>
                      <p className="text-xs text-slate-500">HP: {p.phone || '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => loadProctorAssignments(p)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                      >
                        <DoorOpen className="w-3.5 h-3.5 text-slate-500" />
                        <span>{p.assignedRoomCount} Penugasan Ruang</span>
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          p.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {p.isActive ? 'Aktif' : 'Dinonaktifkan'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`p-1.5 rounded-md hover:bg-slate-100 transition ${
                            p.isActive ? 'text-slate-500 hover:text-rose-600' : 'text-slate-500 hover:text-emerald-600'
                          }`}
                          title={p.isActive ? 'Nonaktifkan Pengawas' : 'Aktifkan Pengawas'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Proctor Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tambah Akun Pengawas</h3>
                  <p className="text-xs text-slate-500">Pengawas internal ruang ujian sekolah</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateProctor} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Lengkap & Gelar *</label>
                <input
                  type="text"
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="e.g. Budi Santoso, S.Pd."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    placeholder="pengawas_01"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Min. 6 karakter"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">NIP (Opsional)</label>
                  <input
                    type="text"
                    value={createForm.nip}
                    onChange={(e) => setCreateForm({ ...createForm, nip: e.target.value })}
                    placeholder="1985xxxx..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">No. WhatsApp</label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="0812xxxx..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
                >
                  Simpan Pengawas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignments History Drawer/Modal */}
      {assignmentsProctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Jadwal Pengawasan Ruang</h3>
                <p className="text-xs text-slate-500">Pengawas: {assignmentsProctor.fullName}</p>
              </div>
              <button onClick={() => setAssignmentsProctor(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto space-y-3">
              {loadingAssignments ? (
                <p className="text-center text-sm text-slate-400 py-6">Memuat jadwal...</p>
              ) : assignments.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">Belum ada jadwal pengawasan ruang untuk pengawas ini.</p>
              ) : (
                assignments.map((a) => (
                  <div key={a.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{a.exam_title || 'Ujian Sekolah'}</p>
                      <p className="text-xs text-slate-500">
                        Ruang: <span className="font-semibold text-slate-700">{a.room_name} ({a.room_code})</span> | Sesi {a.session_number}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-indigo-50 text-indigo-700">
                      Aktif
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setAssignmentsProctor(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-300 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
