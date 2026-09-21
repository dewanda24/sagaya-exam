'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Clock,
  Building2,
  Lock,
  Layers,
  Sparkles,
  Users,
  Check,
  X,
  Play,
  CheckCheck,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import Pagination from '@/components/common/Pagination';

interface RegionalExamItem {
  id: string;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  passingGrade: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  subjectName?: string;
  totalAssignedSchools: number;
  totalParticipants: number;
  totalQuestions: number;
  createdAt: string;
}

interface SchoolOption {
  id: string;
  name: string;
  code: string;
  level: string;
  status: string;
}

export default function SuperAdminRegionalExamsPage() {
  const [exams, setExams] = useState<RegionalExamItem[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 12;

  // Create Exam Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    startTime: '',
    endTime: '',
    durationMinutes: 90,
    passingGrade: 75,
    randomizeQuestions: true,
    randomizeOptions: true,
    showScorePolicy: 'AFTER_ALL_DONE' as 'AFTER_ALL_DONE' | 'IMMEDIATELY' | 'NEVER',
    assignedSchoolIds: [] as string[],
  });

  // Assign Schools Modal
  const [assignModal, setAssignModal] = useState<{ exam: RegionalExamItem | null }>({ exam: null });
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const loadExams = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const [examsRes, schoolsRes] = await Promise.all([
        fetch(`/api/superadmin/exams?${params.toString()}`),
        fetch('/api/superadmin/schools?limit=100'),
      ]);

      const examsJson = await examsRes.json();
      const schoolsJson = await schoolsRes.json();

      if (examsJson.success) {
        setExams(examsJson.data || []);
        setTotalPages(examsJson.pagination?.totalPages || 1);
        setTotalCount(examsJson.pagination?.total || 0);
      }

      if (schoolsJson.success && schoolsJson.data) {
        setSchools(schoolsJson.data);
      }
    } catch (err) {
      console.error('Failed to load regional exams:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, [currentPage, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadExams();
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateError('');

    try {
      const res = await fetch('/api/superadmin/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal membuat paket ujian.');

      setShowCreateModal(false);
      loadExams();
    } catch (err: any) {
      setCreateError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleOpenAssign = async (exam: RegionalExamItem) => {
    setAssignModal({ exam });
    try {
      const res = await fetch(`/api/superadmin/exams/${exam.id}`);
      const json = await res.json();
      if (json.success && json.data?.assignedSchools) {
        setSelectedSchoolIds(json.data.assignedSchools.map((s: any) => s.id));
      } else {
        setSelectedSchoolIds([]);
      }
    } catch {
      setSelectedSchoolIds([]);
    }
  };

  const handleSaveAssignedSchools = async () => {
    if (!assignModal.exam) return;
    setAssignSubmitting(true);

    try {
      const res = await fetch(`/api/superadmin/exams/${assignModal.exam.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ASSIGN_SCHOOLS',
          schoolIds: selectedSchoolIds,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal menugaskan sekolah.');

      setAssignModal({ exam: null });
      loadExams();
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat menugaskan sekolah.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleTransitionStatus = async (examId: string, status: string) => {
    try {
      const res = await fetch(`/api/superadmin/exams/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRANSITION_STATUS',
          status,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal mengubah status ujian.');
      loadExams();
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem.');
    }
  };

  return (
    <SuperAdminLayout
      title="Ujian Serentak Wilayah"
      subtitle="Penyelenggaraan asesmen gabungan, penjadwalan terpusat, dan penugasan satuan pendidikan"
      actions={
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Ujian Serentak</span>
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
                placeholder="Cari judul ujian atau mata pelajaran..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500 text-slate-800"
              />
            </form>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium"
              >
                <option value="ALL">Semua Status</option>
                <option value="DRAFT">Draf (DRAFT)</option>
                <option value="SCHEDULED">Terjadwal (SCHEDULED)</option>
                <option value="PUBLISHED">Terbit (PUBLISHED)</option>
                <option value="RUNNING">Sedang Berjalan (RUNNING)</option>
                <option value="COMPLETED">Selesai (COMPLETED)</option>
              </select>

              <button
                onClick={loadExams}
                title="Muat Ulang"
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Exams Grid Cards */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
            Memuat daftar ujian serentak wilayah...
          </div>
        ) : exams.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            Belum ada paket ujian wilayah yang dibuat.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:border-sky-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
                      Wilayah
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      exam.status === 'RUNNING' || exam.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : exam.status === 'PUBLISHED'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : exam.status === 'SCHEDULED'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : exam.status === 'COMPLETED'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-slate-50 text-slate-600'
                    }`}>
                      {exam.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm mb-1">
                    <Link
                      href={`/superadmin/exams/${exam.id}`}
                      className="hover:text-sky-600 transition hover:underline"
                    >
                      {exam.title}
                    </Link>
                  </h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(exam.startTime).toLocaleDateString('id-ID')}</span> &bull; <span>{exam.durationMinutes} menit</span>
                  </p>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sekolah Ditugaskan:</span>
                      <span className="font-bold text-slate-800">{exam.totalAssignedSchools} sekolah</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Peserta:</span>
                      <span className="font-bold text-slate-800">{exam.totalParticipants} siswa</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Naskah Soal:</span>
                      <span className="font-bold text-slate-800">{exam.totalQuestions} butir</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleOpenAssign(exam)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                  >
                    <Building2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>Tugaskan Sekolah</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {exam.status === 'DRAFT' && (
                      <button
                        onClick={() => handleTransitionStatus(exam.id, 'SCHEDULED')}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px]"
                      >
                        Jadwalkan
                      </button>
                    )}
                    {(exam.status === 'SCHEDULED' || exam.status === 'DRAFT') && (
                      <button
                        onClick={() => handleTransitionStatus(exam.id, 'PUBLISHED')}
                        className="px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px]"
                      >
                        Publish
                      </button>
                    )}
                    {exam.status === 'PUBLISHED' && (
                      <button
                        onClick={() => handleTransitionStatus(exam.id, 'RUNNING')}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" /> Mulai
                      </button>
                    )}
                    {exam.status === 'RUNNING' && (
                      <button
                        onClick={() => handleTransitionStatus(exam.id, 'COMPLETED')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-[11px]"
                      >
                        Selesaikan
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Menampilkan {exams.length} dari {totalCount} paket ujian wilayah
          </p>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
          />
        </div>

        {/* Modal 1: Create Regional Exam */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-sky-600" />
                  Buat Ujian Serentak Wilayah Baru
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateExam} className="p-6 space-y-4 overflow-y-auto flex-1">
                {createError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {createError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Judul Ujian Serentak <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Asesmen Standarisasi Wilayah Semester Ganjil"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Waktu Mulai <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Waktu Selesai <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Durasi Pengerjaan (Menit) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={360}
                      required
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Standar KKM / KKTP</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={100}
                      value={formData.passingGrade}
                      onChange={(e) => setFormData({ ...formData, passingGrade: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.randomizeQuestions}
                      onChange={(e) => setFormData({ ...formData, randomizeQuestions: e.target.checked })}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    Acak Urutan Soal (Question Randomization)
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.randomizeOptions}
                      onChange={(e) => setFormData({ ...formData, randomizeOptions: e.target.checked })}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    Acak Opsi Pilihan Jawaban (Option Randomization)
                  </label>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {createSubmitting ? 'Menyimpan...' : 'Buat Ujian'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Assign Schools */}
        {assignModal.exam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tugaskan Satuan Pendidikan</h3>
                  <p className="text-xs text-slate-500 truncate max-w-xs">{assignModal.exam.title}</p>
                </div>
                <button
                  onClick={() => setAssignModal({ exam: null })}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-100 text-xs">
                {schools.length === 0 ? (
                  <p className="py-8 text-center text-slate-400">Tidak ada sekolah yang tersedia.</p>
                ) : (
                  schools.map((s) => {
                    const isSelected = selectedSchoolIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50/70 rounded-xl cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSchoolIds([...selectedSchoolIds, s.id]);
                              } else {
                                setSelectedSchoolIds(selectedSchoolIds.filter((id) => id !== s.id));
                              }
                            }}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <div>
                            <span className="font-bold text-slate-800">{s.name}</span>
                            <p className="text-[10px] text-slate-400 font-mono">Kode: {s.code} &bull; Jenjang: {s.level}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {s.status}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {selectedSchoolIds.length} sekolah dipilih
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAssignModal({ exam: null })}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveAssignedSchools}
                    disabled={assignSubmitting}
                    className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {assignSubmitting ? 'Menyimpan...' : 'Simpan Penugasan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
