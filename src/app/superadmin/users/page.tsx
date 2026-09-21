'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  LogOut,
  RefreshCw,
  Shield,
  Building2,
  Copy,
  Check,
  UserX,
  UserCheck,
  UserPlus,
  Edit3,
  Trash2,
  History,
  Download,
  Clock,
  X,
  ShieldAlert,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import Pagination from '@/components/common/Pagination';

interface PlatformUser {
  id: string;
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'GURU' | 'PENGAWAS';
  schoolId?: string;
  schoolName?: string;
  schoolCode?: string;
  isActive: boolean;
  sessionVersion: number;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  nip?: string;
}

interface SchoolOption {
  id: string;
  name: string;
  code: string;
  level: string;
}

interface UserAuditEvent {
  id: string;
  action: string;
  severity: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
  actorName: string;
  actorRole: string;
  details?: any;
}

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [schoolFilter, setSchoolFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 15;

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: '',
    username: '',
    role: 'GURU' as 'SUPER_ADMIN' | 'ADMIN' | 'GURU' | 'PENGAWAS',
    schoolId: '',
    nip: '',
    customPassword: '',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit Profile Modal
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    username: '',
    nip: '',
    schoolId: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Audit Trail Drawer / Modal
  const [auditUser, setAuditUser] = useState<PlatformUser | null>(null);
  const [auditLogs, setAuditLogs] = useState<UserAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Security Action Confirmation Modals
  const [actionModal, setActionModal] = useState<{
    user: PlatformUser | null;
    action: 'DISABLE' | 'ENABLE' | 'CHANGE_ROLE' | 'RESET_PASSWORD' | 'REVOKE_SESSIONS' | 'DELETE' | null;
  }>({ user: null, action: null });
  const [targetRole, setTargetRole] = useState<string>('ADMIN');
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  // Password / Creation Credential Modal
  const [credentialResult, setCredentialResult] = useState<{
    title: string;
    username: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Load School Options for dropdown
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const res = await fetch('/api/superadmin/users?type=schools');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSchools(json.data);
        }
      } catch (err) {
        console.error('Failed to load schools for dropdown:', err);
      }
    };
    fetchSchools();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });
      if (search.trim()) params.append('search', search.trim());
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (schoolFilter !== 'ALL') params.append('schoolId', schoolFilter);

      const res = await fetch(`/api/superadmin/users?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setUsers(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load platform users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentPage, roleFilter, statusFilter, schoolFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadUsers();
  };

  // Open User Audit Trail
  const handleOpenAudit = async (user: PlatformUser) => {
    setAuditUser(user);
    setAuditLoading(true);
    setAuditLogs([]);
    try {
      const res = await fetch(`/api/superadmin/users/${user.id}/audit?limit=25`);
      const json = await res.json();
      if (json.success) {
        setAuditLogs(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load user audit trail:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateError('');

    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE',
          fullName: createForm.fullName.trim(),
          username: createForm.username.trim(),
          role: createForm.role,
          schoolId: createForm.role === 'SUPER_ADMIN' ? undefined : createForm.schoolId,
          nip: createForm.nip.trim() || undefined,
          customPassword: createForm.customPassword.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal menambahkan pengguna.');

      setShowCreateModal(false);
      setCreateForm({
        fullName: '',
        username: '',
        role: 'GURU',
        schoolId: '',
        nip: '',
        customPassword: '',
      });

      setCredentialResult({
        title: 'Pengguna Berhasil Ditambahkan',
        username: json.user.username,
        tempPassword: json.tempPassword,
      });

      loadUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handle Edit User Profile
  const handleOpenEdit = (user: PlatformUser) => {
    setEditingUser(user);
    setEditForm({
      fullName: user.fullName,
      username: user.username,
      nip: user.nip || '',
      schoolId: user.schoolId || '',
    });
    setEditError('');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSubmitting(true);
    setEditError('');

    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          fullName: editForm.fullName.trim(),
          username: editForm.username.trim(),
          nip: editForm.nip.trim() || null,
          schoolId: editingUser.role === 'SUPER_ADMIN' ? null : editForm.schoolId || null,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal memperbarui profil pengguna.');

      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      setEditError(err.message || 'Terjadi kesalahan.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Security & Management Actions (Disable, Role, Password, Delete)
  const handleExecuteAction = async () => {
    if (!actionModal.user || !actionModal.action) return;

    setActionSubmitting(true);
    setActionError('');

    try {
      const { user, action } = actionModal;

      if (action === 'DELETE') {
        const params = new URLSearchParams({
          userId: user.id,
          reason: actionReason.trim() || 'Dihapus oleh Superadmin',
        });
        const res = await fetch(`/api/superadmin/users?${params.toString()}`, {
          method: 'DELETE',
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Gagal menghapus pengguna.');
      } else if (action === 'DISABLE' || action === 'ENABLE' || action === 'CHANGE_ROLE') {
        const res = await fetch('/api/superadmin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            action,
            role: action === 'CHANGE_ROLE' ? targetRole : undefined,
            reason: actionReason.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Gagal memproses aksi.');
      } else if (action === 'RESET_PASSWORD' || action === 'REVOKE_SESSIONS') {
        const res = await fetch('/api/superadmin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            action,
            reason: actionReason.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Gagal memproses aksi.');

        if (action === 'RESET_PASSWORD') {
          setCredentialResult({
            title: 'Kata Sandi Berhasil Direset',
            username: user.username,
            tempPassword: json.tempPassword,
          });
        }
      }

      setActionModal({ user: null, action: null });
      setActionReason('');
      loadUsers();
    } catch (err: any) {
      setActionError(err.message || 'Gagal mengeksekusi tindakan.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (users.length === 0) return;
    const headers = ['ID', 'Username', 'Nama Lengkap', 'Role', 'Satuan Pendidikan', 'Kode Sekolah', 'NIP', 'Status', 'Sesi Versi', 'Terakhir Login'];
    const rows = users.map((u) => [
      u.id,
      u.username,
      `"${u.fullName.replace(/"/g, '""')}"`,
      u.role,
      `"${(u.schoolName || '').replace(/"/g, '""')}"`,
      u.schoolCode || '',
      u.nip || '',
      u.isActive ? 'AKTIF' : 'NONAKTIF',
      u.sessionVersion,
      u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('id-ID') : 'Belum pernah',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pengguna_platform_sagaya_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SuperAdminLayout
      title="Manajemen Pengguna Platform"
      subtitle="Kelola staf platform, tim Super Administrator, Administrator Sekolah, Guru, dan Pengawas Ruang"
    >
      <div className="space-y-5">
        {/* Notice Info on Student CRUD */}
        <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200/80 text-sky-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-sky-600 shrink-0" />
            <span>
              <strong>Batas Wewenang Platform:</strong> Sesuai arsitektur isolasi data, peserta didik (Siswa) dikelola secara eksklusif oleh masing-masing Satuan Pendidikan. Modul ini mengelola personil platform (Super Admin, Admin Sekolah, Guru, Pengawas).
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-sky-300/80 text-sky-700 hover:bg-sky-100/50 font-bold text-xs shadow-2xs transition"
              title="Ekspor CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor CSV
            </button>
            <button
              onClick={() => {
                setShowCreateModal(true);
                setCreateError('');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-2xs transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Tambah Pengguna
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex flex-col lg:flex-row items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama lengkap, username, atau NIP staf..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500 text-slate-800"
              />
            </form>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-2 w-full lg:w-auto">
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium"
              >
                <option value="ALL">Semua Peran</option>
                <option value="SUPER_ADMIN">Super Administrator</option>
                <option value="ADMIN">Admin Sekolah</option>
                <option value="GURU">Guru Mata Pelajaran</option>
                <option value="PENGAWAS">Pengawas Ujian</option>
              </select>

              <select
                value={schoolFilter}
                onChange={(e) => {
                  setSchoolFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium max-w-[160px] truncate"
              >
                <option value="ALL">Semua Satuan Pendidikan</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
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
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif / Terkunci</option>
              </select>

              <button
                onClick={loadUsers}
                title="Muat Ulang"
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition flex items-center justify-center"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Nama Pengguna & Akun</th>
                  <th className="py-3 px-3">Peran (Role)</th>
                  <th className="py-3 px-3">Satuan Pendidikan</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Aktivitas Terakhir</th>
                  <th className="py-3 px-4 text-right">Aksi & Keamanan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 text-xs">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
                      Memuat data pengguna platform...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400 text-xs">
                      Tidak ada data staf pengguna yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <Link
                            href={`/superadmin/users/${u.id}`}
                            className="font-bold text-slate-900 hover:text-sky-600 transition hover:underline"
                          >
                            {u.fullName}
                          </Link>
                          <p className="text-[11px] text-slate-400">
                            Username: <span className="font-mono font-semibold text-slate-600">{u.username}</span>
                            {u.nip && ` • NIP: ${u.nip}`}
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          u.role === 'SUPER_ADMIN'
                            ? 'bg-amber-50 text-amber-800 border border-amber-300 font-black'
                            : u.role === 'ADMIN'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : u.role === 'GURU'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {u.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-medium text-slate-800 truncate">
                          {u.role === 'SUPER_ADMIN' ? 'Platform Global (Sagaya Exam)' : u.schoolName || '-'}
                        </p>
                        {u.schoolCode && <p className="text-[10px] text-slate-400 font-mono">{u.schoolCode}</p>}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {u.isActive ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {u.isActive ? 'AKTIF' : 'NONAKTIF'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <p className="text-slate-600 text-[11px]">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('id-ID') : 'Belum pernah'}
                        </p>
                        <span className="text-[10px] text-slate-400">Sesi v{u.sessionVersion}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Audit Trail Button */}
                          <button
                            onClick={() => handleOpenAudit(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
                            title="Rekam Jejak Audit & Aktivitas"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Edit Profile Button */}
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                            title="Edit Profil Pengguna"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setActionModal({ user: u, action: 'RESET_PASSWORD' });
                              setActionReason('');
                              setActionError('');
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition"
                            title="Reset Kata Sandi"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Revoke Sessions / Force Logout */}
                          <button
                            onClick={() => {
                              setActionModal({ user: u, action: 'REVOKE_SESSIONS' });
                              setActionReason('');
                              setActionError('');
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="Cabut Sesi Aktif (Force Logout)"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>

                          {/* Change Role */}
                          {u.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => {
                                setActionModal({ user: u, action: 'CHANGE_ROLE' });
                                setTargetRole(u.role);
                                setActionReason('');
                                setActionError('');
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition"
                              title="Ubah Peran"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          )}

                          {/* Disable / Enable Account */}
                          {u.isActive ? (
                            <button
                              onClick={() => {
                                setActionModal({ user: u, action: 'DISABLE' });
                                setActionReason('');
                                setActionError('');
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Nonaktifkan Akun"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setActionModal({ user: u, action: 'ENABLE' });
                                setActionReason('');
                                setActionError('');
                              }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition"
                              title="Aktifkan Kembali Akun"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete Account */}
                          <button
                            onClick={() => {
                              setActionModal({ user: u, action: 'DELETE' });
                              setActionReason('');
                              setActionError('');
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-100 transition"
                            title="Hapus / Arsip Akun"
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

          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Menampilkan {users.length} dari total {totalCount} staf platform terdaftar
            </span>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>

      {/* MODAL: TAMBAH PENGGUNA BARU */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tambah Pengguna Platform Baru</h3>
                  <p className="text-xs text-slate-500">Daftarkan akun staf baru ke dalam sistem</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Peran Pengguna (Role)</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-sky-500"
                >
                  <option value="GURU">Guru Mata Pelajaran</option>
                  <option value="PENGAWAS">Pengawas Ruang Ujian</option>
                  <option value="ADMIN">Administrator Satuan Pendidikan</option>
                  <option value="SUPER_ADMIN">Super Administrator (Platform Global)</option>
                </select>
              </div>

              {createForm.role !== 'SUPER_ADMIN' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan Pendidikan (Sekolah) *</label>
                  <select
                    required
                    value={createForm.schoolId}
                    onChange={(e) => setCreateForm({ ...createForm, schoolId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">-- Pilih Satuan Pendidikan --</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code} • {s.level})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    placeholder="misal: Dr. Budi Santoso, M.Pd"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Username Login *</label>
                  <input
                    type="text"
                    required
                    placeholder="misal: budi_santoso"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIP (Opsional)</label>
                  <input
                    type="text"
                    placeholder="198001012005011001"
                    value={createForm.nip}
                    onChange={(e) => setCreateForm({ ...createForm, nip: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kata Sandi (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Kosongkan untuk acak aman"
                    value={createForm.customPassword}
                    onChange={(e) => setCreateForm({ ...createForm, customPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center gap-1.5 shadow-2xs"
                >
                  {createSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PROFIL PENGGUNA */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Profil Pengguna</h3>
                  <p className="text-xs text-slate-500">Perbarui data profil akun {editingUser.username}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Username Login *</label>
                <input
                  type="text"
                  required
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">NIP (Opsional)</label>
                <input
                  type="text"
                  value={editForm.nip}
                  onChange={(e) => setEditForm({ ...editForm, nip: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {editingUser.role !== 'SUPER_ADMIN' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan Pendidikan</label>
                  <select
                    value={editForm.schoolId}
                    onChange={(e) => setEditForm({ ...editForm, schoolId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">-- Tetap / Tanpa Perubahan --</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-2xs"
                >
                  {editSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DRAWER AUDIT TRAIL PENGGUNA */}
      {auditUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Rekam Jejak Audit: {auditUser.fullName}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Username: <span className="font-mono text-slate-700">{auditUser.username}</span> • Peran: {auditUser.role}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAuditUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 text-xs">
              {auditLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
                  Memuat riwayat log audit pengguna...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  Belum ada catatan aktivitas audit untuk pengguna ini.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.severity === 'CRITICAL'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : log.severity === 'WARNING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {log.severity}
                        </span>
                        <span className="font-bold text-slate-800">{log.action}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Pelaku: <span className="font-semibold text-slate-700">{log.actorName}</span> ({log.actorRole})
                      {log.ipAddress && ` • IP: ${log.ipAddress}`}
                    </p>

                    {log.details && Object.keys(log.details).length > 0 && (
                      <pre className="p-2 rounded-lg bg-white border border-slate-200 text-[10px] font-mono text-slate-600 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setAuditUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AKSI KEAMANAN (DISABLE, ROLE, DELETE, FORCE LOGOUT) */}
      {actionModal.user && actionModal.action && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                actionModal.action === 'DELETE' || actionModal.action === 'DISABLE'
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-sky-50 text-sky-600'
              }`}>
                {actionModal.action === 'DELETE' ? (
                  <Trash2 className="w-5 h-5" />
                ) : actionModal.action === 'DISABLE' ? (
                  <UserX className="w-5 h-5" />
                ) : actionModal.action === 'ENABLE' ? (
                  <UserCheck className="w-5 h-5" />
                ) : actionModal.action === 'RESET_PASSWORD' ? (
                  <KeyRound className="w-5 h-5" />
                ) : actionModal.action === 'REVOKE_SESSIONS' ? (
                  <LogOut className="w-5 h-5" />
                ) : (
                  <Shield className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {actionModal.action === 'DELETE' && 'Konfirmasi Hapus Akun'}
                  {actionModal.action === 'DISABLE' && 'Konfirmasi Penonaktifan Akun'}
                  {actionModal.action === 'ENABLE' && 'Konfirmasi Pengaktifan Akun'}
                  {actionModal.action === 'RESET_PASSWORD' && 'Konfirmasi Reset Kata Sandi'}
                  {actionModal.action === 'REVOKE_SESSIONS' && 'Konfirmasi Pencabutan Sesi Aktif'}
                  {actionModal.action === 'CHANGE_ROLE' && 'Konfirmasi Pengubahan Peran'}
                </h3>
                <p className="text-xs text-slate-500">
                  Target: <strong>{actionModal.user.fullName}</strong> (@{actionModal.user.username})
                </p>
              </div>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {actionError}
              </div>
            )}

            {actionModal.action === 'CHANGE_ROLE' && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Peran Baru</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold"
                >
                  <option value="ADMIN">Administrator Satuan Pendidikan</option>
                  <option value="GURU">Guru Mata Pelajaran</option>
                  <option value="PENGAWAS">Pengawas Ujian</option>
                </select>
                <p className="mt-1 text-[11px] text-amber-600 font-medium">
                  * Mengubah peran otomatis mencabut seluruh sesi login yang sedang berlangsung.
                </p>
              </div>
            )}

            {(actionModal.action === 'DISABLE' || actionModal.action === 'DELETE' || actionModal.action === 'REVOKE_SESSIONS') && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Tindakan {actionModal.action === 'DELETE' && '*'}
                </label>
                <input
                  type="text"
                  required={actionModal.action === 'DELETE'}
                  placeholder="misal: Mutasi dinas / Permintaan kepala sekolah..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setActionModal({ user: null, action: null })}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={actionSubmitting}
                className={`px-4 py-2 rounded-xl text-white font-bold flex items-center gap-1.5 shadow-2xs transition ${
                  actionModal.action === 'DELETE' || actionModal.action === 'DISABLE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                {actionSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KATA SANDI / KREDENSIAL DIHASILKAN */}
      {credentialResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black text-slate-900">{credentialResult.title}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Kredensial untuk akun <strong className="text-slate-800">@{credentialResult.username}</strong> telah diperbarui.
            </p>

            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 flex items-center justify-between">
              <span className="font-bold text-sm tracking-wider select-all">{credentialResult.tempPassword}</span>
              <button
                onClick={() => copyToClipboard(credentialResult.tempPassword)}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                title="Salin Kata Sandi"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <p className="mt-2 text-[11px] text-amber-600 font-medium">
              * Pengguna diwajibkan mengubah kata sandi saat pertama kali masuk (*must_change_password*).
            </p>

            <button
              onClick={() => setCredentialResult(null)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-2xs"
            >
              Saya Telah Mencatat Kredensial Ini
            </button>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
}
