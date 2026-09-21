'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  HelpCircle,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Filter,
  Check,
  XCircle,
  GitBranch,
  FileQuestion,
  ChevronRight,
  ShieldCheck,
  Award,
} from 'lucide-react';
import MathRenderer from '@/components/common/MathRenderer';

interface QuestionItem {
  id: string;
  type: string;
  questionText: string;
  difficulty: string;
  points: number;
}

interface QuestionBankItem {
  id: string;
  code: string;
  title: string;
  subjectId: string;
  subjectName?: string;
  version: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  totalQuestions: number;
  creatorName?: string;
  questions?: QuestionItem[];
}

export default function QuestionBankPage() {
  const [banks, setBanks] = useState<QuestionBankItem[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [showBankModal, setShowBankModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState<QuestionBankItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Bank Form
  const [bankForm, setBankForm] = useState({
    title: '',
    code: '',
    subjectId: '',
  });

  // Question Form
  const [questionForm, setQuestionForm] = useState({
    type: 'MULTIPLE_CHOICE_SINGLE',
    difficulty: 'MEDIUM',
    points: 10,
    text: '',
    options: [
      { id: 'A', text: '', isCorrect: true },
      { id: 'B', text: '', isCorrect: false },
      { id: 'C', text: '', isCorrect: false },
      { id: 'D', text: '', isCorrect: false },
    ],
  });

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (statusFilter) query.set('status', statusFilter);

      const res = await fetch(`/api/admin/question-bank?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setBanks(json.data.questionBanks || []);
        setSubjects(json.data.subjects || []);
        if (!bankForm.subjectId && json.data.subjects?.length > 0) {
          setBankForm((prev) => ({ ...prev, subjectId: json.data.subjects[0].id }));
        }
      } else {
        showNotification(json.error?.message || 'Gagal memuat bank soal', 'error');
      }
    } catch {
      showNotification('Koneksi jaringan bermasalah', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, [search, statusFilter]);

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.title.trim() || !bankForm.subjectId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_BANK',
          title: bankForm.title,
          code: bankForm.code,
          subjectId: bankForm.subjectId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification('Bank soal berhasil dibuat!');
        setShowBankModal(false);
        setBankForm({ title: '', code: '', subjectId: subjects[0]?.id || '' });
        fetchBanks();
      } else {
        showNotification(json.error?.message || 'Gagal membuat bank soal', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan server', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (bankId: string, status: string) => {
    try {
      const res = await fetch('/api/admin/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          id: bankId,
          status,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification(`Status berhasil diubah ke ${status}!`);
        fetchBanks();
      } else {
        showNotification(json.error?.message || 'Gagal mengubah status bank soal', 'error');
      }
    } catch {
      showNotification('Koneksi gagal', 'error');
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBank || !questionForm.text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_QUESTION',
          questionBankId: selectedBank.id,
          question: {
            type: questionForm.type,
            difficulty: questionForm.difficulty,
            points: Number(questionForm.points),
            questionText: questionForm.text,
            options: questionForm.type.includes('MULTIPLE_CHOICE')
              ? questionForm.options.map((opt) => ({
                  id: opt.id,
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                }))
              : [],
            correctAnswers: questionForm.options.filter((o) => o.isCorrect).map((o) => o.id),
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification('Soal berhasil ditambahkan ke bank soal (versi baru terbentuk)!');
        setShowQuestionModal(false);
        fetchBanks();
      } else {
        showNotification(json.error?.message || 'Gagal menambahkan soal', 'error');
      }
    } catch {
      showNotification('Gagal menghubungi server', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
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
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Bank Soal & Versi Soal</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Kelola repositori butir soal sekolah, peninjauan moderasi, dan version tracking.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowBankModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Buat Bank Soal
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari judul atau kode bank soal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Semua Status Moderasi</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Menunggu Review</option>
              <option value="APPROVED">Disetujui (Approved)</option>
              <option value="REJECTED">Ditolak (Rejected)</option>
            </select>
          </div>
        </div>

        {/* Bank List */}
        {loading ? (
          <div className="flex justify-center items-center py-20 text-slate-400">
            <Clock className="w-6 h-6 animate-spin mr-2" />
            Memuat repositori bank soal...
          </div>
        ) : banks.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-12 text-center">
            <FileQuestion className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Belum ada Bank Soal</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Buat bank soal baru untuk mata pelajaran yang diajarkan di sekolah ini.
            </p>
            <button
              onClick={() => setShowBankModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 cursor-pointer"
            >
              Buat Bank Soal Baru
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {banks.map((b) => (
              <div
                key={b.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-indigo-400 transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-mono rounded-md">
                      {b.code || 'NO-CODE'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-md border border-indigo-200 dark:border-indigo-800/40">
                        <GitBranch className="w-3 h-3" /> v{b.version || 1}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                          b.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200'
                            : b.status === 'PENDING_REVIEW'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200'
                            : b.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-2 mb-1">
                    {b.title}
                  </h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-3">
                    {b.subjectName || 'Mata Pelajaran Umum'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl mb-4">
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400">Total Butir</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {b.totalQuestions || 0} Soal
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400">Pembuat</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate block">
                        {b.creatorName || 'Guru'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedBank(b);
                        setShowQuestionModal(true);
                      }}
                      className="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center"
                    >
                      + Tambah Soal
                    </button>

                    {b.status !== 'APPROVED' && (
                      <button
                        onClick={() => handleUpdateStatus(b.id, 'APPROVED')}
                        title="Setujui Bank Soal"
                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg cursor-pointer transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}

                    {b.status !== 'REJECTED' && (
                      <button
                        onClick={() => handleUpdateStatus(b.id, 'REJECTED')}
                        title="Tolak Bank Soal"
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg cursor-pointer transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Create Bank */}
        {showBankModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Buat Bank Soal Baru</h3>
                <p className="text-xs text-slate-500 mt-1">Siapkan wadah paket soal untuk mata pelajaran sekolah.</p>
              </div>

              <form onSubmit={handleCreateBank} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mata Pelajaran *
                  </label>
                  <select
                    value={bankForm.subjectId}
                    onChange={(e) => setBankForm({ ...bankForm, subjectId: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Judul Bank Soal *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Penilaian Akhir Semester Ganjil Matematika X"
                    value={bankForm.title}
                    onChange={(e) => setBankForm({ ...bankForm, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kode Bank Soal
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: BANK-MTK-10-2026"
                    value={bankForm.code}
                    onChange={(e) => setBankForm({ ...bankForm, code: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowBankModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Buat Bank Soal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Add Question */}
        {showQuestionModal && selectedBank && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Tambah Butir Soal ke: {selectedBank.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Menambah butir soal akan otomatis merekam versi revisi baru bank soal (Snapshot Safety).
                </p>
              </div>

              <form onSubmit={handleAddQuestion} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tipe Soal
                    </label>
                    <select
                      value={questionForm.type}
                      onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    >
                      <option value="MULTIPLE_CHOICE_SINGLE">Pilihan Ganda Biasa</option>
                      <option value="MULTIPLE_CHOICE_COMPLEX">Pilihan Ganda Kompleks</option>
                      <option value="ESSAY">Esai / Uraian</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tingkat Kesulitan
                    </label>
                    <select
                      value={questionForm.difficulty}
                      onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    >
                      <option value="EASY">Mudah</option>
                      <option value="MEDIUM">Sedang</option>
                      <option value="HARD">Sukar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Bobot Nilai
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={questionForm.points}
                      onChange={(e) => setQuestionForm({ ...questionForm, points: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pertanyaan / Soal * (Mendukung KaTeX LaTeX $...$)
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Tuliskan teks pertanyaan di sini..."
                    value={questionForm.text}
                    onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  {questionForm.text && (
                    <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] text-slate-400 block mb-1">Pratinjau:</span>
                      <MathRenderer text={questionForm.text} />
                    </div>
                  )}
                </div>

                {questionForm.type.includes('MULTIPLE_CHOICE') && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Pilihan Jawaban (Tandai yang benar)
                    </label>
                    {questionForm.options.map((opt, idx) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input
                          type={questionForm.type === 'MULTIPLE_CHOICE_SINGLE' ? 'radio' : 'checkbox'}
                          name="correctOption"
                          checked={opt.isCorrect}
                          onChange={(e) => {
                            if (questionForm.type === 'MULTIPLE_CHOICE_SINGLE') {
                              setQuestionForm({
                                ...questionForm,
                                options: questionForm.options.map((o) => ({
                                  ...o,
                                  isCorrect: o.id === opt.id,
                                })),
                              });
                            } else {
                              const newOpts = [...questionForm.options];
                              newOpts[idx].isCorrect = e.target.checked;
                              setQuestionForm({ ...questionForm, options: newOpts });
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <span className="text-xs font-bold w-4 text-center">{opt.id}.</span>
                        <input
                          type="text"
                          required
                          placeholder={`Pilihan ${opt.id}`}
                          value={opt.text}
                          onChange={(e) => {
                            const newOpts = [...questionForm.options];
                            newOpts[idx].text = e.target.value;
                            setQuestionForm({ ...questionForm, options: newOpts });
                          }}
                          className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowQuestionModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan Butir Soal'}
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
