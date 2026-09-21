'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Table,
  BarChart3,
  FileText,
  Users,
  ShieldAlert,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

const REPORT_TYPES = [
  { id: 'SUMMARY', label: 'Ringkasan & Agregat', icon: BarChart3, desc: 'Statistik lulus, rata-rata, nilai tertinggi & terendah.' },
  { id: 'STUDENT_RECAP', label: 'Rekap Nilai per Siswa', icon: Users, desc: 'Daftar nilai seluruh siswa per ujian atau kelas.' },
  { id: 'SUBJECT_RECAP', label: 'Rekap per Mata Pelajaran', icon: BookOpen, desc: 'Distribusi nilai dan rata-rata per mata pelajaran.' },
  { id: 'CLASS_RECAP', label: 'Rekap per Kelas', icon: Table, desc: 'Performa rata-rata dan pencapaian per rombel / kelas.' },
  { id: 'ROOM_RECAP', label: 'Rekap Ruang & Sesi', icon: Printer, desc: 'Kehadiran dan distribusi peserta per ruang & sesi.' },
  { id: 'ITEM_ANALYSIS', label: 'Analisis Butir Soal', icon: FileText, desc: 'Tingkat kesukaran, daya pembeda butir soal.' },
  { id: 'ANOMALY_LOG', label: 'Log Anomali & Pelanggaran', icon: ShieldAlert, desc: 'Rekaman insiden kecurangan dan diskualifikasi.' },
  { id: 'EXPORT_ALL', label: 'Export Nilai Lengkap', icon: FileSpreadsheet, desc: 'Ekspor komprehensif seluruh data nilai dan jawaban.' },
];

export default function SchoolReportsPage() {
  const [activeReport, setActiveReport] = useState<string>('SUMMARY');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        type: activeReport,
        format: 'json',
      });
      if (selectedExamId) query.set('examId', selectedExamId);

      const res = await fetch(`/api/admin/reports?${query.toString()}`);
      const json = await res.json();
      if (json.success) {
        setReportData(json.data.report || json.data);
        if (json.data.exams) setExams(json.data.exams);
      } else {
        showNotification(json.error?.message || 'Gagal memuat laporan', 'error');
      }
    } catch {
      showNotification('Koneksi server gagal', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeReport, selectedExamId]);

  const handleExportCSV = () => {
    const query = new URLSearchParams({
      type: activeReport,
      format: 'csv',
    });
    if (selectedExamId) query.set('examId', selectedExamId);
    window.open(`/api/admin/reports?${query.toString()}`, '_blank');
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

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Laporan & Ekspor Sekolah</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  8 modul pelaporan terpadu dengan ekspor CSV dan format rekapan resmi.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <option value="">Semua Ujian</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))}
            </select>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>
        </div>

        {/* Reports Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {REPORT_TYPES.map((rep) => {
            const Icon = rep.icon;
            const isActive = activeReport === rep.id;
            return (
              <button
                key={rep.id}
                onClick={() => setActiveReport(rep.id)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                <div>
                  <div className="text-xs font-bold leading-tight">{rep.label}</div>
                  <div className="text-[10px] text-slate-400 mt-1 line-clamp-2">{rep.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Report Content Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <Clock className="w-6 h-6 animate-spin mx-auto mb-2" />
              Menyusun data laporan...
            </div>
          ) : !reportData ? (
            <div className="py-16 text-center text-slate-400">
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Tidak ada data untuk laporan yang dipilih.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {REPORT_TYPES.find((r) => r.id === activeReport)?.label}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {REPORT_TYPES.find((r) => r.id === activeReport)?.desc}
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Dokumen
                </button>
              </div>

              {/* Dynamic Presentation */}
              {Array.isArray(reportData) ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                        {Object.keys(reportData[0] || {}).map((col) => (
                          <th key={col} className="py-2.5 px-3">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reportData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          {Object.values(row).map((val: any, vIdx) => (
                            <td key={vIdx} className="py-2 px-3 text-slate-700 dark:text-slate-300">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4">
                  <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono">
                    {JSON.stringify(reportData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
