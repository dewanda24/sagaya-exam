'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  Building2,
  Check,
  Sparkles,
} from 'lucide-react';
import { Subject } from '@/lib/core/types';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import Pagination from '@/components/common/Pagination';

interface SchoolItem {
  id: string;
  name: string;
  code: string;
}

export default function AdminMapelPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    schoolId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/subjects?search=${encodeURIComponent(search)}${
        selectedSchool ? `&schoolId=${selectedSchool}` : ''
      }`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setSubjects(json.data.subjects);
        setSchools(json.data.schools || []);
        setIsSuperAdmin(json.data.isSuperAdmin);
        if (!formData.schoolId && json.data.schools?.length > 0) {
          setFormData((prev) => ({ ...prev, schoolId: json.data.schools[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
      showNotification('Gagal memuat mata pelajaran.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchSubjects();

    const handleSchoolChanged = () => fetchSubjects();
    window.addEventListener('sagaya:school-changed', handleSchoolChanged);
    return () => window.removeEventListener('sagaya:school-changed', handleSchoolChanged);
  }, [search, selectedSchool]);

  const openCreateModal = () => {
    setEditingSubject(null);
    setFormData({
      code: '',
      name: '',
      schoolId: schools[0]?.id || '',
    });
    setShowModal(true);
  };

  const openEditModal = (sub: Subject) => {
    setEditingSubject(sub);
    setFormData({
      code: sub.code,
      name: sub.name,
      schoolId: sub.schoolId || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingSubject) {
        const res = await fetch('/api/admin/subjects', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingSubject.id,
            ...formData,
          }),
        });
        const json = await res.json();
        if (json.success) {
          showNotification('Mata pelajaran berhasil diperbarui!');
          setShowModal(false);
          fetchSubjects();
        } else {
          showNotification(json.error || 'Gagal menyimpan perubahan.', 'error');
        }
      } else {
        const res = await fetch('/api/admin/subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const json = await res.json();
        if (json.success) {
          showNotification('Mata pelajaran baru berhasil ditambahkan!');
          setShowModal(false);
          fetchSubjects();
        } else {
          showNotification(json.error || 'Gagal menambahkan mata pelajaran.', 'error');
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
      const res = await fetch(`/api/admin/subjects?id=${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showNotification(`Mata pelajaran "${deleteTarget.name}" berhasil dihapus.`);
        setDeleteTarget(null);
        fetchSubjects();
      } else {
        showNotification(json.error || 'Gagal menghapus mata pelajaran.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Terjadi kesalahan saat menghapus.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalQuestions = subjects.reduce((acc, s) => acc + (s.questionCount || 0), 0);

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
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Manajemen Mata Pelajaran
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Kelola daftar mata pelajaran, kode kurikulum, dan integrasi butir bank soal per lembaga.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Mata Pelajaran</span>
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Mata Pelajaran Aktif</div>
            <div className="text-2xl font-black text-slate-900">{subjects.length} Mapel</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Total Butir Soal Terkait</div>
            <div className="text-2xl font-black text-slate-900">{totalQuestions} Butir Soal</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari mata pelajaran atau kode mapel (e.g. MAT-12)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition"
          />
        </div>

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

      {/* Subjects Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Memuat mata pelajaran...</div>
        ) : subjects.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <div className="font-bold text-slate-800 text-base">Belum Ada Mata Pelajaran</div>
            <p className="text-xs text-slate-400 mt-1">
              Tambahkan mata pelajaran pertama dengan mengklik tombol "Tambah Mata Pelajaran".
            </p>
          </div>
        ) : (
          <div>
            <div className="w-full">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                    <th className="px-4 sm:px-6 py-3.5 w-[18%]">Kode Mapel</th>
                    <th className="px-3 py-3.5 w-[36%]">Nama Mata Pelajaran</th>
                    <th className="px-3 py-3.5 w-[24%]">Satuan Pendidikan</th>
                    <th className="px-3 py-3.5 w-[14%] text-center">Bank Soal</th>
                    <th className="px-4 sm:px-6 py-3.5 w-[8%] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {subjects
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((sub: any) => (
                      <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 sm:px-6 py-3.5">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[11px]">
                            {sub.code}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 font-black text-slate-900 text-xs sm:text-sm truncate">
                          {sub.name}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate text-xs">
                              {sub.schoolName || 'SMA Negeri 1 Sagaya'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              sub.questionCount > 0
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{sub.questionCount} Soal</span>
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(sub)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              title="Edit Mapel"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(sub)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Hapus Mapel"
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
              totalPages={Math.ceil(subjects.length / pageSize) || 1}
              totalItems={subjects.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              itemName="mata pelajaran"
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
                  {editingSubject ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur kode mapel kurikulum dan nama mata pelajaran.
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
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white"
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
                  Kode Mapel <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="Contoh: MAT-12 / FIS-11 / BIND-10"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Matematika Wajib"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-semibold"
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
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingSubject ? 'Simpan Perubahan' : 'Tambahkan Mapel'}</span>
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
        title="Hapus Mata Pelajaran"
        itemName={deleteTarget ? `${deleteTarget.name} (${deleteTarget.code})` : ''}
        description="Mata pelajaran ini akan dihapus permanen. Soal pada bank soal yang terkait dengan mata pelajaran ini akan terpengaruh."
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
