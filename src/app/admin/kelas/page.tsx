'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  Users,
  Building2,
  Check,
  Calendar,
  Filter,
  Eye,
} from 'lucide-react';
import { ClassRoom } from '@/lib/core/types';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import Pagination from '@/components/common/Pagination';

interface SchoolItem {
  id: string;
  name: string;
  code: string;
  level: string;
}

export default function AdminKelasPage() {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassRoom | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    level: '12',
    academicYear: '2025/2026',
    schoolId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/classes?search=${encodeURIComponent(search)}${
        selectedSchool ? `&schoolId=${selectedSchool}` : ''
      }`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setClasses(json.data.classes);
        setSchools(json.data.schools || []);
        setIsSuperAdmin(json.data.isSuperAdmin);
        if (!formData.schoolId && json.data.schools?.length > 0) {
          setFormData((prev) => ({ ...prev, schoolId: json.data.schools[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
      showNotification('Gagal memuat data rombel/kelas.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchClasses();

    const handleSchoolChanged = () => fetchClasses();
    window.addEventListener('sagaya:school-changed', handleSchoolChanged);
    return () => window.removeEventListener('sagaya:school-changed', handleSchoolChanged);
  }, [search, selectedSchool, selectedLevel]);

  const openCreateModal = () => {
    setEditingClass(null);
    setFormData({
      name: '',
      level: '12',
      academicYear: '2025/2026',
      schoolId: schools[0]?.id || '',
    });
    setShowModal(true);
  };

  const openEditModal = (c: ClassRoom) => {
    setEditingClass(c);
    setFormData({
      name: c.name,
      level: c.level,
      academicYear: c.academicYear || '',
      schoolId: c.schoolId || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingClass) {
        const res = await fetch('/api/admin/classes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingClass.id,
            ...formData,
          }),
        });
        const json = await res.json();
        if (json.success) {
          showNotification('Rombel berhasil diperbarui!');
          setShowModal(false);
          fetchClasses();
        } else {
          showNotification(json.error || 'Gagal menyimpan perubahan.', 'error');
        }
      } else {
        const res = await fetch('/api/admin/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (json.success) {
          showNotification('Rombel baru berhasil dibuat!');
          setShowModal(false);
          fetchClasses();
        } else {
          showNotification(json.error || 'Gagal menambahkan rombel.', 'error');
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
      const res = await fetch(`/api/admin/classes?id=${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showNotification(`Rombel "${deleteTarget.name}" berhasil dihapus.`);
        setDeleteTarget(null);
        fetchClasses();
      } else {
        showNotification(json.error || 'Gagal menghapus rombel.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Terjadi kesalahan saat menghapus.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredClasses = classes.filter((c) => {
    if (selectedLevel && c.level !== selectedLevel) return false;
    return true;
  });

  const totalStudents = classes.reduce((acc, c) => acc + (c.studentCount || 0), 0);

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
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Manajemen Rombel & Kelas
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Kelola rombongan belajar, alokasi tingkat kelas, dan pemetaan peserta ujian per satuan pendidikan.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Rombel Baru</span>
        </button>
      </div>

      {/* Quick Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Total Rombel</div>
            <div className="text-2xl font-black text-slate-900">{classes.length} Kelas</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Total Siswa Terdaftar</div>
            <div className="text-2xl font-black text-slate-900">{totalStudents} Siswa</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Tahun Ajaran Aktif</div>
            <div className="text-2xl font-black text-slate-900">2025/2026</div>
          </div>
        </div>
      </div>

      {/* Toolbar Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama rombel (e.g. XII MIPA 1)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Level Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-700"
            >
              <option value="">Semua Tingkat</option>
              <option value="10">Tingkat 10 / X</option>
              <option value="11">Tingkat 11 / XI</option>
              <option value="12">Tingkat 12 / XII</option>
              <option value="7">Tingkat 7 / VII</option>
              <option value="8">Tingkat 8 / VIII</option>
              <option value="9">Tingkat 9 / IX</option>
            </select>
          </div>

          {/* Super Admin School Filter */}
          {isSuperAdmin && schools.length > 0 && (
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-semibold text-slate-700 max-w-[200px]"
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

      {/* Class Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Memuat data rombel...</div>
        ) : filteredClasses.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Layers className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <div className="font-bold text-slate-800 text-base">Belum Ada Rombel Ditemukan</div>
            <p className="text-xs text-slate-400 mt-1">
              Tambahkan rombel pertama dengan mengklik tombol "Tambah Rombel Baru".
            </p>
          </div>
        ) : (
          <div>
            <div className="w-full">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                    <th className="px-4 sm:px-6 py-3.5 w-[30%]">Nama Rombel / Kelas</th>
                    <th className="px-3 py-3.5 w-[14%]">Tingkat</th>
                    <th className="px-3 py-3.5 w-[16%]">Tahun Ajaran</th>
                    <th className="px-3 py-3.5 w-[20%]">Lembaga Sekolah</th>
                    <th className="px-3 py-3.5 w-[12%] text-center">Jumlah Siswa</th>
                    <th className="px-4 sm:px-6 py-3.5 w-[8%] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {filteredClasses
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 sm:px-6 py-3.5">
                          <div className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {c.level}
                            </div>
                            <Link
                              href={`/admin/classes/${c.id}`}
                              className="truncate font-bold text-slate-900 hover:text-blue-600 transition"
                            >
                              {c.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-block font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded text-[11px]">
                            Kelas {c.level}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-slate-600 font-mono text-xs">
                          {c.academicYear}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate text-xs">
                              {c.schoolName || 'SMA Negeri 1 Sagaya'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              c.studentCount > 0
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <Users className="w-3 h-3" />
                            <span>{c.studentCount} Siswa</span>
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/admin/classes/${c.id}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Lihat Detail Kelas"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => openEditModal(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Edit Rombel"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Hapus Rombel"
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
              totalPages={Math.ceil(filteredClasses.length / pageSize) || 1}
              totalItems={filteredClasses.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              itemName="rombel"
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
                  {editingClass ? 'Edit Rombel' : 'Tambah Rombel Baru'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur nama rombel kelas dan tahun ajaran aktif.
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
              {/* School Select (if Super Admin) */}
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
                        {s.name} ({s.level})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Rombel / Kelas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: XII MIPA 1 / X TKJ 2"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tingkat Jenjang <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    placeholder="Contoh: 12 / 11 / 10 / 9"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tahun Ajaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    placeholder="2025/2026"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>
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
                      <span>{editingClass ? 'Simpan' : 'Tambahkan'}</span>
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
        title="Hapus Rombel / Kelas"
        itemName={deleteTarget ? `${deleteTarget.name} (Tingkat ${deleteTarget.level})` : ''}
        description="Rombel ini akan dihapus permanen. Pastikan siswa di dalamnya telah dipindahkan agar tidak terjadi inkonsistensi data."
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
