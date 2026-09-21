'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Award,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Edit3,
  TrendingUp,
  Clock,
  Sparkles,
  BookOpen,
  Calendar,
  Building2,
  Check,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Pagination from '@/components/common/Pagination';

interface ParticipantScore {
  participantId: string;
  sessionId: string;
  studentId: string;
  fullName: string;
  nisn: string;
  nis: string;
  className: string;
  token: string;
  assignedPackage: string;
  finalScore: number | null;
  gradedStatus: string;
  sessionStatus: string;
  startedAt: string | null;
  submittedAt: string | null;
  tabViolations: number;
  answers: any[];
}

interface ExamInfo {
  id: string;
  title: string;
  subjectName: string;
  schoolName: string;
  durationMinutes: number;
  totalQuestions: number;
  passingGrade?: number;
  scoringRules?: any;
  questions: any[];
}

function AdminNilaiContent() {
  const searchParams = useSearchParams();
  const initialExamId = searchParams.get('examId') || '';

  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [availableExams, setAvailableExams] = useState<{ id: string; title: string }[]>([]);
  const [currentExamId, setCurrentExamId] = useState(initialExamId);
  const [participants, setParticipants] = useState<ParticipantScore[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [kkmThreshold, setKkmThreshold] = useState<number>(75);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const printRef = useRef<HTMLDivElement>(null);

  const fetchScores = async (targetId?: string) => {
    setLoading(true);
    try {
      const url = `/api/admin/scores${targetId ? `?examId=${targetId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setExam(data.data.exam);
        setParticipants(data.data.participants);
        setStats(data.data.stats);
        setAvailableExams(data.data.availableExams || []);
        if (data.data.exam?.passingGrade !== undefined) {
          setKkmThreshold(Number(data.data.exam.passingGrade));
        }
        if (data.data.exam?.id) {
          setCurrentExamId(data.data.exam.id);
        }
      }
    } catch {
      showNotification('Gagal memuat rekap nilai.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores(initialExamId);

    const handleSchoolChanged = () => fetchScores();
    window.addEventListener('sagaya:school-changed', handleSchoolChanged);
    return () => window.removeEventListener('sagaya:school-changed', handleSchoolChanged);
  }, [initialExamId]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const essayQuestions = exam?.questions?.filter((q) => q.type === 'ESSAY') || [];

  // Essay grading progress
  const essayGradedCount = participants.filter((p) => {
    if (essayQuestions.length === 0) return true;
    return essayQuestions.every((eq) => {
      const ans = p.answers.find((a) => a.questionId === eq.id);
      return ans && ans.manualScore !== undefined && ans.manualScore !== null;
    });
  }).length;

  const essayProgressPercent =
    participants.length > 0 ? Math.round((essayGradedCount / participants.length) * 100) : 0;

  // Passing rate statistics
  const completedScores = participants.filter((p) => p.finalScore !== null);
  const passedStudents = completedScores.filter((p) => (p.finalScore || 0) >= kkmThreshold);
  const passRate =
    completedScores.length > 0
      ? Math.round((passedStudents.length / completedScores.length) * 100)
      : 0;

  const handleExport = (format: 'standard' | 'erapor' | 'rdm' = 'standard') => {
    if (!exam || participants.length === 0) return;

    let exportRows: any[] = [];
    let sheetName = 'Leger_Nilai_CBT';
    let filePrefix = 'Leger_Nilai';

    if (format === 'erapor') {
      sheetName = 'Nilai_eRapor';
      filePrefix = 'eRapor';
      exportRows = filteredParticipants.map((p, idx) => {
        const score = p.finalScore !== null ? p.finalScore : null;
        let predikat = 'D';
        let capaian = 'Perlu bimbingan dan pendampingan remedial intensif.';
        if (score !== null) {
          if (score >= 90) {
            predikat = 'A';
            capaian = 'Menunjukkan penguasaan capaian pembelajaran yang sangat istimewa.';
          } else if (score >= 80) {
            predikat = 'B';
            capaian = 'Menunjukkan penguasaan capaian pembelajaran yang baik.';
          } else if (score >= kkmThreshold) {
            predikat = 'C';
            capaian = 'Menunjukkan penguasaan capaian pembelajaran yang cukup.';
          }
        }

        return {
          No: idx + 1,
          NISN: p.nisn || '-',
          NIS: p.nis || '-',
          'Nama Peserta Didik': p.fullName,
          Rombel: p.className || 'Umum',
          'Mata Pelajaran': exam.subjectName,
          'Nilai Asesmen': score !== null ? score : 'Belum Ada',
          'KKM / KKTP': kkmThreshold,
          Predikat: score !== null ? predikat : '-',
          'Status Ketuntasan': score !== null ? (score >= kkmThreshold ? 'Tercapai' : 'Perlu Remedial') : 'Belum Selesai',
          'Deskripsi Capaian Kompetensi': score !== null ? capaian : 'Belum menyelesaikan asesmen.',
        };
      });
    } else if (format === 'rdm') {
      sheetName = 'Nilai_RDM_Kemenag';
      filePrefix = 'RDM_Kemenag';
      exportRows = filteredParticipants.map((p, idx) => {
        const score = p.finalScore !== null ? p.finalScore : null;
        let predikat = 'D';
        if (score !== null) {
          if (score >= 90) predikat = 'A';
          else if (score >= 80) predikat = 'B';
          else if (score >= kkmThreshold) predikat = 'C';
        }

        return {
          No: idx + 1,
          NISN: p.nisn || '-',
          'Nama Siswa': p.fullName,
          Kelas: p.className || '-',
          'Mata Pelajaran': exam.subjectName,
          'Nilai Ujian': score !== null ? score : 0,
          KKM: kkmThreshold,
          Predikat: score !== null ? predikat : '-',
          Status: score !== null ? (score >= kkmThreshold ? 'TUNTAS' : 'REMEDIAL') : 'TIDAK HADIR',
        };
      });
    } else {
      // Standard format
      sheetName = 'Leger_Nilai_CBT';
      filePrefix = 'Leger_Nilai';
      exportRows = filteredParticipants.map((p, idx) => ({
        No: idx + 1,
        'Nama Lengkap': p.fullName,
        NISN: p.nisn,
        NIS: p.nis,
        Kelas: p.className,
        Paket: p.assignedPackage,
        Token: p.token,
        'Status Pengerjaan': p.sessionStatus,
        'Pelanggaran Tab': p.tabViolations,
        'Waktu Mulai': p.startedAt ? new Date(p.startedAt).toLocaleTimeString('id-ID') : '-',
        'Waktu Selesai': p.submittedAt ? new Date(p.submittedAt).toLocaleTimeString('id-ID') : '-',
        'Nilai Akhir': p.finalScore !== null ? p.finalScore : 'Belum Selesai',
        KKM: kkmThreshold,
        Keterangan:
          p.finalScore !== null
            ? p.finalScore >= kkmThreshold
              ? 'TUNTAS'
              : 'REMEDIAL'
            : 'BELUM SELESAI',
        'Status Koreksi Essay': p.gradedStatus,
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const cleanTitle = (exam.title || 'Ujian').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `${filePrefix}_${cleanTitle}.xlsx`);
    setExportDropdownOpen(false);
    showNotification(`Berhasil mengekspor format ${format.toUpperCase()}`, 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const classes = Array.from(new Set(participants.map((p) => p.className).filter(Boolean)));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, classFilter, currentExamId]);

  const filteredParticipants = participants.filter((p) => {
    const matchSearch =
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (p.nisn && p.nisn.includes(search)) ||
      (p.nis && p.nis.includes(search));
    const matchClass = !classFilter || p.className === classFilter;
    return matchSearch && matchClass;
  });

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

      {/* Screen View (Hidden when printing) */}
      <div className="print:hidden space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Award className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Leger & Laporan Nilai CBT
              </h1>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Admin Sekolah
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Rekapitulasi resmi hasil penilaian ujian, analisis ketuntasan KKM, ekspor file spreadsheet (e-Rapor &amp; RDM), dan cetak leger A4.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap relative">
            <button
              type="button"
              disabled={!exam || participants.length === 0}
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Leger (A4)</span>
            </button>

            {/* Multi-Format Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                disabled={!exam || participants.length === 0}
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Ekspor Excel</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${exportDropdownOpen ? 'rotate-90' : ''}`} />
              </button>

              {exportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Pilih Format Lembar Nilai
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExport('standard')}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900">Leger Nilai Standar CBT</div>
                      <div className="text-[10px] text-slate-400">Lengkap detail waktu &amp; pelanggaran</div>
                    </div>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('erapor')}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer border-t border-slate-50"
                  >
                    <div>
                      <div className="font-bold text-blue-700">Format e-Rapor Kemendikbud</div>
                      <div className="text-[10px] text-slate-400">Kurikulum Merdeka / Capaian Kompetensi</div>
                    </div>
                    <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.5 rounded">Dapodik</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('rdm')}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer border-t border-slate-50"
                  >
                    <div>
                      <div className="font-bold text-teal-700">Format RDM Kemenag</div>
                      <div className="text-[10px] text-slate-400">Rapor Digital Madrasah / KKM</div>
                    </div>
                    <span className="text-[9px] bg-teal-100 text-teal-700 font-extrabold px-1.5 py-0.5 rounded">Madrasah</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Exam Switcher Banner */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                    {exam?.subjectName || 'Mata Pelajaran'}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-semibold text-slate-600">
                    {exam?.schoolName || 'SMA Negeri 1 Sagaya'}
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 mt-0.5">
                  {exam?.title || 'Pilih Jadwal Ujian'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Pilih Ujian:</span>
              <select
                value={currentExamId}
                onChange={(e) => {
                  setCurrentExamId(e.target.value);
                  fetchScores(e.target.value);
                }}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-800 max-w-[260px]"
              >
                {availableExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Teacher Essay Grading Status Alert */}
          {essayQuestions.length > 0 && (
            <div className="pt-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5 text-xs">
                <span className="font-bold text-slate-700">
                  Status Koreksi Essay Guru Mapel:
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${
                    essayProgressPercent === 100
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {essayProgressPercent === 100
                    ? 'Lengkap 100% Dinilai'
                    : `${essayGradedCount} dari ${participants.length} Siswa Selesai (${essayProgressPercent}%)`}
                </span>
              </div>

              <Link
                href={`/guru/koreksi-essay?examId=${currentExamId}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Buka Portal Koreksi Guru</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Summary Score Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-blue-600">
            <div className="text-xs font-semibold text-slate-500">Siswa Menyelesaikan</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {stats.completedCount || 0} / {stats.totalStudents || 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {participants.length > 0
                ? Math.round(((stats.completedCount || 0) / participants.length) * 100)
                : 0}
              % Partisipasi
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-indigo-600">
            <div className="text-xs font-semibold text-slate-500">Rata-rata Nilai</div>
            <div className="text-2xl font-black text-indigo-600 mt-1">
              {stats.averageScore || 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Skala 0 - 100</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-emerald-600">
            <div className="text-xs font-semibold text-slate-500">Nilai Tertinggi</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {stats.highestScore || 0}
            </div>
            <div className="text-[10px] text-emerald-600/80 mt-1 font-semibold">Skor Maksimal</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-rose-500">
            <div className="text-xs font-semibold text-slate-500">Nilai Terendah</div>
            <div className="text-2xl font-black text-rose-600 mt-1">
              {stats.lowestScore || 0}
            </div>
            <div className="text-[10px] text-rose-500/80 mt-1 font-semibold">Skor Minimal</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs border-l-4 border-l-teal-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Ketuntasan KKM</span>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                <span>KKM:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={kkmThreshold}
                  onChange={(e) => setKkmThreshold(Number(e.target.value) || 75)}
                  className="w-10 px-1 py-0.5 text-center font-mono font-bold bg-slate-100 rounded border border-slate-200 text-slate-700"
                />
              </div>
            </div>
            <div className="text-2xl font-black text-teal-600 mt-1">{passRate}%</div>
            <div className="text-[10px] text-teal-600/90 mt-1 font-semibold">
              {passedStudents.length} dari {completedScores.length} Siswa Tuntas
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama peserta, NISN, atau NIS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-700"
            >
              <option value="">Semua Rombel ({filteredParticipants.length})</option>
              {classes.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Leger Nilai Table */}
        <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs">
          {loading ? (
            <div className="p-16 text-center text-slate-500 text-sm">Memuat leger nilai CBT...</div>
          ) : filteredParticipants.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <Award className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <div className="font-bold text-slate-800 text-base">Belum Ada Data Nilai</div>
              <p className="text-xs text-slate-400 mt-1">
                Peserta belum memulai atau menyelesaikan ujian ini.
              </p>
            </div>
        ) : (
          <div>
            <div className="w-full">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                    <th className="px-4 sm:px-6 py-3.5 w-[28%]">Peserta Didik</th>
                    <th className="px-3 py-3.5 w-[16%]">NISN / NIS</th>
                    <th className="px-3 py-3.5 w-[12%]">Kelas</th>
                    <th className="px-3 py-3.5 w-[12%] text-center">Status Sesi</th>
                    <th className="px-3 py-3.5 w-[12%] text-center">Waktu Pengerjaan</th>
                    <th className="px-3 py-3.5 w-[10%] text-center">Nilai Akhir</th>
                    <th className="px-4 sm:px-6 py-3.5 w-[10%] text-center">Ketuntasan (KKM: {kkmThreshold})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                  {filteredParticipants
                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    .map((p, idx) => {
                      const isPassed = p.finalScore !== null && p.finalScore >= kkmThreshold;
                      const globalIdx = (currentPage - 1) * pageSize + idx + 1;

                      return (
                        <tr key={p.participantId} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 sm:px-6 py-3.5">
                            <div className="font-black text-slate-900 text-xs sm:text-sm truncate">
                              {globalIdx}. {p.fullName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                              Token: {p.token} • Paket {p.assignedPackage}
                            </div>
                          </td>

                          <td className="px-3 py-3.5 font-mono">
                            <div className="font-bold text-slate-800 text-xs truncate">{p.nisn || '-'}</div>
                            <div className="text-[10px] text-slate-400 truncate">NIS: {p.nis || '-'}</div>
                          </td>

                          <td className="px-3 py-3.5">
                            <span className="inline-block font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] truncate max-w-full">
                              {p.className}
                            </span>
                          </td>

                          <td className="px-3 py-3.5 text-center">
                            <span
                              className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                p.sessionStatus === 'SUBMITTED'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : p.sessionStatus === 'IN_PROGRESS'
                                  ? 'bg-blue-50 text-blue-700 animate-pulse'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {p.sessionStatus === 'SUBMITTED' ? 'Selesai' : p.sessionStatus}
                            </span>
                          </td>

                          <td className="px-3 py-3.5 text-center font-mono text-[11px] text-slate-500">
                            {p.submittedAt ? (
                              <span>{new Date(p.submittedAt).toLocaleTimeString('id-ID')}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          <td className="px-3 py-3.5 text-center">
                            {p.finalScore !== null ? (
                              <span
                                className={`inline-block font-mono font-black text-sm px-2.5 py-0.5 rounded-lg ${
                                  isPassed
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {p.finalScore}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">Belum selesai</span>
                            )}
                          </td>

                          <td className="px-4 sm:px-6 py-3.5 text-center">
                            {p.finalScore !== null ? (
                              isPassed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Tuntas</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  <span>Belum</span>
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-[10px]">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Pagination Component */}
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(filteredParticipants.length / pageSize) || 1}
              totalItems={filteredParticipants.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              itemName="peserta"
            />
          </div>
        )}
        </div>
      </div>

      {/* Printable Leger Document (Rendered only on print / hidden on screen) */}
      <div className="hidden print:block font-sans text-black bg-white p-4">
        {/* CSS Print Stylesheet injected */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 landscape;
              margin: 10mm 12mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}} />

        {/* Kop Surat Resmi */}
        <div className="border-b-2 border-black pb-2 mb-4 text-center">
          <h2 className="text-xs font-bold tracking-widest uppercase text-gray-700">
            KEMENTERIAN PENDIDIKAN, KEBUDAYAAN, RISET, DAN TEKNOLOGI / KEMENAG
          </h2>
          <h1 className="text-xl font-black tracking-wider uppercase mt-0.5">
            {exam?.schoolName || 'SMA NEGERI 1 SAGAYA'}
          </h1>
          <p className="text-[10px] italic text-gray-600 mt-0.5">
            Dokumen Resmi Rekapitulasi Hasil Penilaian Asesmen Sumatif Berbasis Komputer (CBT Sagaya)
          </p>
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <h3 className="text-sm font-black uppercase underline tracking-wider">
            LEGER NILAI HASIL ASESMEN PESERTA DIDIK
          </h3>
          <p className="text-[11px] text-gray-800 mt-0.5 font-semibold">
            Mata Pelajaran: <span className="font-black">{exam?.subjectName}</span> • Judul Asesmen: <span className="font-black">{exam?.title}</span>
            {classFilter && <span> • Rombel / Kelas: <span className="font-black">{classFilter}</span></span>}
          </p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 text-[11px] mb-3 border border-black/30 p-2.5 rounded bg-gray-50/50">
          <div>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="w-36 py-0.5 font-bold">Mata Pelajaran</td>
                  <td>: {exam?.subjectName}</td>
                </tr>
                <tr>
                  <td className="py-0.5 font-bold">Kriteria Ketuntasan (KKM / KKTP)</td>
                  <td>: <span className="font-black">{kkmThreshold} Poin</span></td>
                </tr>
                <tr>
                  <td className="py-0.5 font-bold">Jumlah Soal / Durasi</td>
                  <td>: {exam?.totalQuestions} Butir / {exam?.durationMinutes} Menit</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="w-36 py-0.5 font-bold">Peserta Terdaftar / Tuntas</td>
                  <td>: {participants.length} Siswa / <span className="font-black text-emerald-800">{passedStudents.length} Siswa ({passRate}%)</span></td>
                </tr>
                <tr>
                  <td className="py-0.5 font-bold">Peserta Selesai / Remedial</td>
                  <td>: {stats.completedCount || 0} Siswa / <span className="font-black text-rose-800">{completedScores.length - passedStudents.length} Siswa</span></td>
                </tr>
                <tr>
                  <td className="py-0.5 font-bold">Rata-rata / Tertinggi / Terendah</td>
                  <td>: {stats.averageScore || 0} / {stats.highestScore || 0} / {stats.lowestScore || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Print Table */}
        <table className="w-full border-collapse border border-black text-[10px] mb-4">
          <thead>
            <tr className="bg-gray-100 text-center font-bold">
              <th className="border border-black px-1.5 py-1 w-8">No</th>
              <th className="border border-black px-2 py-1 text-left">Nama Lengkap Peserta Didik</th>
              <th className="border border-black px-2 py-1 w-24">NISN</th>
              <th className="border border-black px-2 py-1 w-16">NIS</th>
              <th className="border border-black px-2 py-1 w-20">Kelas</th>
              <th className="border border-black px-2 py-1 w-14">Paket</th>
              <th className="border border-black px-2 py-1 w-14">Nilai</th>
              <th className="border border-black px-2 py-1 w-14">Predikat</th>
              <th className="border border-black px-2 py-1 w-24">Status Ketuntasan</th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.map((p, idx) => {
              const score = p.finalScore;
              const isPassed = score !== null && score >= kkmThreshold;
              let predikat = '-';
              if (score !== null) {
                if (score >= 90) predikat = 'A';
                else if (score >= 80) predikat = 'B';
                else if (score >= kkmThreshold) predikat = 'C';
                else predikat = 'D';
              }

              return (
                <tr key={p.participantId} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border border-black px-1.5 py-0.5 text-center">{idx + 1}</td>
                  <td className="border border-black px-2 py-0.5 font-bold">{p.fullName}</td>
                  <td className="border border-black px-2 py-0.5 text-center font-mono">{p.nisn || '-'}</td>
                  <td className="border border-black px-2 py-0.5 text-center font-mono">{p.nis || '-'}</td>
                  <td className="border border-black px-2 py-0.5 text-center">{p.className}</td>
                  <td className="border border-black px-2 py-0.5 text-center font-mono">{p.assignedPackage}</td>
                  <td className="border border-black px-2 py-0.5 text-center font-bold font-mono">
                    {score !== null ? score : '-'}
                  </td>
                  <td className="border border-black px-2 py-0.5 text-center font-bold">
                    {predikat}
                  </td>
                  <td className={`border border-black px-2 py-0.5 text-center font-bold ${
                    score === null ? 'text-gray-400' : isPassed ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {score !== null ? (isPassed ? 'TUNTAS' : 'REMEDIAL') : 'TIDAK HADIR'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Statistical Summary Footer */}
        <div className="border border-black p-2 mb-4 text-[10px] grid grid-cols-4 gap-2 text-center bg-gray-50">
          <div>
            <span className="block text-gray-500">Nilai Tertinggi</span>
            <strong className="text-xs font-black">{stats.highestScore || 0}</strong>
          </div>
          <div>
            <span className="block text-gray-500">Nilai Terendah</span>
            <strong className="text-xs font-black">{stats.lowestScore || 0}</strong>
          </div>
          <div>
            <span className="block text-gray-500">Nilai Rata-rata</span>
            <strong className="text-xs font-black">{stats.averageScore || 0}</strong>
          </div>
          <div>
            <span className="block text-gray-500">Tingkat Ketuntasan</span>
            <strong className="text-xs font-black">{passRate}%</strong>
          </div>
        </div>

        {/* Signature Blocks */}
        <div className="grid grid-cols-2 gap-8 text-[11px] pt-2">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p className="font-bold">Kepala Sekolah</p>
            <div className="h-14" />
            <p className="font-bold underline uppercase">( ................................................... )</p>
            <p className="text-[10px]">NIP. ..................................................</p>
          </div>

          <div className="text-center">
            <p>Ditetapkan di Sagaya, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-bold">Guru Pengampu / Proktor Ujian</p>
            <div className="h-14" />
            <p className="font-bold underline uppercase">( ................................................... )</p>
            <p className="text-[10px]">NIP. ..................................................</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default function AdminNilaiPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Memuat Leger Nilai CBT...</div>}>
      <AdminNilaiContent />
    </Suspense>
  );
}
