'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Calendar,
  Plus,
  Clock,
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Check,
  Printer,
  FileText,
  Play,
  StopCircle,
  Shuffle,
  Eye,
  Sliders,
  Edit3,
  Building2,
  Award,
  Layers,
  Sparkles,
  UserCheck,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import MathRenderer from '@/components/common/MathRenderer';

interface ExamItem {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  schoolId?: string;
  schoolName?: string;
  schoolCode?: string;
  status: 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'COMPLETED';
  windowMode: 'FLEXIBLE' | 'SIMULTANEOUS';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showScorePolicy: 'IMMEDIATELY' | 'AFTER_ALL_DONE' | 'NEVER';
  totalQuestions: number;
  totalParticipants: number;
  completedParticipants: number;
  creatorName?: string;
  createdBy?: string;
  questions?: any[];
  scoringRules?: {
    mode: 'TYPE_WEIGHTS' | 'PROPORTIONAL' | 'BANK_DEFAULT';
    typeWeights?: {
      PILIHAN_GANDA?: number;
      PG_KOMPLEKS?: number;
      BENAR_SALAH?: number;
      MENJODOHKAN?: number;
      ISIAN_SINGKAT?: number;
      ESSAY?: number;
    };
    proportional?: {
      objectivePercentage: number;
      essayPercentage: number;
    };
    penaltyWrong?: boolean;
    wrongPenaltyPoints?: number;
  };
  passingGrade?: number;
  createdAt: string;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface TopicItem {
  subjectId: string;
  topic: string;
  questionCount: number;
}

export default function AdminUjianPage() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);
  const [deleteTargetExam, setDeleteTargetExam] = useState<ExamItem | null>(null);
  const [isDeletingExam, setIsDeletingExam] = useState(false);
  const [showPrintScheduleModal, setShowPrintScheduleModal] = useState(false);
  const [updatingExamId, setUpdatingExamId] = useState<string | null>(null);

  // Draft Package Selector State
  const [selectedDraftPackageId, setSelectedDraftPackageId] = useState<string>('');

  // Preview & Sync State
  const [previewExam, setPreviewExam] = useState<ExamItem | null>(null);
  const [isSyncingParticipants, setIsSyncingParticipants] = useState<string | null>(null);

  // Create Form State
  const [formTitle, setFormTitle] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTopic, setFormTopic] = useState('');
  const [formQuestionLimit, setFormQuestionLimit] = useState(40);
  const [formWindowMode, setFormWindowMode] = useState<'FLEXIBLE' | 'SIMULTANEOUS'>('FLEXIBLE');
  const [formDurationMinutes, setFormDurationMinutes] = useState(90);
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formRandomizeQuestions, setFormRandomizeQuestions] = useState(true);
  const [formRandomizeOptions, setFormRandomizeOptions] = useState(true);
  const [formShowScorePolicy, setFormShowScorePolicy] = useState<'IMMEDIATELY' | 'AFTER_ALL_DONE' | 'NEVER'>('AFTER_ALL_DONE');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scoring Rules State (Create)
  const [formScoringMode, setFormScoringMode] = useState<'TYPE_WEIGHTS' | 'PROPORTIONAL' | 'BANK_DEFAULT'>('TYPE_WEIGHTS');
  const [formPassingGrade, setFormPassingGrade] = useState<number>(75);
  const [formTypeWeights, setFormTypeWeights] = useState({
    PILIHAN_GANDA: 2,
    PG_KOMPLEKS: 3,
    BENAR_SALAH: 2,
    MENJODOHKAN: 3,
    ISIAN_SINGKAT: 2,
    ESSAY: 4,
  });
  const [formProportional, setFormProportional] = useState({
    objectivePercentage: 70,
    essayPercentage: 30,
  });

  // Edit Modal State
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(90);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editWindowMode, setEditWindowMode] = useState<'FLEXIBLE' | 'SIMULTANEOUS'>('FLEXIBLE');
  const [editRandomizeQuestions, setEditRandomizeQuestions] = useState(true);
  const [editRandomizeOptions, setEditRandomizeOptions] = useState(true);
  const [editShowScorePolicy, setEditShowScorePolicy] = useState<'IMMEDIATELY' | 'AFTER_ALL_DONE' | 'NEVER'>('AFTER_ALL_DONE');
  const [editScoringMode, setEditScoringMode] = useState<'TYPE_WEIGHTS' | 'PROPORTIONAL' | 'BANK_DEFAULT'>('TYPE_WEIGHTS');
  const [editPassingGrade, setEditPassingGrade] = useState<number>(75);
  const [editTypeWeights, setEditTypeWeights] = useState({
    PILIHAN_GANDA: 2,
    PG_KOMPLEKS: 3,
    BENAR_SALAH: 2,
    MENJODOHKAN: 3,
    ISIAN_SINGKAT: 2,
    ESSAY: 4,
  });
  const [editProportional, setEditProportional] = useState({
    objectivePercentage: 70,
    essayPercentage: 30,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/exams');
      const data = await res.json();
      if (data.success) {
        setExams(data.data.exams || []);
        setSubjects(data.data.subjects || []);
        setClasses(data.data.classes || []);
        setTopics(data.data.topics || []);

        if (data.data.subjects?.length > 0 && !formSubjectId) {
          setFormSubjectId(data.data.subjects[0].id);
        }
      }
    } catch {
      showNotification('Gagal memuat jadwal ujian.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    setFormStartTime(now.toISOString().slice(0, 16));
    setFormEndTime(tomorrow.toISOString().slice(0, 16));
  }, []);

  // Filter available topics based on selected subject
  const availableSubjectTopics = topics.filter((t) => t.subjectId === formSubjectId);

  // Draft Packages curated by Teachers
  const draftPackages = exams.filter((e) => e.status === 'DRAFT');

  const handleSelectDraftPackage = (draftId: string) => {
    setSelectedDraftPackageId(draftId);
    if (!draftId) return;
    const draft = exams.find((e) => e.id === draftId);
    if (draft) {
      setFormTitle(draft.title);
      setFormSubjectId(draft.subjectId);
      setFormDurationMinutes(draft.durationMinutes || 90);
      setFormQuestionLimit(draft.totalQuestions || 0);
      if (draft.scoringRules) {
        setFormScoringMode(draft.scoringRules.mode || 'TYPE_WEIGHTS');
        if (draft.scoringRules.typeWeights) {
          setFormTypeWeights((prev) => ({
            ...prev,
            ...draft.scoringRules?.typeWeights,
          }));
        }
        if (draft.scoringRules.proportional) {
          setFormProportional((prev) => ({
            ...prev,
            ...draft.scoringRules?.proportional,
          }));
        }
      }
      if (draft.passingGrade) setFormPassingGrade(draft.passingGrade);
    }
  };

  const handleScheduleDraftExam = (draft: ExamItem) => {
    handleSelectDraftPackage(draft.id);
    setShowCreateModal(true);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (selectedDraftPackageId) {
        const res = await fetch('/api/admin/exams', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedDraftPackageId,
            status: 'ACTIVE',
            title: formTitle,
            durationMinutes: formDurationMinutes,
            startTime: formStartTime,
            endTime: formEndTime,
            windowMode: formWindowMode,
            randomizeQuestions: formRandomizeQuestions,
            randomizeOptions: formRandomizeOptions,
            showScorePolicy: formShowScorePolicy,
            targetClassIds: selectedClassIds,
            scoringRules: {
              mode: formScoringMode,
              typeWeights: formTypeWeights,
              proportional: formProportional,
            },
            passingGrade: formPassingGrade,
          }),
        });

        const data = await res.json();

        if (data.success) {
          showNotification(`Paket naskah "${formTitle}" berhasil dijadwalkan dan diaktifkan untuk peserta!`);
          setShowCreateModal(false);
          setSelectedDraftPackageId('');
          setFormTitle('');
          setFormTopic('');
          setSelectedClassIds([]);
          fetchExams();
        } else {
          showNotification(data.error || 'Gagal mengaktifkan paket ujian.', 'error');
        }
        setIsSubmitting(false);
        return;
      }

      const res = await fetch('/api/admin/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          subjectId: formSubjectId,
          selectedTopic: formTopic,
          questionLimit: formQuestionLimit,
          windowMode: formWindowMode,
          durationMinutes: formDurationMinutes,
          startTime: formStartTime,
          endTime: formEndTime,
          randomizeQuestions: formRandomizeQuestions,
          randomizeOptions: formRandomizeOptions,
          showScorePolicy: formShowScorePolicy,
          targetClassIds: selectedClassIds,
          scoringRules: {
            mode: formScoringMode,
            typeWeights: formTypeWeights,
            proportional: formProportional,
          },
          passingGrade: formPassingGrade,
        }),
      });

      const data = await res.json();

      if (data.success) {
        showNotification(data.message);
        setShowCreateModal(false);
        setFormTitle('');
        setFormTopic('');
        setSelectedClassIds([]);
        fetchExams();
      } else {
        showNotification(data.error || 'Gagal membuat jadwal ujian.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (examId: string, newStatus: string) => {
    if (!confirm(`Ubah status ujian menjadi ${newStatus}?`)) return;
    setUpdatingExamId(examId);
    try {
      const res = await fetch('/api/admin/exams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: examId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message || `Status ujian berhasil diubah ke ${newStatus}.`);
        fetchExams();
      } else {
        showNotification(data.error || 'Gagal mengubah status ujian.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setUpdatingExamId(null);
    }
  };

  const openEditModal = (ex: ExamItem) => {
    setEditingExam(ex);
    setEditTitle(ex.title || '');
    setEditDuration(ex.durationMinutes || 90);
    setEditStartTime(new Date(ex.startTime || Date.now()).toISOString().slice(0, 16));
    setEditEndTime(new Date(ex.endTime || Date.now() + 86400000).toISOString().slice(0, 16));
    setEditWindowMode(ex.windowMode);
    setEditRandomizeQuestions(ex.randomizeQuestions);
    setEditRandomizeOptions(ex.randomizeOptions);
    setEditShowScorePolicy(ex.showScorePolicy);
    setEditScoringMode(ex.scoringRules?.mode || 'TYPE_WEIGHTS');
    setEditPassingGrade(ex.passingGrade || 75);
    setEditTypeWeights({
      PILIHAN_GANDA: ex.scoringRules?.typeWeights?.PILIHAN_GANDA ?? 2,
      PG_KOMPLEKS: ex.scoringRules?.typeWeights?.PG_KOMPLEKS ?? 3,
      BENAR_SALAH: ex.scoringRules?.typeWeights?.BENAR_SALAH ?? 2,
      MENJODOHKAN: ex.scoringRules?.typeWeights?.MENJODOHKAN ?? 3,
      ISIAN_SINGKAT: ex.scoringRules?.typeWeights?.ISIAN_SINGKAT ?? 2,
      ESSAY: ex.scoringRules?.typeWeights?.ESSAY ?? 4,
    });
    setEditProportional({
      objectivePercentage: ex.scoringRules?.proportional?.objectivePercentage ?? 70,
      essayPercentage: ex.scoringRules?.proportional?.essayPercentage ?? 30,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;
    setIsUpdating(true);

    try {
      const res = await fetch('/api/admin/exams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingExam.id,
          title: editTitle,
          durationMinutes: editDuration,
          startTime: editStartTime,
          endTime: editEndTime,
          windowMode: editWindowMode,
          randomizeQuestions: editRandomizeQuestions,
          randomizeOptions: editRandomizeOptions,
          showScorePolicy: editShowScorePolicy,
          scoringRules: {
            mode: editScoringMode,
            typeWeights: editTypeWeights,
            proportional: editProportional,
          },
          passingGrade: editPassingGrade,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification(json.message);
        setEditingExam(null);
        fetchExams();
      } else {
        showNotification(json.error || 'Gagal menyimpan perubahan.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!deleteTargetExam) return;
    setIsDeletingExam(true);

    try {
      const res = await fetch(`/api/admin/exams?id=${deleteTargetExam.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showNotification(json.message);
        setDeleteTargetExam(null);
        fetchExams();
      } else {
        showNotification(json.error || 'Gagal menghapus jadwal ujian.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsDeletingExam(false);
    }
  };

  const handleSyncParticipants = async (examId: string) => {
    setIsSyncingParticipants(examId);
    try {
      const res = await fetch('/api/admin/exams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: examId, action: 'SYNC_PARTICIPANTS' }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message || 'Sinkronisasi peserta rombel berhasil!', 'success');
        fetchExams();
      } else {
        showNotification(data.error || 'Gagal sinkronisasi peserta', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan saat sinkronisasi peserta', 'error');
    } finally {
      setIsSyncingParticipants(null);
    }
  };

  const handleClassToggle = (cId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(cId) ? prev.filter((id) => id !== cId) : [...prev, cId]
    );
  };

  const handleSelectAllClasses = () => {
    if (selectedClassIds.length === classes.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classes.map((c) => c.id));
    }
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
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Jadwal Ujian & Snapshot Naskah
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Atur jadwal asesmen, paket bank soal beku, aturan integritas CBT, dan penerbitan token peserta.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPrintScheduleModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Cetak Lembar Jadwal (A4)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Jadwalkan Ujian Baru</span>
          </button>
        </div>
      </div>

      {/* Exam Grid Cards */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center text-slate-500 text-sm border border-slate-200">
          Memuat daftar jadwal ujian...
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center text-slate-400 border border-slate-200">
          <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <div className="font-bold text-slate-800 text-base">Belum Ada Jadwal Ujian</div>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-4">
            Klik tombol &quot;Jadwalkan Ujian Baru&quot; untuk membekukan naskah soal dan menerbitkan token ujian siswa.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Jadwal Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {exams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                {/* Status & Subject Badges */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        exam.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : exam.status === 'COMPLETED'
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      {exam.status === 'ACTIVE'
                        ? '• SEDANG AKTIF'
                        : exam.status === 'COMPLETED'
                        ? 'SELESAI'
                        : 'DRAF / PAKET GURU'}
                    </span>

                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {exam.windowMode === 'SIMULTANEOUS' ? 'Serentak Ketat' : 'Jendela Multi-Sesi'}
                    </span>
                  </div>

                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-lg">
                    {exam.subjectName}
                  </span>
                </div>

                <h3 className="font-black text-lg text-slate-900 leading-snug mb-1">
                  {exam.title}
                </h3>

                {exam.creatorName && (
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      Disusun oleh: <strong>{exam.creatorName}</strong>
                    </span>
                  </div>
                )}

                {/* Details Pill Box */}
                <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 my-3 text-center">
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Durasi</div>
                    <div className="font-black text-slate-800 text-xs mt-0.5">
                      {exam.durationMinutes} Menit
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Soal Beku</div>
                    <div className="font-black text-slate-800 text-xs mt-0.5">
                      {exam.totalQuestions} Butir
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Peserta</div>
                    <div className="font-black text-slate-800 text-xs mt-0.5">
                      {exam.totalParticipants} Siswa
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Selesai</div>
                    <div className="font-black text-emerald-600 text-xs mt-0.5">
                      {exam.completedParticipants} Siswa
                    </div>
                  </div>
                </div>

                {/* Schedule times & Integrity Tags */}
                <div className="space-y-1 text-xs text-slate-600 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Mulai:</span>
                    <span className="font-semibold text-slate-800">
                      {exam?.startTime ? new Date(exam.startTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Selesai:</span>
                    <span className="font-semibold text-slate-800">
                      {exam?.endTime ? new Date(exam.endTime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                    </span>
                  </div>
                </div>

                {/* Integrity & Scoring Badges */}
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500 mb-2 pt-2 border-t border-slate-100">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded font-bold">
                    KKM: {exam.passingGrade || 75}
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded font-semibold">
                    {exam.scoringRules?.mode === 'PROPORTIONAL'
                      ? `Proporsional (${exam.scoringRules.proportional?.objectivePercentage || 70}% PG : ${exam.scoringRules.proportional?.essayPercentage || 30}% Ess)`
                      : exam.scoringRules?.mode === 'TYPE_WEIGHTS'
                      ? `Poin: PG=${exam.scoringRules.typeWeights?.PILIHAN_GANDA ?? 2}p, Ess=${exam.scoringRules.typeWeights?.ESSAY ?? 4}p`
                      : 'Bobot Asli Bank'}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded">
                    {exam.randomizeQuestions ? '✓ Acak Soal' : 'Urutan Asli'}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded">
                    {exam.randomizeOptions ? '✓ Acak Opsi' : 'Opsi Tetap'}
                  </span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded">
                    Nilai: {exam.showScorePolicy === 'IMMEDIATELY' ? 'Langsung' : exam.showScorePolicy === 'NEVER' ? 'Rahasia' : 'Setelah Selesai'}
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Draft Schedule Button */}
                  {exam.status === 'DRAFT' && (
                    <button
                      type="button"
                      onClick={() => handleScheduleDraftExam(exam)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs transition flex items-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
                      title="Jadwalkan tanggal, waktu tayang, dan rombel peserta untuk paket ini"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Jadwalkan &amp; Terbitkan</span>
                    </button>
                  )}

                  {/* Status Toggle Button */}
                  {exam.status === 'DRAFT' && (
                    <button
                      type="button"
                      disabled={updatingExamId === exam.id}
                      onClick={() => handleUpdateStatus(exam.id, 'ACTIVE')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-sm shadow-emerald-500/20 cursor-pointer"
                      title="Aktifkan Ujian langsung"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{updatingExamId === exam.id ? 'Memproses...' : 'Aktifkan'}</span>
                    </button>
                  )}

                  {exam.status === 'ACTIVE' && (
                    <button
                      type="button"
                      disabled={updatingExamId === exam.id}
                      onClick={() => handleUpdateStatus(exam.id, 'COMPLETED')}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-sm shadow-amber-500/20 cursor-pointer"
                      title="Selesaikan sesi ujian ini"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      <span>{updatingExamId === exam.id ? 'Memproses...' : 'Selesaikan'}</span>
                    </button>
                  )}

                  {/* Pratinjau Butir Soal Naskah Ujian */}
                  <button
                    type="button"
                    onClick={() => setPreviewExam(exam)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="Pratinjau Butir Soal Naskah Ujian"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {/* Sinkronisasi Peserta Rombel Baru */}
                  <button
                    type="button"
                    disabled={isSyncingParticipants === exam.id}
                    onClick={() => handleSyncParticipants(exam.id)}
                    className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition cursor-pointer disabled:opacity-50"
                    title="Sinkronisasi & Tambah Siswa Rombel Baru ke Jadwal Ini"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingParticipants === exam.id ? 'animate-spin text-emerald-600' : ''}`} />
                  </button>

                  {/* Edit Exam Button */}
                  <button
                    type="button"
                    onClick={() => openEditModal(exam)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
                    title="Edit Jadwal & Aturan"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Delete Exam Button (Only for DRAFT or exams with 0 submissions) */}
                  <button
                    type="button"
                    onClick={() => setDeleteTargetExam(exam)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                    title="Hapus Jadwal Ujian"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Link
                    href={`/admin/cetak-kartu?examId=${exam.id}`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-bold text-xs transition flex items-center gap-1"
                    title="Cetak Kartu Peserta Ujian (A4)"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Kartu</span>
                  </Link>

                  <Link
                    href={`/admin/berita-acara?examId=${exam.id}`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-bold text-xs transition flex items-center gap-1"
                    title="Cetak Berita Acara & Presensi Ruang"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>BAPU</span>
                  </Link>

                  <Link
                    href={`/admin/nilai?examId=${exam.id}`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 font-bold text-xs transition flex items-center gap-1"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <span>Nilai</span>
                  </Link>
                </div>

                <Link
                  href="/pengawas"
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-1 shadow-sm"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Proktor</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================
          MODAL: JADWALKAN UJIAN BARU (ENHANCED)
          ========================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-blue-600">
                <Calendar className="w-5 h-5" />
                <h3 className="text-lg font-black text-slate-900">
                  Jadwalkan Penilaian / Ujian Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4">
              {/* Draft Package from Guru Selector */}
              {draftPackages.length > 0 && (
                <div className="p-3.5 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 rounded-2xl border border-blue-200/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      Gunakan Paket Naskah Siap Saji dari Guru
                    </label>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {draftPackages.length} Paket Siap Saji
                    </span>
                  </div>
                  <select
                    value={selectedDraftPackageId}
                    onChange={(e) => handleSelectDraftPackage(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-blue-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">-- Buat Baru / Pilih dari Bank Soal Umum --</option>
                    {draftPackages.map((dp) => (
                      <option key={dp.id} value={dp.id}>
                        {dp.title} • {dp.subjectName} ({dp.totalQuestions} Soal) - Oleh {dp.creatorName || 'Guru'}
                      </option>
                    ))}
                  </select>
                  {selectedDraftPackageId && (
                    <div className="text-[11px] text-blue-800 font-medium flex items-center justify-between">
                      <span>✓ Paket naskah guru dipilih. Anda tinggal menentukan rombel kelas peserta dan rentang waktu.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDraftPackageId('');
                          setFormTitle('');
                          setFormTopic('');
                        }}
                        className="text-[10px] text-rose-600 hover:underline font-bold cursor-pointer"
                      >
                        Reset ke Manual
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Judul Penilaian / Asesmen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Contoh: Penilaian Sumatif Akhir Semester (PSAS) Ganjil"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                />
              </div>

              {/* Subject & Specific Topic Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formSubjectId}
                    onChange={(e) => {
                      setFormSubjectId(e.target.value);
                      setFormTopic('');
                    }}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Paket / Topik Soal Guru
                  </label>
                  <select
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-semibold"
                  >
                    <option value="">Semua Topik di Mapel Ini</option>
                    {availableSubjectTopics.map((t, idx) => (
                      <option key={idx} value={t.topic}>
                        {t.topic} ({t.questionCount} Butir)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration & Question Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Durasi Pengerjaan (Menit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="360"
                    required
                    value={formDurationMinutes}
                    onChange={(e) => setFormDurationMinutes(parseInt(e.target.value, 10) || 90)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Batas Jumlah Soal (0 = Ambil Semua)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={formQuestionLimit}
                    onChange={(e) => setFormQuestionLimit(parseInt(e.target.value, 10) || 0)}
                    placeholder="Misal: 40"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white font-bold"
                  />
                </div>
              </div>

              {/* Time Window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Waktu Mulai Ujian <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Waktu Selesai (Batas Masuk) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Integrity Settings Panel */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  <span>Pengaturan Integritas & Mode Ujian CBT</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRandomizeQuestions}
                      onChange={(e) => setFormRandomizeQuestions(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span className="font-semibold text-slate-800">Acak Urutan Soal Siswa</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRandomizeOptions}
                      onChange={(e) => setFormRandomizeOptions(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span className="font-semibold text-slate-800">Acak Pilihan Ganda (A/B/C/D)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Kebijakan Tampil Nilai
                    </label>
                    <select
                      value={formShowScorePolicy}
                      onChange={(e) =>
                        setFormShowScorePolicy(e.target.value as 'IMMEDIATELY' | 'AFTER_ALL_DONE' | 'NEVER')
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-medium"
                    >
                      <option value="AFTER_ALL_DONE">Setelah Semua Siswa Selesai</option>
                      <option value="IMMEDIATELY">Langsung Muncul Setelah Kirim</option>
                      <option value="NEVER">Dirahasiakan (Hanya Guru & Panitia)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Mode Pelaksanaan Waktu
                    </label>
                    <select
                      value={formWindowMode}
                      onChange={(e) =>
                        setFormWindowMode(e.target.value as 'FLEXIBLE' | 'SIMULTANEOUS')
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-medium"
                    >
                      <option value="FLEXIBLE">Jendela Fleksibel (Cocok Bergantian Sesi Lab)</option>
                      <option value="SIMULTANEOUS">Serentak Ketat (Mulai-Selesai Jam Sama)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Skema Bobot & Standar Kelulusan (KKM/KKTP) Panel */}
              <div className="bg-blue-50/40 rounded-2xl p-4 border border-blue-100 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-blue-600" />
                    <span>Skema Bobot Nilai &amp; KKM / KKTP</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-blue-200">
                    <span className="text-[11px] font-bold text-slate-600">KKM / KKTP:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formPassingGrade}
                      onChange={(e) => setFormPassingGrade(Number(e.target.value) || 75)}
                      className="w-12 text-xs font-black text-center text-blue-700 bg-transparent focus:outline-none"
                    />
                  </div>
                </div>

                {/* Mode Selector Radio Pills */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormScoringMode('TYPE_WEIGHTS')}
                    className={`p-2.5 rounded-xl text-xs font-bold transition text-left border cursor-pointer ${
                      formScoringMode === 'TYPE_WEIGHTS'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Poin per Tipe</span>
                      {formScoringMode === 'TYPE_WEIGHTS' && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${formScoringMode === 'TYPE_WEIGHTS' ? 'text-blue-100' : 'text-slate-400'}`}>
                      Seragamkan poin per butir
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormScoringMode('PROPORTIONAL')}
                    className={`p-2.5 rounded-xl text-xs font-bold transition text-left border cursor-pointer ${
                      formScoringMode === 'PROPORTIONAL'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Proporsional (%)</span>
                      {formScoringMode === 'PROPORTIONAL' && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${formScoringMode === 'PROPORTIONAL' ? 'text-blue-100' : 'text-slate-400'}`}>
                      Komposisi PG : Essay
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormScoringMode('BANK_DEFAULT')}
                    className={`p-2.5 rounded-xl text-xs font-bold transition text-left border cursor-pointer ${
                      formScoringMode === 'BANK_DEFAULT'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Bobot Asli Bank</span>
                      {formScoringMode === 'BANK_DEFAULT' && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${formScoringMode === 'BANK_DEFAULT' ? 'text-blue-100' : 'text-slate-400'}`}>
                      Sesuai input masing-masing guru
                    </div>
                  </button>
                </div>

                {/* Mode 1 Content: Type Weights Grid */}
                {formScoringMode === 'TYPE_WEIGHTS' && (
                  <div className="p-3 bg-white rounded-xl border border-blue-100 space-y-2">
                    <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      Atur Poin Baku per Butir Soal:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Pilihan Ganda (PG)</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={formTypeWeights.PILIHAN_GANDA}
                            onChange={(e) => setFormTypeWeights(prev => ({ ...prev, PILIHAN_GANDA: Number(e.target.value) || 2 }))}
                            className="w-full px-2.5 py-1 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">pt</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">PG Kompleks</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={formTypeWeights.PG_KOMPLEKS}
                            onChange={(e) => setFormTypeWeights(prev => ({ ...prev, PG_KOMPLEKS: Number(e.target.value) || 3 }))}
                            className="w-full px-2.5 py-1 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">pt</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Benar / Salah</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={formTypeWeights.BENAR_SALAH}
                            onChange={(e) => setFormTypeWeights(prev => ({ ...prev, BENAR_SALAH: Number(e.target.value) || 2 }))}
                            className="w-full px-2.5 py-1 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">pt</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Menjodohkan</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={formTypeWeights.MENJODOHKAN}
                            onChange={(e) => setFormTypeWeights(prev => ({ ...prev, MENJODOHKAN: Number(e.target.value) || 3 }))}
                            className="w-full px-2.5 py-1 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">pt</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Isian Singkat</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={formTypeWeights.ISIAN_SINGKAT}
                            onChange={(e) => setFormTypeWeights(prev => ({ ...prev, ISIAN_SINGKAT: Number(e.target.value) || 2 }))}
                            className="w-full px-2.5 py-1 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">pt</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Essay / Uraian</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={formTypeWeights.ESSAY}
                            onChange={(e) => setFormTypeWeights(prev => ({ ...prev, ESSAY: Number(e.target.value) || 4 }))}
                            className="w-full px-2.5 py-1 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-amber-700"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">pt</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mode 2 Content: Proportional Slider/Inputs */}
                {formScoringMode === 'PROPORTIONAL' && (
                  <div className="p-3 bg-white rounded-xl border border-blue-100 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          Porsi Soal Objektif (PG dkk)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formProportional.objectivePercentage}
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                              setFormProportional({ objectivePercentage: val, essayPercentage: 100 - val });
                            }}
                            className="w-16 px-2.5 py-1 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-blue-700"
                          />
                          <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">
                          Porsi Soal Essay (Uraian)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formProportional.essayPercentage}
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                              setFormProportional({ objectivePercentage: 100 - val, essayPercentage: val });
                            }}
                            className="w-16 px-2.5 py-1 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-amber-700"
                          />
                          <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Rumus: <code>(Skor PG / Max PG x {formProportional.objectivePercentage}%) + (Skor Essay / Max Essay x {formProportional.essayPercentage}%)</code>
                    </div>
                  </div>
                )}

                {formScoringMode === 'BANK_DEFAULT' && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                    Sistem akan menggunakan bobot individual yang telah dimasukkan oleh masing-masing guru pada butir di Bank Soal. Total nilai diakumulasi dan diskalakan ke 100.
                  </div>
                )}
              </div>

              {/* Target Class Rooms Multi-select */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Pilih Rombel / Kelas Sasaran
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllClasses}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                  >
                    {selectedClassIds.length === classes.length ? 'Batal Pilih Semua' : 'Pilih Semua Kelas'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {classes.map((c) => {
                    const isSelected = selectedClassIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleClassToggle(c.id)}
                        className={`p-2 rounded-lg text-xs font-bold text-left transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Membekukan Soal & Token...' : 'Publikasikan Ujian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: EDIT JADWAL UJIAN
          ========================================================= */}
      {editingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-black text-slate-900 mb-1">
              Edit Jadwal & Durasi Ujian
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Ubah waktu pelaksanaan atau perpanjang batas pengerjaan ujian.
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Judul Ujian</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Durasi (Menit)</label>
                <input
                  type="number"
                  min="5"
                  max="360"
                  required
                  value={editDuration}
                  onChange={(e) => setEditDuration(parseInt(e.target.value, 10) || 90)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Waktu Mulai</label>
                  <input
                    type="datetime-local"
                    required
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Waktu Selesai</label>
                  <input
                    type="datetime-local"
                    required
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Skema Bobot & Standar Kelulusan (KKM/KKTP) Edit Panel */}
              <div className="bg-blue-50/40 rounded-2xl p-4 border border-blue-100 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-blue-600" />
                    <span>Skema Bobot Nilai &amp; KKM / KKTP</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-blue-200">
                    <span className="text-[11px] font-bold text-slate-600">KKM / KKTP:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editPassingGrade}
                      onChange={(e) => setEditPassingGrade(Number(e.target.value) || 75)}
                      className="w-12 text-xs font-black text-center text-blue-700 bg-transparent focus:outline-none"
                    />
                  </div>
                </div>

                {/* Mode Selector Radio Pills */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditScoringMode('TYPE_WEIGHTS')}
                    className={`p-2 rounded-xl text-xs font-bold transition text-left border cursor-pointer ${
                      editScoringMode === 'TYPE_WEIGHTS'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Poin per Tipe</span>
                      {editScoringMode === 'TYPE_WEIGHTS' && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${editScoringMode === 'TYPE_WEIGHTS' ? 'text-blue-100' : 'text-slate-400'}`}>
                      Seragamkan poin per butir
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditScoringMode('PROPORTIONAL')}
                    className={`p-2 rounded-xl text-xs font-bold transition text-left border cursor-pointer ${
                      editScoringMode === 'PROPORTIONAL'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Proporsional (%)</span>
                      {editScoringMode === 'PROPORTIONAL' && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${editScoringMode === 'PROPORTIONAL' ? 'text-blue-100' : 'text-slate-400'}`}>
                      Komposisi PG : Essay
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditScoringMode('BANK_DEFAULT')}
                    className={`p-2 rounded-xl text-xs font-bold transition text-left border cursor-pointer ${
                      editScoringMode === 'BANK_DEFAULT'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Bobot Asli Bank</span>
                      {editScoringMode === 'BANK_DEFAULT' && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${editScoringMode === 'BANK_DEFAULT' ? 'text-blue-100' : 'text-slate-400'}`}>
                      Sesuai bobot per butir guru
                    </div>
                  </button>
                </div>

                {/* Edit Mode 1: Type Weights */}
                {editScoringMode === 'TYPE_WEIGHTS' && (
                  <div className="p-3 bg-white rounded-xl border border-blue-100 space-y-2">
                    <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      Atur Poin Baku per Butir Soal:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">PG (Pilihan Ganda)</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={editTypeWeights.PILIHAN_GANDA}
                          onChange={(e) => setEditTypeWeights(prev => ({ ...prev, PILIHAN_GANDA: Number(e.target.value) || 2 }))}
                          className="w-full px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">PG Kompleks</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={editTypeWeights.PG_KOMPLEKS}
                          onChange={(e) => setEditTypeWeights(prev => ({ ...prev, PG_KOMPLEKS: Number(e.target.value) || 3 }))}
                          className="w-full px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Benar / Salah</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={editTypeWeights.BENAR_SALAH}
                          onChange={(e) => setEditTypeWeights(prev => ({ ...prev, BENAR_SALAH: Number(e.target.value) || 2 }))}
                          className="w-full px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Menjodohkan</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={editTypeWeights.MENJODOHKAN}
                          onChange={(e) => setEditTypeWeights(prev => ({ ...prev, MENJODOHKAN: Number(e.target.value) || 3 }))}
                          className="w-full px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Isian Singkat</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={editTypeWeights.ISIAN_SINGKAT}
                          onChange={(e) => setEditTypeWeights(prev => ({ ...prev, ISIAN_SINGKAT: Number(e.target.value) || 2 }))}
                          className="w-full px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Essay / Uraian</label>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={editTypeWeights.ESSAY}
                          onChange={(e) => setEditTypeWeights(prev => ({ ...prev, ESSAY: Number(e.target.value) || 4 }))}
                          className="w-full px-2 py-1 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-amber-700"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit Mode 2: Proportional */}
                {editScoringMode === 'PROPORTIONAL' && (
                  <div className="p-3 bg-white rounded-xl border border-blue-100 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">Objektif (PG dkk %)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editProportional.objectivePercentage}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                            setEditProportional({ objectivePercentage: val, essayPercentage: 100 - val });
                          }}
                          className="w-full px-2 py-1 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-blue-700"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1">Essay (Uraian %)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editProportional.essayPercentage}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                            setEditProportional({ objectivePercentage: 100 - val, essayPercentage: val });
                          }}
                          className="w-full px-2 py-1 text-xs font-black bg-slate-50 border border-slate-200 rounded-lg text-amber-700"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingExam(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer"
                >
                  {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: CETAK LEMBAR JADWAL PELAKSANAAN RESMI (A4)
          ========================================================= */}
      {showPrintScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Cetak Lembar Jadwal Resmi (A4)</h3>
                  <p className="text-xs text-slate-500">
                    Dokumen resmi jadwal ujian sekolah lengkap dengan KKM dan tanda tangan pimpinan
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-blue-500/20 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintScheduleModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Simulated Official Print Sheet */}
            <div className="p-6 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs">
              {/* Header */}
              <div className="text-center pb-3 border-b-2 border-slate-900 mb-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  PEMERINTAH DAERAH PROVINSI / DAERAH
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  DINAS PENDIDIKAN DAN KEBUDAYAAN
                </div>
                <div className="text-sm font-black uppercase tracking-wider text-slate-900 mt-0.5">
                  {exams[0]?.schoolName || 'SMA NEGERI 1 SAGAYA'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  JADWAL RESMI PELAKSANAAN UJIAN BERBASIS KOMPUTER (CBT) TAHUN AJARAN 2025/2026
                </div>
              </div>

              {/* Schedule Table with KKM column */}
              <table className="w-full text-left border border-slate-300 text-xs mb-6">
                <thead className="bg-slate-100 font-bold uppercase border-b border-slate-300 text-slate-700">
                  <tr>
                    <th className="p-2 border-r border-slate-300 text-center w-8">No</th>
                    <th className="p-2 border-r border-slate-300">Mata Pelajaran</th>
                    <th className="p-2 border-r border-slate-300">Waktu Pelaksanaan</th>
                    <th className="p-2 border-r border-slate-300 text-center">Durasi</th>
                    <th className="p-2 border-r border-slate-300 text-center">Soal</th>
                    <th className="p-2 border-r border-slate-300 text-center">KKM</th>
                    <th className="p-2 text-center">Peserta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {exams.map((ex, i) => (
                    <tr key={ex.id}>
                      <td className="p-2 border-r border-slate-300 text-center font-semibold text-slate-500">
                        {i + 1}
                      </td>
                      <td className="p-2 border-r border-slate-300 font-bold text-slate-900">
                        <div>{ex.subjectName}</div>
                        <div className="text-[10px] font-normal text-slate-500">{ex.title}</div>
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <div>
                          {ex?.startTime ? new Date(ex.startTime).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {ex?.startTime ? new Date(ex.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} s/d Selesai
                        </div>
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-bold">
                        {ex.durationMinutes} Menit
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center">
                        {ex.totalQuestions} Butir
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-bold text-blue-700">
                        {ex.passingGrade || 75}
                      </td>
                      <td className="p-2 text-center font-bold text-blue-700">
                        {ex.totalParticipants} Siswa
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-2 pt-6 text-center text-xs">
                <div>
                  <div className="text-slate-500 mb-12">Ketua Panitia Ujian,</div>
                  <div className="font-bold underline text-slate-900">Panitia Pelaksana CBT</div>
                  <div className="text-[10px] text-slate-400">NIP. -</div>
                </div>

                <div>
                  <div className="text-slate-500 mb-12">Kepala Satuan Pendidikan,</div>
                  <div className="font-bold underline text-slate-900">Kepala Sekolah</div>
                  <div className="text-[10px] text-slate-400">NIP. -</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: PRATINJAU BUTIR SOAL NASKAH UJIAN
          ========================================================= */}
      {previewExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {previewExam.subjectName}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {previewExam.durationMinutes} Menit
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    KKM: {previewExam.passingGrade || 75}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 leading-snug">
                  Pratinjau Naskah: {previewExam.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Total {previewExam.questions?.length || 0} butir soal beku siap diujikan kepada siswa
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewExam(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Question List (Scrollable) */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {(!previewExam.questions || previewExam.questions.length === 0) ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Tidak ada butir soal dalam naskah ini.
                </div>
              ) : (
                previewExam.questions.map((q: any, idx: number) => (
                  <div
                    key={q.id || idx}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
                  >
                    {/* Item Meta */}
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                          {q.type?.replace(/_/g, ' ') || 'PILIHAN GANDA'}
                        </span>
                        {q.topic && (
                          <span className="text-[10px] font-medium text-slate-500">
                            • {q.topic}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        Bobot: {q.weight || q.points || 10} poin
                      </span>
                    </div>

                    {/* Stimulus if exists */}
                    {(q.stimulusText || q.stimulusTitle || q.stimulusMediaUrl) && (
                      <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-xl text-xs space-y-2">
                        {q.stimulusTitle && (
                          <div className="font-bold text-blue-900 text-xs">
                            {q.stimulusTitle}
                          </div>
                        )}
                        {q.stimulusMediaUrl && (
                          <img
                            src={q.stimulusMediaUrl}
                            alt="Stimulus"
                            className="max-h-48 rounded-lg border border-blue-200 object-contain"
                          />
                        )}
                        {q.stimulusText && (
                          <div className="text-slate-700 leading-relaxed">
                            <MathRenderer text={q.stimulusText} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Question Content */}
                    <div className="text-sm font-medium text-slate-900 leading-relaxed">
                      <MathRenderer text={q.content || q.text || ''} />
                    </div>

                    {/* Question Media */}
                    {(q.mediaUrl || q.imageUrl || q.image_url) && (
                      <img
                        src={q.mediaUrl || q.imageUrl || q.image_url}
                        alt="Media Soal"
                        className="max-h-56 rounded-xl border border-slate-200 object-contain"
                      />
                    )}

                    {/* Options (PILIHAN GANDA / MULTI) */}
                    {Array.isArray(q.options) && q.options.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {q.options.map((opt: any, oIdx: number) => {
                          const optKey = opt.key || opt.id || String.fromCharCode(65 + oIdx);
                          const isCorrect = Array.isArray(q.correctAnswer)
                            ? q.correctAnswer.includes(optKey)
                            : q.correctAnswer === optKey || q.correct_answer === optKey;

                          return (
                            <div
                              key={optKey}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl text-xs border transition ${
                                isCorrect
                                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-semibold'
                                  : 'bg-white border-slate-200/80 text-slate-700'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {optKey}
                              </span>
                              <div className="flex-1 pt-0.5">
                                <MathRenderer text={opt.text || opt.content || ''} />
                              </div>
                              {isCorrect && (
                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                                  Kunci Benar
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Essay / Short Answer Key */}
                    {(q.type === 'ESSAY' || q.type === 'ISIAN_SINGKAT') && (
                      <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900">
                        <span className="font-bold">Kunci / Rubrik: </span>
                        <span>{q.correctAnswer || q.correct_answer || q.rubric || 'Penilaian manual oleh guru pengampu'}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setPreviewExam(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTargetExam}
        onClose={() => setDeleteTargetExam(null)}
        onConfirm={handleDeleteExam}
        title="Hapus Jadwal Ujian"
        itemName={deleteTargetExam?.title || 'Jadwal Ujian'}
        description="Apakah Anda yakin ingin menghapus jadwal ujian ini? Data soal beku dan token peserta terkait akan dihapus secara permanen."
        isLoading={isDeletingExam}
      />
    </AdminLayout>
  );
}
