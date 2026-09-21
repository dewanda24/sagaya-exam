'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Users,
  UploadCloud,
  Download,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Sparkles,
  Key,
  GraduationCap,
  Filter,
  Building2,
  Check,
  Printer,
  FileSpreadsheet,
  Edit3,
  RotateCcw,
  Eye,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import Pagination from '@/components/common/Pagination';

interface StudentItem {
  id: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: string;
  classRoomId: string;
  classRoomName: string;
  cardAccessCode: string;
  schoolId?: string;
  schoolName?: string;
  isActive: boolean;
  createdAt: string;
}

interface ClassRoom {
  id: string;
  name: string;
  level: string;
}

interface SchoolItem {
  id: string;
  name: string;
  code: string;
}

export default function AdminSiswaPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // File Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single Add Form
  const [newForm, setNewForm] = useState({
    fullName: '',
    nisn: '',
    nis: '',
    gender: 'L',
    classRoomId: '',
    schoolId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Form
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    nisn: '',
    nis: '',
    gender: 'L',
    classRoomId: '',
    cardAccessCode: '',
  });
  const [isEditingSubmitting, setIsEditingSubmitting] = useState(false);
  const [resettingPinId, setResettingPinId] = useState<string | null>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/students?search=${encodeURIComponent(search)}&classId=${encodeURIComponent(
        selectedClass
      )}${selectedSchool ? `&schoolId=${selectedSchool}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setStudents(data.data.students);
        setClasses(data.data.classes);
        setSchools(data.data.schools || []);
        setIsSuperAdmin(data.data.isSuperAdmin);
        if (!newForm.schoolId && data.data.schools?.length > 0) {
          setNewForm((prev) => ({ ...prev, schoolId: data.data.schools[0].id }));
        }
      }
    } catch (err) {
      console.error(err);
      showNotification('Gagal memuat data siswa.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchStudents();

    const handleSchoolChanged = () => fetchStudents();
    window.addEventListener('sagaya:school-changed', handleSchoolChanged);
    return () => window.removeEventListener('sagaya:school-changed', handleSchoolChanged);
  }, [search, selectedClass, selectedSchool]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (selectedSchool) formData.append('schoolId', selectedSchool);

      const res = await fetch('/api/admin/import-students', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        showNotification(data.message);
        setShowImportModal(false);
        setUploadFile(null);
        fetchStudents();
      } else {
        showNotification(data.error || 'Gagal import siswa.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message);
        setShowAddModal(false);
        setNewForm({
          fullName: '',
          nisn: '',
          nis: '',
          gender: 'L',
          classRoomId: '',
          schoolId: schools[0]?.id || '',
        });
        fetchStudents();
      } else {
        showNotification(data.error || 'Gagal menambahkan siswa.', 'error');
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
      const res = await fetch(`/api/admin/students?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`Siswa "${deleteTarget.fullName}" berhasil dihapus.`);
        setDeleteTarget(null);
        fetchStudents();
      } else {
        showNotification(data.error || 'Gagal menghapus siswa.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = (student: StudentItem) => {
    setEditingStudent(student);
    setEditForm({
      fullName: student.fullName,
      nisn: student.nisn,
      nis: student.nis,
      gender: student.gender || 'L',
      classRoomId: student.classRoomId || '',
      cardAccessCode: student.cardAccessCode || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsEditingSubmitting(true);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStudent.id,
          fullName: editForm.fullName,
          nisn: editForm.nisn,
          nis: editForm.nis,
          gender: editForm.gender,
          classRoomId: editForm.classRoomId || null,
          cardAccessCode: editForm.cardAccessCode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Data siswa berhasil diperbarui!');
        setShowEditModal(false);
        fetchStudents();
      } else {
        showNotification(data.error || 'Gagal memperbarui siswa.', 'error');
      }
    } catch (err) {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  const handleResetPin = async (student: StudentItem) => {
    if (!confirm(`Reset PIN kartu ujian untuk ${student.fullName}? PIN lama tidak akan berlaku lagi.`)) return;
    setResettingPinId(student.id);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: student.id,
          action: 'RESET_PIN',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(`PIN ${student.fullName} berhasil di-reset: ${data.newPin}`);
        fetchStudents();
      } else {
        showNotification(data.error || 'Gagal mereset PIN.', 'error');
      }
    } catch (err) {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setResettingPinId(null);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        NISN: '0061234571',
        NIS: '22231005',
        'Nama Lengkap': 'Rizky Pratama',
        'Jenis Kelamin': 'L',
        Kelas: 'XII MIPA 1',
      },
      {
        NISN: '0061234572',
        NIS: '22231006',
        'Nama Lengkap': 'Nabila Maharani',
        'Jenis Kelamin': 'P',
        Kelas: 'XII MIPA 1',
      },
      {
        NISN: '0061234573',
        NIS: '22231007',
        'Nama Lengkap': 'Fajar Hidayat',
        'Jenis Kelamin': 'L',
        Kelas: 'XII IPS 1',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data_Siswa');
    XLSX.writeFile(wb, 'Template_Import_Siswa_Sagaya.xlsx');
  };

  return (
    <AdminLayout>
      {/* Toast Alert */}
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
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Manajemen Data Siswa & PIN Kartu
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Kelola data peserta didik, import massal spreadsheet, dan kode otentikasi kartu ujian.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Unduh Format Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-md shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Toolbar Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, NISN, atau NIS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-700"
            >
              <option value="">Semua Rombel / Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
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

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Memuat data siswa...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <div className="font-bold text-slate-800 text-base">Belum Ada Siswa Ditemukan</div>
            <p className="text-xs text-slate-400 mt-1">
              Gunakan tombol "Import Excel / CSV" untuk memasukkan ratusan siswa sekaligus.
            </p>
          </div>
        ) : (
          <div>
            <div className="w-full">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                    <th className="px-4 sm:px-6 py-3.5 w-[32%]">Nama Lengkap Siswa</th>
                    <th className="px-3 py-3.5 w-[18%]">NISN / NIS</th>
                    <th className="px-3 py-3.5 w-[14%]">Kelas</th>
                    <th className="px-3 py-3.5 w-[18%]">Satuan Pendidikan</th>
                    <th className="px-3 py-3.5 w-[10%] text-center">PIN Kartu</th>
                    <th className="px-4 sm:px-6 py-3.5 w-[8%] text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {students
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 sm:px-6 py-3.5">
                          <div className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                              {s.gender === 'P' ? 'P' : 'L'}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/admin/students/${s.id}`}
                                className="truncate font-bold text-slate-900 hover:text-blue-600 transition block"
                              >
                                {s.fullName}
                              </Link>
                              <div className="text-[10px] text-slate-400 font-normal">
                                {s.gender === 'P' ? 'Perempuan' : 'Laki-laki'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 font-mono">
                          <div className="font-bold text-slate-800 text-xs truncate">{s.nisn}</div>
                          <div className="text-[10px] text-slate-400 truncate">NIS: {s.nis}</div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="inline-block font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-[11px] truncate max-w-full">
                            {s.classRoomName}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1 min-w-0">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-800 truncate text-xs">
                              {s.schoolName || 'SMA Negeri 1 Sagaya'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className="font-mono font-black text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md">
                            {s.cardAccessCode}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/admin/students/${s.id}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Lihat Detail Siswa"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleResetPin(s)}
                              disabled={resettingPinId === s.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              title="Reset PIN Kartu Ujian"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${resettingPinId === s.id ? 'animate-spin text-indigo-600' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(s)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Edit Data Siswa"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(s)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Hapus Siswa"
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
              totalPages={Math.ceil(students.length / pageSize) || 1}
              totalItems={students.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              itemName="siswa"
            />
          </div>
        )}
      </div>

      {/* Modal: Import Excel / CSV */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">Import Siswa Massal</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unggah berkas Excel (.xlsx, .xls) atau CSV berstandar Dapodik.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              {isSuperAdmin && schools.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Satuan Pendidikan Sasaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedSchool}
                    onChange={(e) => setSelectedSchool(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white"
                  >
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition bg-slate-50/50 hover:bg-emerald-50/20"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <UploadCloud className="w-10 h-10 mx-auto text-emerald-600 mb-2" />
                <div className="text-xs font-bold text-slate-800">
                  {uploadFile ? uploadFile.name : 'Klik untuk memilih berkas spreadsheet'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Mendukung .xlsx, .xls, dan .csv
                </div>
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <strong>Kolom yang didukung:</strong> <code>NISN</code>, <code>NIS</code>, <code>Nama Lengkap</code>, <code>Jenis Kelamin (L/P)</code>, <code>Kelas</code>. PIN Akses kartu ujian akan digenerate otomatis jika kosong.
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
                >
                  {isUploading ? (
                    <span>Memproses Import...</span>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Mulai Import</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Single Student */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">Tambah Siswa Individual</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Input data siswa manual satu per satu ke database.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {isSuperAdmin && schools.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Satuan Pendidikan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newForm.schoolId}
                    onChange={(e) => setNewForm({ ...newForm, schoolId: e.target.value })}
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
                  Nama Lengkap Siswa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newForm.fullName}
                  onChange={(e) => setNewForm({ ...newForm, fullName: e.target.value })}
                  placeholder="Contoh: Muhammad Rizky"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NISN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newForm.nisn}
                    onChange={(e) => setNewForm({ ...newForm, nisn: e.target.value })}
                    placeholder="0061234567"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIS (Nomor Induk)
                  </label>
                  <input
                    type="text"
                    value={newForm.nis}
                    onChange={(e) => setNewForm({ ...newForm, nis: e.target.value })}
                    placeholder="22231001"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jenis Kelamin <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newForm.gender}
                    onChange={(e) => setNewForm({ ...newForm, gender: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rombel / Kelas <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newForm.classRoomId}
                    onChange={(e) => setNewForm({ ...newForm, classRoomId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                  >
                    <option value="">Pilih Kelas...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                      <span>Simpan Siswa</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Siswa */}
      {showEditModal && editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Edit Data Siswa</h3>
                  <p className="text-xs text-slate-400 font-medium">Perbarui profil dan identitas peserta</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Siswa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NISN <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.nisn}
                    onChange={(e) => setEditForm({ ...editForm, nisn: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIS (Nomor Induk)
                  </label>
                  <input
                    type="text"
                    value={editForm.nis}
                    onChange={(e) => setEditForm({ ...editForm, nis: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jenis Kelamin <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rombel / Kelas <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={editForm.classRoomId}
                    onChange={(e) => setEditForm({ ...editForm, classRoomId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                  >
                    <option value="">Pilih Kelas...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PIN Akses Kartu Ujian
                </label>
                <input
                  type="text"
                  value={editForm.cardAccessCode}
                  onChange={(e) => setEditForm({ ...editForm, cardAccessCode: e.target.value.toUpperCase() })}
                  placeholder="SG-XXXX"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-mono uppercase font-bold"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isEditingSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition flex items-center gap-2"
                >
                  {isEditingSubmitting ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan Perubahan</span>
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
        title="Hapus Data Siswa"
        itemName={deleteTarget ? `${deleteTarget.fullName} (NISN: ${deleteTarget.nisn} - ${deleteTarget.classRoomName})` : ''}
        description="Data siswa beserta riwayat pengerjaan ujian dan nilai yang terkait akan dihapus secara permanen dari basis data."
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}
