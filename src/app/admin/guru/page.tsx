'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  UserCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  Building2,
  Check,
  ShieldCheck,
  Key,
  Lock,
  Filter,
  Eye,
} from 'lucide-react';
import { User, UserRole } from '@/lib/core/types';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import Pagination from '@/components/common/Pagination';

interface SchoolItem {
  id: string;
  name: string;
  code: string;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
}

export default function AdminGuruPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    nip: '',
    assignedSubjects: [] as string[],
    role: 'GURU' as UserRole,
    schoolId: '',
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/teachers?search=${encodeURIComponent(search)}&role=${encodeURIComponent(
        roleFilter
      )}${selectedSchool ? `&schoolId=${selectedSchool}` : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setUsers(json.data.users);
        setSchools(json.data.schools || []);
        setSubjects(json.data.subjects || []);
        setIsSuperAdmin(json.data.isSuperAdmin);
        if (!formData.schoolId && json.data.schools?.length > 0) {
          setFormData((prev) => ({ ...prev, schoolId: json.data.schools[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
      showNotification('Gagal memuat data pengguna.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchUsers();

    const handleSchoolChanged = () => fetchUsers();
    window.addEventListener('sagaya:school-changed', handleSchoolChanged);
    return () => window.removeEventListener('sagaya:school-changed', handleSchoolChanged);
  }, [search, roleFilter, selectedSchool]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      fullName: '',
      nip: '',
      assignedSubjects: [],
      role: 'GURU',
      schoolId: schools[0]?.id || '',
      isActive: true,
    });
    setShowModal(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setFormData({
      username: u.username,
      password: '',
      fullName: u.fullName,
      nip: u.nip || '',
      assignedSubjects: u.assignedSubjects || [],
      role: u.role,
      schoolId: u.schoolId || '',
      isActive: u.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingUser) {
        const res = await fetch('/api/admin/teachers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingUser.id,
            fullName: formData.fullName,
            nip: formData.nip,
            assignedSubjects: formData.assignedSubjects,
            role: formData.role,
            schoolId: formData.schoolId,
            password: formData.password || undefined,
            isActive: formData.isActive,
          }),
        });
        const json = await res.json();
        if (json.success) {
          showNotification('Data pengguna berhasil diperbarui!');
          setShowModal(false);
          fetchUsers();
        } else {
          showNotification(json.error || 'Gagal memperbarui pengguna.', 'error');
        }
      } else {
        const res = await fetch('/api/admin/teachers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (json.success) {
          showNotification('Pengguna baru berhasil ditambahkan!');
          setShowModal(false);
          fetchUsers();
        } else {
          showNotification(json.error || 'Gagal menambahkan pengguna.', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showNotification('Terjadi kesalahan pada server.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/teachers?id=${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showNotification(`Akun "${deleteTarget.fullName}" dinonaktifkan.`);
        setDeleteTarget(null);
        fetchUsers();
      } else {
        showNotification(json.error || 'Gagal menonaktifkan pengguna.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Terjadi kesalahan saat menonaktifkan.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all animate-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Tenaga Pendidik & Pengawas
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Kelola hak akses Guru Pembuat Soal, Pengawas Ruang CBT, dan Administrator per satuan pendidikan.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Akun Baru</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau username pendidik..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-700"
            >
              <option value="">Semua Peran</option>
              <option value="GURU">Guru Mata Pelajaran</option>
              <option value="PENGAWAS">Pengawas Ruang</option>
              <option value="ADMIN">Admin Sekolah</option>
            </select>
          </div>

          {isSuperAdmin && schools.length > 0 && (
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-700 max-w-[200px]"
            >
              <option value="">Filter Sekolah (Semua)</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Memuat data tenaga pendidik...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <UserCheck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <div className="font-bold text-slate-800 text-base">Belum Ada Akun Ditemukan</div>
            <p className="text-xs text-slate-400 mt-1">
              Tambahkan akun guru atau pengawas pertama dengan mengklik tombol "Tambah Akun Baru".
            </p>
          </div>
        ) : (
          <div>
            <div className="w-full">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                    <th className="px-4 sm:px-6 py-3.5 w-[32%]">Nama Tenaga Pendidik</th>
                    <th className="px-3 py-3.5 w-[18%]">Username</th>
                    <th className="px-3 py-3.5 w-[16%]">Peran / Hak Akses</th>
                    <th className="px-3 py-3.5 w-[18%]">Satuan Pendidikan</th>
                    <th className="px-3 py-3.5 w-[8%] text-center">Status</th>
                    <th className="px-4 sm:px-6 py-3.5 w-[8%] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {users
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((u: any) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 sm:px-6 py-3.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                              {u.fullName?.charAt(0) || 'G'}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/admin/teachers/${u.id}`}
                                className="truncate font-bold text-slate-900 hover:text-blue-600 transition block"
                              >
                                {u.fullName}
                              </Link>
                              {u.nip ? (
                                <div className="text-[10px] text-slate-400 font-mono">NIP: {u.nip}</div>
                              ) : (
                                <div className="text-[10px] text-slate-400 font-medium italic">Non-NIP / GTT</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 font-mono font-bold text-slate-800 text-xs truncate">
                          @{u.username}
                        </td>
                        <td className="px-3 py-3.5">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-full ${
                              u.role === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : u.role === 'PENGAWAS'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {u.role === 'GURU' ? 'Guru Mapel' : u.role}
                          </span>
                          {u.role === 'GURU' && (
                            <div className="mt-1 flex flex-wrap gap-1 max-w-[200px]">
                              {u.assignedSubjects && u.assignedSubjects.length > 0 ? (
                                u.assignedSubjects.map((sId: string) => {
                                  const sObj = subjects.find((s) => s.id === sId);
                                  return (
                                    <span
                                      key={sId}
                                      className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold border border-slate-200/80"
                                      title={sObj?.name || 'Mata Pelajaran'}
                                    >
                                      {sObj ? sObj.code || sObj.name : 'Mapel'}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-[9px] text-slate-400 italic">Semua Mapel</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate text-xs">
                              {u.schoolName || 'SMA Negeri 1 Sagaya'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              u.isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {u.isActive ? 'Aktif' : 'Non-aktif'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/admin/teachers/${u.id}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Lihat Detail Guru"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Edit Pengguna & Password"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(u)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Nonaktifkan Pengguna"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
              totalPages={Math.ceil(users.length / pageSize) || 1}
              totalItems={users.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              itemName="pendidik"
            />
          </div>
        )}
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {editingUser ? 'Edit Akun Pengguna' : 'Tambah Tenaga Pendidik'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur kredensial login dan hak akses guru atau pengawas ruang.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSuperAdmin && schools.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Satuan Pendidikan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.schoolId}
                    onChange={(e) => setFormData({ ...formData, schoolId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap &amp; Gelar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Contoh: Dra. Sri Wahyuni, M.Pd."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NIP (Nomor Induk Pegawai)
                </label>
                <input
                  type="text"
                  value={formData.nip}
                  onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                  placeholder="18 digit NIP / Kosongkan jika Non-PNS/GTT"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Peran / Hak Akses <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="GURU">Guru Mata Pelajaran (Kelola Soal &amp; Koreksi)</option>
                  <option value="PENGAWAS">Pengawas Ruang (Monitoring Live &amp; Reset Login)</option>
                  <option value="ADMIN">Admin Sekolah (Akses Penuh Tingkat Sekolah)</option>
                </select>
              </div>

              {formData.role === 'GURU' && subjects.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Mata Pelajaran yang Diampu
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {formData.assignedSubjects.length === 0
                        ? 'Dapat akses semua mapel'
                        : `${formData.assignedSubjects.length} mapel dipilih`}
                    </span>
                  </div>
                  <div className="max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {subjects.map((s) => {
                      const isChecked = formData.assignedSubjects.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              assignedSubjects: isChecked
                                ? prev.assignedSubjects.filter((id) => id !== s.id)
                                : [...prev.assignedSubjects, s.id],
                            }));
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold transition border flex items-center justify-between gap-1 cursor-pointer ${
                            isChecked
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate">{s.name}</span>
                          {isChecked && <Check className="w-3 h-3 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Pilih mapel ajar guru ini. Jika dikosongkan, guru berwenang menyusun bank soal di semua mapel.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username Login <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingUser}
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().trim() })}
                  placeholder="sri.wahyuni / pengawas1"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {editingUser ? 'Ganti Password (Kosongkan jika tidak diubah)' : 'Password Login *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? '••••••••' : 'Minimal 6 karakter'}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingUser ? 'Simpan' : 'Tambahkan'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Nonaktifkan Pengguna"
        itemName={deleteTarget ? `${deleteTarget.fullName} (@${deleteTarget.username} - ${deleteTarget.role})` : ''}
        description="Akun ini tidak akan dapat login lagi ke sistem Sagaya Exam. Data riwayat ujian dan sesi pengawas sebelumnya akan tetap tersimpan aman."
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
