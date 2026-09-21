'use client';

import { useState, useEffect } from 'react';
import {
  FileCheck2,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Eye,
  Check,
  XCircle,
  Lock,
  History,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import Pagination from '@/components/common/Pagination';

interface QuestionItem {
  id: string;
  topic: string;
  difficulty: string;
  type: string;
  questionText: string;
  subjectName?: string;
  subjectCode?: string;
  lifecycleStatus: string;
  currentRevisionNumber: number;
  totalRevisions: number;
  rejectionReason?: string;
  curatedBy?: string;
  createdAt: string;
}

export default function SuperAdminQuestionsPage() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 12;

  // Question Detail Modal
  const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Status Action Modal (Approve, Reject, Publish, Lock)
  const [statusActionModal, setStatusActionModal] = useState<{
    question: QuestionItem | null;
    action: 'APPROVED' | 'DRAFT' | 'PUBLISHED' | 'LOCKED' | 'REVIEW' | null;
  }>({ question: null, action: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });
      if (search.trim()) params.append('search', search.trim());
      if (statusTab !== 'ALL') params.append('status', statusTab);
      if (difficultyFilter !== 'ALL') params.append('difficulty', difficultyFilter);
      if (typeFilter !== 'ALL') params.append('type', typeFilter);

      const res = await fetch(`/api/superadmin/questions?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setQuestions(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load global questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [currentPage, statusTab, difficultyFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadQuestions();
  };

  const handleOpenDetail = async (questionId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/superadmin/questions/${questionId}`);
      const json = await res.json();
      if (json.success) {
        setSelectedQuestion(json.data);
      }
    } catch (err) {
      console.error('Failed to load question detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleExecuteStatusTransition = async () => {
    if (!statusActionModal.question || !statusActionModal.action) return;

    if (statusActionModal.action === 'DRAFT') {
      if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
        setActionError('Alasan penolakan (rejection reason) wajib diisi minimal 5 karakter.');
        return;
      }
    }

    setSubmittingAction(true);
    setActionError('');

    try {
      const res = await fetch(`/api/superadmin/questions/${statusActionModal.question.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: statusActionModal.action,
          rejectionReason: statusActionModal.action === 'DRAFT' ? rejectionReason.trim() : undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal mengubah status soal.');

      setStatusActionModal({ question: null, action: null });
      setRejectionReason('');
      loadQuestions();
    } catch (err: any) {
      setActionError(err.message || 'Gagal mengeksekusi transisi status.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const tabs = [
    { id: 'ALL', label: 'Semua Status' },
    { id: 'DRAFT', label: 'Draf' },
    { id: 'REVIEW', label: 'Perlu Telaah' },
    { id: 'APPROVED', label: 'Disetujui' },
    { id: 'PUBLISHED', label: 'Terbit (Locked)' },
    { id: 'LOCKED', label: 'Terkunci' },
  ];

  return (
    <SuperAdminLayout
      title="Bank Soal Global Platform"
      subtitle="Standarisasi butir soal terkurasi, manajemen siklus mutu, dan immutability revisi"
    >
      <div className="space-y-5">
        {/* Immutability Notice */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 text-indigo-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Aturan Immutability:</strong> Soal berstatus <strong>PUBLISHED</strong> atau <strong>LOCKED</strong> tidak dapat diedit secara langsung demi menjaga integritas asesmen yang sedang berlangsung. Perubahan baru otomatis tersimpan sebagai Revisi baru.
            </span>
          </div>
        </div>

        {/* Lifecycle Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusTab(tab.id);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                statusTab === tab.id
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari topik, teks soal, atau mata pelajaran..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500 text-slate-800"
              />
            </form>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={difficultyFilter}
                onChange={(e) => {
                  setDifficultyFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium"
              >
                <option value="ALL">Semua Tingkat Kesulitan</option>
                <option value="EASY">Mudah (EASY)</option>
                <option value="MEDIUM">Sedang (MEDIUM)</option>
                <option value="HARD">Sukar (HARD)</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium"
              >
                <option value="ALL">Semua Tipe Soal</option>
                <option value="PILIHAN_GANDA">Pilihan Ganda</option>
                <option value="PG_KOMPLEKS">PG Kompleks</option>
                <option value="BENAR_SALAH">Benar / Salah</option>
                <option value="MENJODOHKAN">Menjodohkan</option>
                <option value="ISIAN_SINGKAT">Isian Singkat</option>
                <option value="ESSAY">Uraian / Essay</option>
              </select>

              <button
                onClick={loadQuestions}
                title="Muat Ulang"
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Questions Grid Cards (Information Dense) */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
            Memuat butir bank soal global...
          </div>
        ) : questions.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            Tidak ada butir soal yang sesuai dengan filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {questions.map((q) => (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:border-sky-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px] truncate max-w-[150px]">
                      {q.subjectName || 'Umum'}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-mono font-bold">
                        Rev #{q.currentRevisionNumber || 1}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        q.lifecycleStatus === 'PUBLISHED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : q.lifecycleStatus === 'APPROVED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : q.lifecycleStatus === 'REVIEW'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : q.lifecycleStatus === 'LOCKED'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {q.lifecycleStatus}
                      </span>
                    </div>
                  </div>

                  <h4 className="font-bold text-slate-900 text-xs line-clamp-1 mb-1">{q.topic}</h4>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {q.questionText}
                  </p>

                  {q.rejectionReason && (
                    <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
                      <strong>Catatan Penolakan:</strong> {q.rejectionReason}
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400">
                    {q.type.replace('_', ' ')} &bull; {q.difficulty}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenDetail(q.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
                      title="Lihat Detail & Riwayat Revisi"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Review Workflow Actions */}
                    {q.lifecycleStatus === 'SUBMITTED' && (
                      <button
                        onClick={() => setStatusActionModal({ question: q, action: 'REVIEW' })}
                        className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold text-[10px] hover:bg-amber-100"
                      >
                        Telaah
                      </button>
                    )}

                    {(q.lifecycleStatus === 'REVIEW' || q.lifecycleStatus === 'SUBMITTED') && (
                      <>
                        <button
                          onClick={() => setStatusActionModal({ question: q, action: 'APPROVED' })}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                          title="Setujui Soal (Approve)"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setStatusActionModal({ question: q, action: 'DRAFT' });
                            setRejectionReason('');
                          }}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                          title="Tolak Soal (Reject with reason)"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {q.lifecycleStatus === 'APPROVED' && (
                      <button
                        onClick={() => setStatusActionModal({ question: q, action: 'PUBLISHED' })}
                        className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-bold text-[10px] hover:bg-sky-700 transition"
                      >
                        Publish (Bekukan)
                      </button>
                    )}

                    {q.lifecycleStatus === 'PUBLISHED' && (
                      <button
                        onClick={() => setStatusActionModal({ question: q, action: 'LOCKED' })}
                        className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition"
                        title="Kunci Soal (Lock)"
                      >
                        <Lock className="w-4 h-4" />
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
            Menampilkan {questions.length} dari {totalCount} butir soal global
          </p>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
          />
        </div>

        {/* Modal 1: Question Detail & Revisions Inspector */}
        {selectedQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-sky-600" />
                    Inspektor Soal & Riwayat Revisi
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedQuestion.question.subjectName} • {selectedQuestion.question.topic}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Teks Butir Soal:</span>
                    <span className="font-mono font-bold text-sky-600 text-[10px]">
                      Revisi Aktif #{selectedQuestion.question.currentRevisionNumber}
                    </span>
                  </div>
                  <p className="font-medium text-slate-900 whitespace-pre-wrap leading-relaxed">
                    {selectedQuestion.question.questionText}
                  </p>
                </div>

                {/* Options if Multiple Choice */}
                {selectedQuestion.question.optionsJson && selectedQuestion.question.optionsJson.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                      Pilihan Jawaban:
                    </span>
                    <div className="space-y-1.5">
                      {selectedQuestion.question.optionsJson.map((opt: any, idx: number) => (
                        <div key={idx} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-800">
                          <span className="font-bold text-sky-600 mr-2">{opt.id || String.fromCharCode(65 + idx)}.</span>
                          {opt.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Revisions History List */}
                <div className="pt-3 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    Riwayat Revisi Snapshot Terdaftar ({selectedQuestion.revisions?.length || 0})
                  </h4>

                  {!selectedQuestion.revisions || selectedQuestion.revisions.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">Belum ada riwayat revisi yang dibekukan.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedQuestion.revisions.map((rev: any) => (
                        <div key={rev.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-800">Snapshot Revisi #{rev.revisionNumber}</span>
                            <span className="text-[10px] text-slate-400">{new Date(rev.createdAt).toLocaleString('id-ID')}</span>
                          </div>
                          <p className="text-slate-600 line-clamp-2">{rev.questionText}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Status Transition (Approve / Reject / Publish / Lock) */}
        {statusActionModal.question && statusActionModal.action && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                {statusActionModal.action === 'APPROVED' && 'Konfirmasi Persetujuan Soal'}
                {statusActionModal.action === 'DRAFT' && 'Tolak Soal (Reject to Draft)'}
                {statusActionModal.action === 'PUBLISHED' && 'Publikasikan & Bekukan Soal'}
                {statusActionModal.action === 'LOCKED' && 'Kunci Butir Soal'}
                {statusActionModal.action === 'REVIEW' && 'Mulai Penelaahan Soal'}
              </h3>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {actionError}
                </div>
              )}

              {statusActionModal.action === 'PUBLISHED' && (
                <p className="text-xs text-slate-600 leading-relaxed">
                  Soal yang telah dipublikasikan akan dibekukan (Snapshot Revision) dan siap diujikan serentak. Perubahan selanjutnya wajib melalui mekanisme revisi baru.
                </p>
              )}

              {statusActionModal.action === 'DRAFT' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alasan Penolakan / Catatan Perbaikan <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Jelaskan alasan butir soal ini ditolak (wajib)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStatusActionModal({ question: null, action: null })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteStatusTransition}
                  disabled={submittingAction}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submittingAction ? 'Memproses...' : 'Konfirmasi & Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
