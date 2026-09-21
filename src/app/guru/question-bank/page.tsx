'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import {
  Layers,
  PlusCircle,
  Search,
  Download,
  Upload,
  Copy,
  Edit,
  Trash2,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  FileText,
  X,
  Filter,
  RotateCw,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { QuestionType, DifficultyLevel } from '@/lib/core/types';

export default function GuruQuestionBankPage() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams?.get('status') || '';
  const initialSubject = searchParams?.get('subjectId') || '';

  const [questions, setQuestions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(initialSubject);
  const [selectedType, setSelectedType] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modals state
  const [previewQuestion, setPreviewQuestion] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [submitReviewId, setSubmitReviewId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Import / Export
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (selectedSubject) q.set('subjectId', selectedSubject);
      if (selectedType) q.set('type', selectedType);
      if (selectedDifficulty) q.set('difficulty', selectedDifficulty);
      if (selectedStatus) q.set('status', selectedStatus);
      q.set('limit', limit.toString());
      q.set('offset', ((page - 1) * limit).toString());

      const [qRes, sRes] = await Promise.all([
        fetch(`/api/guru/questions?${q.toString()}`),
        fetch('/api/guru/subjects'),
      ]);

      const qJson = await qRes.json();
      const sJson = await sRes.json();

      if (qJson.success) {
        setQuestions(qJson.questions || []);
        setTotal(qJson.total || 0);
      } else {
        setError(qJson.error || 'Gagal memuat bank soal.');
      }

      if (sJson.success) {
        setSubjects(sJson.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSubject, selectedType, selectedDifficulty, selectedStatus, page]);

  const handleDuplicate = async (questionId: string) => {
    try {
      const res = await fetch(`/api/guru/questions/${questionId}/duplicate`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        loadData();
      } else {
        alert(json.error || 'Gagal menduplikasi soal.');
      }
    } catch {
      alert('Gagal menduplikasi soal.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/guru/questions/${deleteConfirmId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setDeleteConfirmId(null);
        loadData();
      } else {
        alert(json.error || 'Gagal menghapus soal.');
      }
    } catch {
      alert('Gagal menghapus soal.');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmSubmitReview = async () => {
    if (!submitReviewId) return;
    setIsSubmittingReview(true);
    try {
      const res = await fetch(`/api/guru/questions/${submitReviewId}/submit`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSubmitReviewId(null);
        loadData();
      } else {
        alert(json.error || 'Gagal mengirim soal ke antrean review.');
      }
    } catch {
      alert('Gagal mengirim review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleExport = async (mode: 'TEACHER' | 'STUDENT') => {
    setExporting(true);
    try {
      const q = new URLSearchParams();
      if (selectedSubject) q.set('subjectId', selectedSubject);
      q.set('mode', mode);

      const res = await fetch(`/api/guru/questions/export?${q.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        const rows = json.data;
        if (rows.length === 0) {
          alert('Tidak ada data soal untuk diekspor.');
          return;
        }
        const headers = Object.keys(rows[0]);
        const csvContent =
          'data:text/csv;charset=utf-8,\uFEFF' +
          [
            headers.join(','),
            ...rows.map((row: any) =>
              headers.map((h) => `"${(row[h] ?? '').toString().replace(/"/g, '""')}"`).join(',')
            ),
          ].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Bank_Soal_${mode}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setExportModalOpen(false);
      } else {
        alert(json.error || 'Gagal mengekspor data soal.');
      }
    } catch {
      alert('Gagal mengekspor data.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportSubmit = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(importJson);
      } catch {
        alert('Format teks harus berupa JSON array yang valid.');
        setImporting(false);
        return;
      }

      const res = await fetch('/api/guru/questions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed }),
      });
      const json = await res.json();
      if (json.success) {
        setImportResult(json);
        loadData();
      } else {
        alert(json.error || 'Gagal mengimpor data soal.');
      }
    } catch {
      alert('Terjadi kesalahan saat mengimpor.');
    } finally {
      setImporting(false);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      key: 'questionText',
      header: 'Butir Soal & Topik',
      cell: (row) => (
        <div className="space-y-1 max-w-md">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-200">
              {row.topic || 'Umum'}
            </span>
            {row.mediaUrl && (
              <span className="inline-flex items-center gap-1 text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">
                <ImageIcon className="w-3 h-3" /> Media
              </span>
            )}
            <span className="text-[11px] text-slate-400 font-mono">v{row.version || 1}</span>
          </div>
          <p className="text-sm text-slate-900 line-clamp-2 font-medium">
            {row.questionText || '(Tanpa deskripsi teks)'}
          </p>
        </div>
      ),
    },
    {
      key: 'subjectName',
      header: 'Mata Pelajaran & Tipe',
      cell: (row) => (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-800">{row.subjectName || '-'}</div>
          <Badge variant="neutral" size="sm">
            {row.type}
          </Badge>
        </div>
      ),
    },
    {
      key: 'difficulty',
      header: 'Tingkat Kesulitan',
      cell: (row) => {
        const diff = row.difficulty;
        const variant = diff === 'EASY' ? 'success' : diff === 'HARD' ? 'danger' : 'info';
        const label = diff === 'EASY' ? 'Mudah' : diff === 'HARD' ? 'Sukar' : 'Sedang';
        return (
          <Badge variant={variant} size="sm">
            {label}
          </Badge>
        );
      },
    },
    {
      key: 'lifecycleStatus',
      header: 'Status Siklus',
      cell: (row) => {
        const status = row.lifecycleStatus || 'DRAFT';
        return <StatusBadge status={status as any} size="sm" />;
      },
    },
    {
      key: 'actions',
      header: 'Aksi',
      cell: (row) => {
        const isDraft = row.lifecycleStatus === 'DRAFT';
        const isLocked = row.lifecycleStatus === 'LOCKED';

        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewQuestion(row)}
              title="Pratinjau Butir Soal"
            >
              <Eye className="w-4 h-4 text-slate-600" />
            </Button>

            <Link href={`/guru/question-bank/${row.id}/edit`}>
              <Button variant="ghost" size="sm" title="Edit Soal">
                <Edit className="w-4 h-4 text-primary-600" />
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDuplicate(row.id)}
              title="Duplikasi Butir Soal"
            >
              <Copy className="w-4 h-4 text-slate-600" />
            </Button>

            {isDraft && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSubmitReviewId(row.id)}
                  title="Ajukan untuk Review"
                >
                  <Send className="w-4 h-4 text-amber-600" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteConfirmId(row.id)}
                  title="Hapus Draft Soal"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <GuruLayout
      title="Bank Soal Pengajar"
      subtitle="Pusat penyusunan, pengelolaan naskah, moderasi kualitas, dan siklus hidup butir soal asesmen"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Bank Soal' },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportModalOpen(true)}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Ekspor CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            leftIcon={<Upload className="w-3.5 h-3.5" />}
          >
            Impor JSON
          </Button>
          <Link href="/guru/question-bank/review">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />}
            >
              Antrean Review
            </Button>
          </Link>
          <Link href="/guru/question-bank/new">
            <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Buat Soal Baru
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6 pb-12">
        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative lg:col-span-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Cari topik atau teks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadData()}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Subject */}
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Semua Mata Pelajaran</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>

              {/* Question Type */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Semua Tipe Soal</option>
                <option value="PILIHAN_GANDA">Pilihan Ganda</option>
                <option value="PG_KOMPLEKS">Pilihan Ganda Kompleks</option>
                <option value="TRUE_FALSE">Benar / Salah</option>
                <option value="MATCHING">Menjodohkan</option>
                <option value="ISIAN_SINGKAT">Isian Singkat</option>
                <option value="ESSAY">Uraian / Essay</option>
              </select>

              {/* Difficulty */}
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Semua Tingkat Kesulitan</option>
                <option value="EASY">Mudah</option>
                <option value="MEDIUM">Sedang</option>
                <option value="HARD">Sukar</option>
              </select>

              {/* Status */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Semua Status Siklus</option>
                <option value="DRAFT">DRAFT (Penyusunan)</option>
                <option value="SUBMITTED">SUBMITTED (Menunggu Review)</option>
                <option value="APPROVED">APPROVED (Disetujui)</option>
                <option value="PUBLISHED">PUBLISHED (Siap Ujian)</option>
                <option value="LOCKED">LOCKED (Terkunci di Ujian)</option>
                <option value="ARCHIVED">ARCHIVED (Diarsipkan)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Question Data Table */}
        <DataTable
          data={questions}
          columns={columns}
          isLoading={loading}
          error={error}
          onRetry={loadData}
          emptyTitle="Belum Ada Butir Soal"
          emptyDescription="Mulai susun butir soal pertama Anda atau impor dari berkas format Sagaya Exam."
          emptyActionLabel="Buat Soal Baru"
          onEmptyAction={() => (window.location.href = '/guru/question-bank/new')}
          pageSize={20}
          itemName="butir soal"
        />
      </div>

      {/* PREVIEW MODAL */}
      <Modal
        isOpen={Boolean(previewQuestion)}
        onClose={() => setPreviewQuestion(null)}
        title="Pratinjau Butir Soal (Tampilan Pengajar)"
        size="lg"
      >
        {previewQuestion && (
          <div className="space-y-5 text-sm">
            {/* Meta Tags */}
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-200">
              <span className="font-bold text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-md border border-primary-200">
                Topik: {previewQuestion.topic || 'Umum'}
              </span>
              <Badge variant="neutral" size="sm">
                Tipe: {previewQuestion.type}
              </Badge>
              <Badge
                variant={
                  previewQuestion.difficulty === 'EASY'
                    ? 'success'
                    : previewQuestion.difficulty === 'HARD'
                    ? 'danger'
                    : 'info'
                }
                size="sm"
              >
                Kesulitan: {previewQuestion.difficulty}
              </Badge>
              <StatusBadge status={previewQuestion.lifecycleStatus || 'DRAFT'} size="sm" />
              <span className="text-xs text-slate-500 ml-auto font-mono">
                Bobot: {previewQuestion.weight || 1.0} • Versi: {previewQuestion.version || 1}
              </span>
            </div>

            {/* Stimulus jika ada */}
            {previewQuestion.stimulusText && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                {previewQuestion.stimulusTitle && (
                  <h4 className="font-bold text-xs uppercase tracking-wide text-slate-600">
                    {previewQuestion.stimulusTitle}
                  </h4>
                )}
                <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {previewQuestion.stimulusText}
                </div>
              </div>
            )}

            {/* Question Media */}
            {previewQuestion.mediaUrl && (
              <div className="max-w-md mx-auto rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                {previewQuestion.mediaType === 'IMAGE' || !previewQuestion.mediaType ? (
                  <img
                    src={previewQuestion.mediaUrl}
                    alt="Stimulus Soal"
                    className="w-full h-auto object-contain max-h-64 bg-black/5"
                  />
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-50">
                    Media File: {previewQuestion.mediaUrl}
                  </div>
                )}
              </div>
            )}

            {/* Question Text */}
            <div className="text-slate-900 font-medium whitespace-pre-wrap leading-relaxed text-base">
              {previewQuestion.questionText}
            </div>

            {/* Options according to type */}
            {['PILIHAN_GANDA', 'PG_KOMPLEKS'].includes(previewQuestion.type) &&
              Array.isArray(previewQuestion.options) && (
                <div className="space-y-2 pt-2">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Pilihan Jawaban:
                  </h5>
                  {previewQuestion.options.map((opt: any) => {
                    const isKey =
                      previewQuestion.type === 'PILIHAN_GANDA'
                        ? previewQuestion.answerKey === opt.id
                        : Array.isArray(previewQuestion.answerKey) &&
                          previewQuestion.answerKey.includes(opt.id);

                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border text-sm flex items-start gap-3 transition-colors ${
                          isKey
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isKey ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {opt.id}
                        </span>
                        <div className="flex-1 leading-relaxed">{opt.text}</div>
                        {isKey && (
                          <span className="text-[11px] font-bold text-emerald-700 shrink-0 bg-emerald-100 px-2 py-0.5 rounded">
                            Kunci Jawaban
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            {/* TRUE / FALSE */}
            {previewQuestion.type === 'TRUE_FALSE' && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Kunci Jawaban Benar/Salah:</span>
                <Badge variant={previewQuestion.answerKey === 'TRUE' ? 'success' : 'danger'} size="md">
                  {previewQuestion.answerKey === 'TRUE' ? 'BENAR (TRUE)' : 'SALAH (FALSE)'}
                </Badge>
              </div>
            )}

            {/* SHORT ANSWER */}
            {previewQuestion.type === 'ISIAN_SINGKAT' && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Kunci Jawaban Isian Singkat:
                </span>
                <span className="font-mono text-sm font-bold text-primary-700">
                  {typeof previewQuestion.answerKey === 'string'
                    ? previewQuestion.answerKey
                    : JSON.stringify(previewQuestion.answerKey)}
                </span>
              </div>
            )}

            {/* ESSAY RUBRIC */}
            {previewQuestion.type === 'ESSAY' && (
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
                  Rubrik Penilaian & Panduan Skoring:
                </span>
                <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                  {previewQuestion.rubric || '(Belum ada rubrik penilaian yang ditulis)'}
                </p>
              </div>
            )}

            {/* Pembahasan / Explanation */}
            {previewQuestion.explanation && (
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                  Pembahasan / Penjelasan Soal:
                </span>
                <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">
                  {previewQuestion.explanation}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setPreviewQuestion(null)}>
                Tutup Pratinjau
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={confirmDelete}
        title="Hapus Draft Butir Soal?"
        description="Tindakan ini akan menghapus butir soal dari bank soal secara permanen. Butir soal yang sudah terpakai dalam ujian tidak dapat dihapus."
        confirmLabel="Ya, Hapus Soal"
        cancelLabel="Batal"
        confirmVariant="danger"
        isLoading={isDeleting}
      />

      {/* CONFIRM SUBMIT REVIEW DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(submitReviewId)}
        onClose={() => setSubmitReviewId(null)}
        onConfirm={confirmSubmitReview}
        title="Ajukan Soal untuk Moderasi & Review?"
        description="Butir soal akan berpindah status menjadi MENUNGGU REVIEW dan siap diperiksa oleh reviewer tim kurikulum."
        confirmLabel="Kirim ke Antrean Review"
        cancelLabel="Batal"
        confirmVariant="primary"
        isLoading={isSubmittingReview}
      />

      {/* EXPORT MODAL */}
      <Modal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Ekspor Bank Soal ke Format CSV"
        size="md"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-600">
            Pilih jenis dokumen ekspor yang Anda perlukan. Sagaya Exam menyediakan proteksi naskah
            agar kunci jawaban tidak bocor bila digunakan untuk bank latihan siswa.
          </p>

          <div className="grid grid-cols-1 gap-3 pt-2">
            <button
              onClick={() => handleExport('TEACHER')}
              disabled={exporting}
              className="p-4 rounded-xl border border-primary-200 bg-primary-50/50 hover:bg-primary-100/60 text-left transition-colors flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Format Lengkap Pengajar</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menyertakan butir soal, opsi jawaban, <strong>kunci jawaban resmi</strong>, rubrik, dan penjelasan.
                </p>
              </div>
            </button>

            <button
              onClick={() => handleExport('STUDENT')}
              disabled={exporting}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-600 text-white flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Format Latihan Siswa (Tanpa Kunci)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kunci jawaban dan rubrik dikosongkan secara aman untuk keperluan bank latihan mandiri.
                </p>
              </div>
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setExportModalOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      </Modal>

      {/* IMPORT MODAL */}
      <Modal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Impor Butir Soal (JSON Array)"
        size="lg"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-600">
            Tempelkan data soal dalam format JSON array yang memuat atribut <code>topic</code>,{' '}
            <code>type</code>, <code>questionText</code>, <code>options</code>, dan <code>answerKey</code>.
          </p>

          <textarea
            rows={10}
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder='[&#10;  {&#10;    "subjectId": "...",&#10;    "topic": "Aljabar",&#10;    "type": "PILIHAN_GANDA",&#10;    "questionText": "Berapakah 2 + 2?",&#10;    "options": [{"id":"A","text":"4"},{"id":"B","text":"5"}],&#10;    "answerKey": "A"&#10;  }&#10;]'
            className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {importResult && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>
                Berhasil mengimpor {importResult.importedCount || 0} butir soal ke bank soal Anda!
              </span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(false)}>
              Tutup
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={importing}
              onClick={handleImportSubmit}
              leftIcon={<Upload className="w-3.5 h-3.5" />}
            >
              Mulai Impor
            </Button>
          </div>
        </div>
      </Modal>
    </GuruLayout>
  );
}
