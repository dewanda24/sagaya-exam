'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  BarChart3,
  Users,
  CheckCircle2,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Clock,
  HelpCircle,
  Camera,
  Archive,
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export default function AdminAnalyticsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'DISTRIBUTION' | 'ITEM_ANALYSIS' | 'VIOLATIONS' | 'SNAPSHOTS'>('OVERVIEW');
  const [loading, setLoading] = useState<boolean>(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [questionData, setQuestionData] = useState<any>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch daftar ujian
  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await fetch('/api/admin/exams');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setExams(json.data);
          if (json.data.length > 0) {
            setSelectedExamId(json.data[0].id);
          }
        }
      } catch {
        // Fallback
      }
    };
    fetchExams();
  }, []);

  // 2. Fetch data analytics saat ujian berubah
  useEffect(() => {
    if (!selectedExamId) return;
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics/exams/${selectedExamId}`);
        const json = await res.json();
        if (json.success) {
          setAnalyticsData(json.data);
        } else {
          showToast(json.error || 'Gagal memuat analitik ujian', 'error');
        }
      } catch {
        showToast('Koneksi ke server analitik terputus', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [selectedExamId]);

  // 3. Fetch Item Analysis jika tab aktif
  useEffect(() => {
    if (!selectedExamId || activeTab !== 'ITEM_ANALYSIS') return;
    const fetchQuestions = async () => {
      try {
        const res = await fetch(`/api/analytics/exams/${selectedExamId}/questions`);
        const json = await res.json();
        if (json.success) {
          setQuestionData(json.data);
        }
      } catch {
        // Ignored
      }
    };
    fetchQuestions();
  }, [selectedExamId, activeTab]);

  // 4. Fetch Snapshots jika tab aktif
  useEffect(() => {
    if (activeTab !== 'SNAPSHOTS') return;
    const fetchSnapshots = async () => {
      try {
        const res = await fetch('/api/reports/snapshots');
        const json = await res.json();
        if (json.success) {
          setSnapshots(json.data || []);
        }
      } catch {
        // Ignored
      }
    };
    fetchSnapshots();
  }, [activeTab]);

  // Handle Export Sync / Download
  const handleExport = (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!selectedExamId) return;
    setExportLoading(format);
    window.open(`/api/export?examId=${selectedExamId}&format=${format}`, '_blank');
    setTimeout(() => setExportLoading(null), 1500);
  };

  // Handle Create Frozen Snapshot
  const handleCreateSnapshot = async () => {
    if (!selectedExamId || !analyticsData) return;
    try {
      const res = await fetch('/api/reports/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'EXAM_SUMMARY',
          scope: 'EXAM',
          filters: { examId: selectedExamId },
          dataPayload: analyticsData,
          status: 'PUBLISHED',
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('Snapshot resmi laporan berhasil dibekukan & disimpan!', 'success');
        setActiveTab('SNAPSHOTS');
      } else {
        showToast(json.error || 'Gagal membuat snapshot', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server snapshot', 'error');
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {toast && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-rose-600 text-white shadow-rose-500/20'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {toast.message}
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <BarChart3 className="w-4 h-4" />
              Intelligence & Performance Engine
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Analytics & Report Center</h1>
            <p className="text-slate-400 text-sm mt-1">
              Evaluasi performa ujian, reliabilitas butir soal, presensi, dan distribusi nilai berbasis snapshot terverifikasi.
            </p>
          </div>

          {/* Exam Selector & Export Dropdown */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none max-w-xs"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('xlsx')}
                disabled={!selectedExamId || exportLoading !== null}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-medium transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                XLSX
              </button>

              <button
                onClick={() => handleExport('pdf')}
                disabled={!selectedExamId || exportLoading !== null}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-sm font-medium transition"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>

              <button
                onClick={handleCreateSnapshot}
                disabled={!selectedExamId || !analyticsData}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-600/20 transition"
              >
                <Camera className="w-4 h-4" />
                Bekukan Snapshot
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-2">
          {[
            { id: 'OVERVIEW', label: 'Ringkasan Eksekutif', icon: Layers },
            { id: 'DISTRIBUTION', label: 'Distribusi Nilai', icon: TrendingUp },
            { id: 'ITEM_ANALYSIS', label: 'Analisis Butir Soal', icon: HelpCircle },
            { id: 'VIOLATIONS', label: 'Pelanggaran & Integritas', icon: AlertTriangle },
            { id: 'SNAPSHOTS', label: 'Arsip Snapshot Resmi', icon: Archive },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition -mb-[2px] ${
                  isActive
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
            Memuat agregasi analitik server-side...
          </div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'OVERVIEW' && analyticsData && (
              <div className="space-y-6">
                {/* 4 Big KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                    <span className="text-slate-400 text-xs font-semibold uppercase">Tingkat Kehadiran</span>
                    <div className="text-3xl font-bold text-white mt-2">
                      {analyticsData.participation.attendanceRatePercentage}%
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Hadir: <span className="text-emerald-400 font-semibold">{analyticsData.participation.present}</span> / {analyticsData.participation.registered} Peserta
                    </p>
                  </div>

                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                    <span className="text-slate-400 text-xs font-semibold uppercase">Tingkat Penyelesaian</span>
                    <div className="text-3xl font-bold text-white mt-2">
                      {analyticsData.sessions.completionRatePercentage}%
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Selesai: <span className="text-indigo-400 font-semibold">{analyticsData.sessions.completed}</span> / {analyticsData.sessions.started} Dimulai
                    </p>
                  </div>

                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                    <span className="text-slate-400 text-xs font-semibold uppercase">Rata-rata Nilai (Mean)</span>
                    <div className="text-3xl font-bold text-white mt-2">{analyticsData.scores.mean}</div>
                    <p className="text-xs text-slate-400 mt-2">
                      Median: <span className="text-amber-400 font-semibold">{analyticsData.scores.median}</span> | Std Dev: {analyticsData.scores.standardDeviation}
                    </p>
                  </div>

                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                    <span className="text-slate-400 text-xs font-semibold uppercase">Tingkat Kelulusan (KKM)</span>
                    <div className="text-3xl font-bold text-emerald-400 mt-2">
                      {analyticsData.scores.passRatePercentage}%
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Lulus: {analyticsData.scores.passedCount} | Gagal: {analyticsData.scores.failedCount} (KKM: {analyticsData.scores.passingGrade})
                    </p>
                  </div>
                </div>

                {/* Secondary Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300">Rentang Skor Peserta</h3>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Nilai Tertinggi:</span>
                      <span className="text-emerald-400 font-bold text-base">{analyticsData.scores.max}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Nilai Terendah:</span>
                      <span className="text-rose-400 font-bold text-base">{analyticsData.scores.min}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Kuartil Atas (P75):</span>
                      <span className="text-indigo-300 font-semibold">{analyticsData.scores.percentile75}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Kuartil Bawah (P25):</span>
                      <span className="text-indigo-300 font-semibold">{analyticsData.scores.percentile25}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300">Statistik Waktu Pengerjaan</h3>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Rata-rata Waktu:</span>
                      <span className="text-white font-semibold">{analyticsData.sessions.averageDurationMinutes} Menit</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Alokasi Waktu:</span>
                      <span className="text-slate-300">{analyticsData.exam.allocatedDurationMinutes} Menit</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Sesi Timeout:</span>
                      <span className="text-amber-400 font-semibold">{analyticsData.sessions.timeout}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Sesi Diterminasi:</span>
                      <span className="text-rose-400 font-semibold">{analyticsData.sessions.terminated}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300">Kejadian Pelanggaran</h3>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Total Indikasi:</span>
                      <span className="text-rose-400 font-bold text-base">{analyticsData.violations.totalEvents}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Pelanggaran mencakup perpindahan tab, keluar fullscreen, hilangnya fokus, dan anomali koneksi jaringan.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SCORE DISTRIBUTION */}
            {activeTab === 'DISTRIBUTION' && analyticsData && (
              <div className="space-y-6">
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
                  <h3 className="text-base font-bold text-white mb-4">Histogram Distribusi Nilai (Skala 0–100)</h3>
                  <div className="space-y-3">
                    {analyticsData.scores.distributionBuckets.map((b: any) => (
                      <div key={b.range} className="flex items-center gap-4 text-xs">
                        <span className="w-16 text-slate-400 font-mono text-right">{b.range}</span>
                        <div className="flex-1 bg-slate-950 h-5 rounded-lg overflow-hidden relative">
                          <div
                            className="bg-indigo-500 h-full rounded-lg transition-all duration-500"
                            style={{ width: `${b.percentage}%` }}
                          />
                        </div>
                        <span className="w-20 text-slate-300 font-medium">
                          {b.count} ({b.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-800/30">
                    <span className="text-xs text-emerald-400 font-semibold">Grade A (85-100)</span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {analyticsData.scores.gradeBrackets.gradeA.count} Siswa
                    </div>
                    <span className="text-xs text-slate-400">{analyticsData.scores.gradeBrackets.gradeA.percentage}%</span>
                  </div>
                  <div className="bg-blue-950/20 p-4 rounded-xl border border-blue-800/30">
                    <span className="text-xs text-blue-400 font-semibold">Grade B (70-84)</span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {analyticsData.scores.gradeBrackets.gradeB.count} Siswa
                    </div>
                    <span className="text-xs text-slate-400">{analyticsData.scores.gradeBrackets.gradeB.percentage}%</span>
                  </div>
                  <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-800/30">
                    <span className="text-xs text-amber-400 font-semibold">Grade C (55-69)</span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {analyticsData.scores.gradeBrackets.gradeC.count} Siswa
                    </div>
                    <span className="text-xs text-slate-400">{analyticsData.scores.gradeBrackets.gradeC.percentage}%</span>
                  </div>
                  <div className="bg-rose-950/20 p-4 rounded-xl border border-rose-800/30">
                    <span className="text-xs text-rose-400 font-semibold">Grade D (&lt;55)</span>
                    <div className="text-2xl font-bold text-white mt-1">
                      {analyticsData.scores.gradeBrackets.gradeD.count} Siswa
                    </div>
                    <span className="text-xs text-slate-400">{analyticsData.scores.gradeBrackets.gradeD.percentage}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ITEM ANALYSIS */}
            {activeTab === 'ITEM_ANALYSIS' && questionData && (
              <div className="space-y-4">
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>
                    Total Butir Dianalisis: <strong className="text-white">{questionData.totalQuestions}</strong> | Peserta: <strong className="text-white">{questionData.totalParticipantsEvaluated}</strong>
                  </span>
                  <span className="italic">Terikat permanen pada snapshot: {questionData.snapshotId.slice(0, 8)}...</span>
                </div>

                <div className="space-y-3">
                  {questionData.questions.map((q: any) => (
                    <div key={q.questionId} className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center text-sm border border-indigo-500/30">
                            {q.position}
                          </span>
                          <div>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              {q.questionType}
                            </span>
                            <span className="text-xs text-slate-400 ml-2">Poin Maks: {q.maxScore}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400">Tingkat Kesukaran (p):</span>
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              q.difficultyIndex >= 0.7
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                                : q.difficultyIndex >= 0.3
                                ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
                                : 'bg-rose-950/40 text-rose-400 border border-rose-800/40'
                            }`}
                          >
                            {q.difficultyIndex} ({q.difficultyClassification})
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-slate-200 line-clamp-2">{q.questionText || 'Tanpa teks stimulus'}</p>

                      {/* Option Distribution */}
                      {q.optionsDistribution && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2">
                          {q.optionsDistribution.map((opt: any) => (
                            <div
                              key={opt.optionId}
                              className={`p-2 rounded-lg border text-xs ${
                                opt.isKey
                                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                                  : 'bg-slate-950/40 border-slate-800 text-slate-400'
                              }`}
                            >
                              <div className="flex justify-between font-mono">
                                <span>{opt.optionLabel} {opt.isKey ? '(KUNCI)' : ''}</span>
                                <strong>{opt.count}</strong>
                              </div>
                              <div className="text-[11px] text-slate-500">{opt.percentage}%</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: VIOLATIONS */}
            {activeTab === 'VIOLATIONS' && analyticsData && (
              <div className="space-y-4">
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
                  <h3 className="text-base font-bold text-white mb-4">Rincian Peristiwa Pelanggaran Siswa</h3>
                  <div className="divide-y divide-slate-800">
                    {analyticsData.violations.breakdown.length === 0 ? (
                      <p className="text-sm text-slate-400 py-6 text-center">Nihil pelanggaran tercatat selama ujian.</p>
                    ) : (
                      analyticsData.violations.breakdown.map((v: any, idx: number) => (
                        <div key={idx} className="py-3 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                v.severity === 'CRITICAL'
                                  ? 'bg-rose-500'
                                  : v.severity === 'WARNING'
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500'
                              }`}
                            />
                            <span className="font-mono text-slate-200">{v.type}</span>
                          </div>
                          <span className="text-slate-300 font-semibold">{v.count} Kali</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: SNAPSHOTS */}
            {activeTab === 'SNAPSHOTS' && (
              <div className="space-y-4">
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
                  <h3 className="text-base font-bold text-white mb-2">Arsip Dokumen Laporan Resmi yang Dibekukan</h3>
                  <p className="text-xs text-slate-400 mb-6">
                    Snapshot bersifat kekal (immutable) untuk menjamin reproduktifitas data hasil evaluasi resmi saat diaudit.
                  </p>

                  <div className="divide-y divide-slate-800">
                    {snapshots.length === 0 ? (
                      <p className="text-sm text-slate-400 py-6 text-center">Belum ada snapshot resmi yang dibekukan.</p>
                    ) : (
                      snapshots.map((s) => (
                        <div key={s.id} className="py-4 flex items-center justify-between text-sm">
                          <div>
                            <span className="font-semibold text-white">{s.report_type}</span>
                            <span className="text-xs px-2 py-0.5 ml-2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40">
                              {s.status}
                            </span>
                            <p className="text-xs text-slate-400 mt-1">
                              Dibekukan pada {new Date(s.generated_at).toLocaleString('id-ID')} oleh {s.generator_name || 'Admin'}
                            </p>
                          </div>
                          <span className="text-xs font-mono text-slate-400">ID: {s.id.slice(0, 8)}...</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
