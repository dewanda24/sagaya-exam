'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  CalendarRange,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface Semester {
  id: string;
  academicYearId: string;
  name: string;
  semesterNumber: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}

interface AcademicYear {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  semesters?: Semester[];
}

export default function AcademicYearsPage() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [showYearModal, setShowYearModal] = useState(false);
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Year Form
  const [yearForm, setYearForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isActive: false,
  });

  // Semester Form
  const [semForm, setSemForm] = useState({
    name: 'Ganjil',
    semesterNumber: 1,
    startDate: '',
    endDate: '',
    isActive: false,
  });

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAcademicYears = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/academic-years');
      const json = await res.json();
      if (json.success) {
        setAcademicYears(json.data.academicYears || []);
      } else {
        showNotification(json.error?.message || 'Gagal memuat tahun ajaran', 'error');
      }
    } catch {
      showNotification('Koneksi jaringan gagal', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearForm.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_YEAR',
          name: yearForm.name,
          startDate: yearForm.startDate || undefined,
          endDate: yearForm.endDate || undefined,
          isActive: yearForm.isActive,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification('Tahun ajaran berhasil dibuat!');
        setShowYearModal(false);
        setYearForm({ name: '', startDate: '', endDate: '', isActive: false });
        fetchAcademicYears();
      } else {
        showNotification(json.error?.message || 'Gagal membuat tahun ajaran', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateYear = async (id: string) => {
    try {
      const res = await fetch('/api/admin/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ACTIVATE_YEAR',
          id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification('Tahun ajaran aktif diperbarui!');
        fetchAcademicYears();
      } else {
        showNotification(json.error?.message || 'Gagal mengaktifkan tahun ajaran', 'error');
      }
    } catch {
      showNotification('Gagal menghubungi server', 'error');
    }
  };

  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYearId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_SEMESTER',
          academicYearId: selectedYearId,
          name: semForm.name,
          semesterNumber: Number(semForm.semesterNumber),
          startDate: semForm.startDate || undefined,
          endDate: semForm.endDate || undefined,
          isActive: semForm.isActive,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification('Semester berhasil dibuat!');
        setShowSemesterModal(false);
        fetchAcademicYears();
      } else {
        showNotification(json.error?.message || 'Gagal membuat semester', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateSemester = async (id: string) => {
    try {
      const res = await fetch('/api/admin/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ACTIVATE_SEMESTER',
          id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification('Semester aktif diperbarui!');
        fetchAcademicYears();
      } else {
        showNotification(json.error?.message || 'Gagal mengaktifkan semester', 'error');
      }
    } catch {
      showNotification('Gagal menghubungi server', 'error');
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-rose-600 text-white shadow-rose-500/20'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {toast.message}
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <CalendarRange className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Tahun Ajaran & Semester
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Kelola siklus akademik aktif sekolah secara terisolasi dan terpadu.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowYearModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Tahun Ajaran
          </button>
        </div>

        {/* List of Academic Years */}
        {loading ? (
          <div className="flex justify-center items-center py-24 text-slate-400">
            <Clock className="w-6 h-6 animate-spin mr-2" />
            Memuat data tahun ajaran...
          </div>
        ) : academicYears.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-12 text-center">
            <CalendarRange className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Belum ada Tahun Ajaran</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Mulai konfigurasi siklus pembelajaran sekolah dengan membuat tahun ajaran pertama Anda.
            </p>
            <button
              onClick={() => setShowYearModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 cursor-pointer"
            >
              Buat Tahun Ajaran Sekarang
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {academicYears.map((ay) => (
              <div
                key={ay.id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-6 transition-all shadow-sm ${
                  ay.isActive
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        ay.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{ay.name}</h2>
                        {ay.isActive && (
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-xs font-semibold">
                            Tahun Aktif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {ay.startDate ? new Date(ay.startDate).toLocaleDateString('id-ID') : 'Mulai TBD'} -{' '}
                        {ay.endDate ? new Date(ay.endDate).toLocaleDateString('id-ID') : 'Selesai TBD'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!ay.isActive ? (
                      <button
                        onClick={() => handleActivateYear(ay.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        <ToggleLeft className="w-4 h-4 text-slate-400" />
                        Jadikan Aktif
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" /> Berjalan
                      </span>
                    )}

                    <button
                      onClick={() => {
                        setSelectedYearId(ay.id);
                        setShowSemesterModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Semester
                    </button>
                  </div>
                </div>

                {/* Semesters list under this Academic Year */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Semester Terdaftar ({ay.semesters?.length || 0})
                  </h3>

                  {(!ay.semesters || ay.semesters.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Belum ada semester untuk tahun ajaran ini.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ay.semesters.map((sem) => (
                        <div
                          key={sem.id}
                          className={`flex items-center justify-between p-3.5 rounded-xl border ${
                            sem.isActive
                              ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                Semester {sem.semesterNumber} ({sem.name})
                              </span>
                              {sem.isActive && (
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[10px] font-bold rounded-md">
                                  Aktif
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {sem.startDate ? new Date(sem.startDate).toLocaleDateString('id-ID') : 'TBD'} -{' '}
                              {sem.endDate ? new Date(sem.endDate).toLocaleDateString('id-ID') : 'TBD'}
                            </p>
                          </div>

                          {!sem.isActive && (
                            <button
                              onClick={() => handleActivateSemester(sem.id)}
                              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-xs text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer transition-colors"
                            >
                              Aktifkan
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Create Academic Year */}
        {showYearModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tambah Tahun Ajaran</h3>
                <p className="text-xs text-slate-500 mt-1">Buat rentang siklus tahun akademik baru.</p>
              </div>

              <form onSubmit={handleCreateYear} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Tahun Ajaran *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 2026/2027"
                    value={yearForm.name}
                    onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tanggal Mulai
                    </label>
                    <input
                      type="date"
                      value={yearForm.startDate}
                      onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tanggal Selesai
                    </label>
                    <input
                      type="date"
                      value={yearForm.endDate}
                      onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={yearForm.isActive}
                    onChange={(e) => setYearForm({ ...yearForm, isActive: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Jadikan tahun ajaran aktif sekarang
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowYearModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Create Semester */}
        {showSemesterModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tambah Semester</h3>
                <p className="text-xs text-slate-500 mt-1">Tambahkan periode semester di bawah tahun ajaran ini.</p>
              </div>

              <form onSubmit={handleCreateSemester} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Semester
                  </label>
                  <select
                    value={semForm.semesterNumber}
                    onChange={(e) =>
                      setSemForm({
                        ...semForm,
                        semesterNumber: Number(e.target.value),
                        name: Number(e.target.value) === 1 ? 'Ganjil' : 'Genap',
                      })
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={1}>Semester 1 (Ganjil)</option>
                    <option value={2}>Semester 2 (Genap)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tanggal Mulai
                    </label>
                    <input
                      type="date"
                      value={semForm.startDate}
                      onChange={(e) => setSemForm({ ...semForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tanggal Selesai
                    </label>
                    <input
                      type="date"
                      value={semForm.endDate}
                      onChange={(e) => setSemForm({ ...semForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={semForm.isActive}
                    onChange={(e) => setSemForm({ ...semForm, isActive: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Jadikan semester aktif
                  </span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowSemesterModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
