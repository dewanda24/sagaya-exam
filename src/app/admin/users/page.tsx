'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  RefreshCw,
  KeyRound,
  LogOut,
  Power,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  UserCheck,
  Eye,
} from 'lucide-react';
import { User, UserRole } from '@/lib/core/types';

export default function SchoolUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    fullName: '',
    password: '',
    role: 'ADMIN' as UserRole,
    nip: '',
    nuptk: '',
    phone: '',
  });

  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (roleFilter !== 'ALL') query.set('role', roleFilter);

      const res = await fetch(`/api/admin/users?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        showToast(data.error || 'Gagal memuat pengguna.', 'error');
      }
    } catch {
      showToast('Koneksi ke server bermasalah.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Pengguna berhasil dibuat.');
        setShowCreateModal(false);
        setCreateForm({
          username: '',
          fullName: '',
          password: '',
          role: 'ADMIN',
          nip: '',
          nuptk: '',
          phone: '',
        });
        loadUsers();
      } else {
        showToast(data.error || 'Gagal membuat pengguna.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
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
        loadUsers();
      } else {
        showToast(data.error, 'error');
      }
    } catch {
      showToast('Gagal memproses perubahan status.', 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newPassword) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resetModalUser.id,
          action: 'RESET_PASSWORD',
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        setResetModalUser(null);
        setNewPassword('');
        loadUsers();
      } else {
        showToast(data.error, 'error');
      }
    } catch {
      showToast('Gagal me-reset password.', 'error');
    }
  };

  const handleRevokeSessions = async (user: User) => {
    if (!confirm(`Cabut seluruh sesi login aktif untuk ${user.fullName}? Pengguna akan dipaksa logout dari semua perangkat.`)) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          action: 'REVOKE_SESSIONS',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        loadUsers();
      } else {
        showToast(data.error, 'error');
      }
    } catch {
      showToast('Gagal mencabut sesi.', 'error');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`HAPUS PERMANEN akun ${user.fullName} (${user.username})? Tindakan ini tidak dapat dibatalkan.`)) return;

    try {
      const res = await fetch(`/api/admin/users?id=${user.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        loadUsers();
      } else {
        showToast(data.error, 'error');
      }
    } catch {
      showToast('Gagal menghapus pengguna.', 'error');
    }
  };

  return (
    <AdminLayout
      title="Manajemen Pengguna Sekolah"
      subtitle="Kelola akun Administrator Sekolah, Tenaga Pendidik (Guru), dan Pengawas Ruang."
      actions={
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Akun</span>
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

      {/* Control Bar: Search & Role Filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, username, NIP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {['ALL', 'ADMIN', 'GURU', 'PENGAWAS'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  roleFilter === r ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {r === 'ALL' ? 'Semua Role' : r}
              </button>
            ))}
          </div>

          <button
            onClick={loadUsers}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Pengguna</th>
                <th className="px-5 py-3.5">Peran / Otoritas</th>
                <th className="px-5 py-3.5">Kontak & NIP</th>
                <th className="px-5 py-3.5">Status Akun</th>
                <th className="px-5 py-3.5 text-right">Aksi Keamanan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Memuat data pengguna sekolah...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Tidak ada data pengguna yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs">
                          {u.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="font-semibold text-slate-900 hover:text-blue-600 transition"
                          >
                            {u.fullName}
                          </Link>
                          <p className="text-xs text-slate-500 font-mono">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          u.role === 'ADMIN'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : u.role === 'GURU'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {u.role === 'ADMIN' ? <ShieldCheck className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs text-slate-700">NIP: {u.nip || '-'}</p>
                      <p className="text-xs text-slate-500">HP: {u.phone || '-'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {u.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition"
                          title="Lihat Detail Pengguna"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setResetModalUser(u)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition"
                          title="Reset Password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRevokeSessions(u)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-amber-600 transition"
                          title="Force Logout (Cabut Sesi)"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`p-1.5 rounded-md hover:bg-slate-100 transition ${
                            u.isActive ? 'text-slate-500 hover:text-rose-600' : 'text-slate-500 hover:text-emerald-600'
                          }`}
                          title={u.isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition"
                          title="Hapus Akun"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tambah Akun Pengguna</h3>
                  <p className="text-xs text-slate-500">Buat akun Admin, Guru, atau Pengawas sekolah</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Peran / Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ADMIN">ADMIN (Administrator Sekolah Tambahan)</option>
                  <option value="GURU">GURU (Tenaga Pendidik / Pembuat Soal)</option>
                  <option value="PENGAWAS">PENGAWAS (Pengawas Ruang Ujian)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">SUPER_ADMIN tidak diizinkan dibuat dari level sekolah.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    placeholder="e.g. guru_matematika"
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

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nama Lengkap & Gelar *</label>
                <input
                  type="text"
                  required
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder="e.g. Ahmad Dahlan, S.Pd."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">NIP (Opsional)</label>
                  <input
                    type="text"
                    value={createForm.nip}
                    onChange={(e) => setCreateForm({ ...createForm, nip: e.target.value })}
                    placeholder="1980xxxx..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">No. WhatsApp</label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="0812xxxx"
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
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reset Password Pengguna</h3>
                  <p className="text-xs text-slate-500">Akun: {resetModalUser.fullName}</p>
                </div>
              </div>
              <button onClick={() => setResetModalUser(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 bg-amber-50/70 p-3 rounded-lg border border-amber-200">
                Password baru akan langsung aktif dan seluruh sesi login sebelumnya akan otomatis dicabut.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Password Baru *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 karakter"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition"
                >
                  Konfirmasi Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
