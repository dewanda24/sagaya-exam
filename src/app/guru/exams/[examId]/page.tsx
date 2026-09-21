'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import {
  FileCheck2,
  ArrowLeft,
  Calendar,
  Clock,
  Lock,
  Play,
  CheckCircle2,
  AlertCircle,
  Eye,
  Radio,
  Users,
  Layers,
  Plus,
  Trash2,
  RotateCw,
  Edit3,
  Sliders,
  Sparkles,
} from 'lucide-react';

export default function GuruExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.examId as string;

  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'classes'>('overview');

  // Question Picker Modal
  const [addQuestionsOpen, setAddQuestionsOpen] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);

  // Publish Dialog
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const loadExamDetail = async () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guru/exams/${examId}`);
      const json = await res.json();
      if (json.success) {
        setExam(json.data);
        if (json.data.questions) {
          setSelectedQIds(json.data.questions.map((q: any) => q.id));
        }
      } else {
        setError(json.error || 'Gagal memuat detail ujian.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExamDetail();
  }, [examId]);

  const openQuestionPicker = async () => {
    setAddQuestionsOpen(true);
    setLoadingQuestions(true);
    try {
      // Load teacher's approved/published questions for this subject
      const res = await fetch(`/api/guru/questions?subjectId=${exam?.subjectId}&limit=100`);
      const json = await res.json();
      if (json.success) {
        setAvailableQuestions(json.questions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const toggleSelectQuestion = (id: string) => {
    if (selectedQIds.includes(id)) {
      setSelectedQIds(selectedQIds.filter((qId) => qId !== id));
    } else {
      setSelectedQIds([...selectedQIds, id]);
    }
  };

  const handleSaveQuestions = async () => {
    setSavingQuestions(true);
    try {
      const res = await fetch(`/api/guru/exams/${examId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIds: selectedQIds,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAddQuestionsOpen(false);
        loadExamDetail();
      } else {
        alert(json.error || 'Gagal memperbarui soal ujian.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setSavingQuestions(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/guru/exams/${examId}/publish`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setPublishDialogOpen(false);
        loadExamDetail();
      } else {
        alert(json.error || 'Gagal merilis ujian.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setIsPublishing(false);
    }
  };

  const isDraft = exam?.status === 'DRAFT';
  const isLocked = exam?.status !== 'DRAFT';
  const isLive = exam?.status === 'ACTIVE' || exam?.status === 'SCHEDULED';

  const questionColumns: ColumnDef<any>[] = [
    {
      key: 'orderIndex',
      header: 'No',
      cell: (_, idx) => <span className="font-mono text-xs text-slate-400">{idx + 1}</span>,
      className: 'w-12 text-center',
    },
    {
      key: 'topic',
      header: 'Topik & Butir Soal',
      cell: (row) => (
        <div className="space-y-1">
          <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-200">
            {row.topic}
          </span>
          <p className="text-sm text-slate-900 font-medium line-clamp-2">{row.questionText}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tipe Soal',
      cell: (row) => <Badge variant="neutral" size="sm">{row.type}</Badge>,
    },
    {
      key: 'difficulty',
      header: 'Kesulitan',
      cell: (row) => (
        <Badge
          variant={row.difficulty === 'EASY' ? 'success' : row.difficulty === 'HARD' ? 'danger' : 'info'}
          size="sm"
        >
          {row.difficulty}
        </Badge>
      ),
    },
    {
      key: 'weight',
      header: 'Bobot',
      cell: (row) => <span className="font-mono text-xs font-bold text-slate-700">{row.weight || 1.0}</span>,
    },
  ];

  return (
    <GuruLayout
      title={exam?.title || 'Detail Paket Ujian'}
      subtitle={`Mapel: ${exam?.subjectName || '-'} (${exam?.subjectCode || '-'}) • Alokasi: ${exam?.durationMinutes || 0} Menit`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Ujian', href: '/guru/exams' },
        { label: exam?.title || 'Detail' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          {isDraft && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPublishDialogOpen(true)}
              leftIcon={<Play className="w-3.5 h-3.5" />}
            >
              Rilis Paket Ujian
            </Button>
          )}

          {isLive && (
            <Link href={`/guru/monitoring?examId=${examId}`}>
              <Button
                variant="primary"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                leftIcon={<Radio className="w-3.5 h-3.5 animate-pulse" />}
              >
                Monitoring Langsung
              </Button>
            </Link>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={loadExamDetail}
            isLoading={loading}
            leftIcon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Segarkan
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-12">
        {error && (
          <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-danger-600" />
              <span>{error}</span>
            </div>
            <Button variant="danger" size="sm" onClick={loadExamDetail}>
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Ringkasan & Kebijakan
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'questions'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Daftar Butir Soal</span>
            <Badge variant={activeTab === 'questions' ? 'primary' : 'neutral'} size="sm">
              {exam?.questions?.length || 0}
            </Badge>
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'classes'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Rombel & Peserta</span>
            <Badge variant="neutral" size="sm">
              {exam?.targetClassIds?.length || 0} Rombel
            </Badge>
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && exam && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-primary-600" />
                    Parameter Operasional Ujian
                  </CardTitle>
                  <StatusBadge status={exam.status || 'DRAFT'} size="sm" />
                </div>
                <CardDescription>
                  Pengaturan jadwal dan ketentuan pelaksanaan pengerjaan oleh peserta didik
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block font-medium">Jadwal Buka Akses:</span>
                    <span className="font-mono font-bold text-slate-800 text-sm mt-1 block">
                      {new Date(exam.startTime).toLocaleString('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block font-medium">Jadwal Tutup Akses:</span>
                    <span className="font-mono font-bold text-slate-800 text-sm mt-1 block">
                      {new Date(exam.endTime).toLocaleString('id-ID', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block font-medium">Durasi Pengerjaan:</span>
                    <span className="font-bold text-slate-800 text-base mt-1 block">
                      {exam.durationMinutes} Menit
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block font-medium">Nilai KKM Minimal:</span>
                    <span className="font-bold text-primary-700 text-base mt-1 block">
                      {exam.passingGrade || 75}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block font-medium">Total Soal Terpasang:</span>
                    <span className="font-bold text-slate-800 text-base mt-1 block">
                      {exam.questions?.length || 0} Butir
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between py-1">
                    <span>Pengacakan Soal:</span>
                    <Badge variant={exam.randomizeQuestions ? 'success' : 'neutral'} size="sm">
                      {exam.randomizeQuestions ? 'Aktif (Acak Urutan)' : 'Nonaktif (Sesuai Naskah)'}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Pengacakan Opsi Pilihan:</span>
                    <Badge variant={exam.randomizeOptions ? 'success' : 'neutral'} size="sm">
                      {exam.randomizeOptions ? 'Aktif (Acak Opsi)' : 'Nonaktif'}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Penayangan Nilai:</span>
                    <span className="font-medium text-slate-800">{exam.showScorePolicy || 'AFTER_EXAM'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sidebar Status Info */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary-600" />
                    Integritas Naskah Ujian
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs leading-relaxed">
                  {isLocked ? (
                    <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Lock className="w-4 h-4 text-purple-600" />
                        <span>Snapshot Naskah Beku (Immutable)</span>
                      </div>
                      <p>
                        Paket ujian ini telah dirilis dan memiliki snapshot naskah permanen. Perubahan
                        pada bank soal tidak akan menggeser kunci atau butir naskah siswa.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Edit3 className="w-4 h-4 text-amber-600" />
                        <span>Status Naskah: DRAFT</span>
                      </div>
                      <p>
                        Anda masih dapat menambahkan butir soal dari bank soal. Segera klik Rilis Ujian
                        sebelum jam mulai ujian dibuka untuk siswa.
                      </p>
                    </div>
                  )}

                  <div className="pt-2">
                    <span className="text-slate-400 block">Dibuat oleh:</span>
                    <span className="font-semibold text-slate-800">{exam.creatorName || 'Pengajar'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: QUESTIONS */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Butir Soal Paket Ujian</h3>
                <p className="text-xs text-slate-500">
                  {isDraft
                    ? 'Kelola naskah soal yang akan dikerjakan siswa pada paket ujian ini'
                    : 'Naskah soal terkunci sesuai snapshot rilis resmi'}
                </p>
              </div>

              {isDraft && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={openQuestionPicker}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Pilih Soal dari Bank Soal
                </Button>
              )}
            </div>

            <DataTable
              data={exam?.questions || []}
              columns={questionColumns}
              emptyTitle="Belum Ada Soal Terhubung"
              emptyDescription="Tambahkan butir soal dari bank soal Anda untuk melengkapi naskah ujian ini."
              emptyActionLabel={isDraft ? 'Pilih Soal Sekarang' : undefined}
              onEmptyAction={isDraft ? openQuestionPicker : undefined}
              pageSize={20}
              itemName="butir soal"
            />
          </div>
        )}

        {/* TAB 3: CLASSES & PARTICIPANTS */}
        {activeTab === 'classes' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Rombongan Belajar Sasaran</h3>
              <p className="text-xs text-slate-500">
                Siswa pada rombel berikut berhak mengikuti sesi asesmen ini sesuai waktu buka
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {exam?.targetClassIds && exam.targetClassIds.length > 0 ? (
                exam.targetClassIds.map((cid: string, idx: number) => (
                  <Card key={cid}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-xs text-slate-400 font-mono">Rombel #{idx + 1}</span>
                        <div className="font-bold text-slate-900 text-sm">ID: {cid.slice(0, 8)}...</div>
                      </div>
                      <Link href={`/guru/classes/${cid}`}>
                        <Button variant="outline" size="sm">
                          Lihat Siswa
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-3 p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                  Belum ada rombongan belajar yang terhubung ke ujian ini.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* QUESTION PICKER MODAL */}
      <Modal
        isOpen={addQuestionsOpen}
        onClose={() => setAddQuestionsOpen(false)}
        title="Pilih Butir Soal dari Bank Soal"
        size="lg"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-600">
            Centang butir soal yang ingin Anda pasang pada paket ujian ini:
          </p>

          {loadingQuestions ? (
            <div className="p-12 text-center text-slate-400 text-xs">Memuat bank soal...</div>
          ) : availableQuestions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
              Tidak ada butir soal pada mata pelajaran ini yang tersedia. Silakan susun soal baru di Bank Soal.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {availableQuestions.map((q) => {
                const isSelected = selectedQIds.includes(q.id);
                return (
                  <label
                    key={q.id}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectQuestion(q.id)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 mt-1"
                    />
                    <div className="flex-1 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded">
                          {q.topic}
                        </span>
                        <Badge variant="neutral" size="sm">
                          {q.type}
                        </Badge>
                        <Badge variant={q.difficulty === 'EASY' ? 'success' : 'info'} size="sm">
                          {q.difficulty}
                        </Badge>
                      </div>
                      <p className="text-slate-800 font-medium line-clamp-2">{q.questionText}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              {selectedQIds.length} butir soal dipilih
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddQuestionsOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={savingQuestions}
                onClick={handleSaveQuestions}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Pasang {selectedQIds.length} Soal
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* PUBLISH CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={publishDialogOpen}
        onClose={() => setPublishDialogOpen(false)}
        onConfirm={handlePublish}
        title="Rilis Paket Ujian ke Siswa?"
        description="Merilis ujian akan membekukan naskah soal menjadi snapshot permanen (LOCKED). Setelah dirilis, naskah tidak dapat diubah lagi untuk menjamin akurasi dan kesetaraan nilai siswa."
        confirmLabel="Ya, Rilis Ujian Sekarang"
        cancelLabel="Batal"
        confirmVariant="primary"
        isLoading={isPublishing}
      />
    </GuruLayout>
  );
}
