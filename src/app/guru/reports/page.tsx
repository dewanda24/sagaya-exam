'use client';

import { useState, useEffect } from 'react';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  FileSpreadsheet,
  Download,
  FileText,
  BarChart3,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  BookOpen,
  Filter,
} from 'lucide-react';

export default function GuruReportsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    async function loadMeta() {
      try {
        const [eRes, cRes] = await Promise.all([
          fetch('/api/guru/exams'),
          fetch('/api/guru/classes'),
        ]);
        const eJson = await eRes.json();
        const cJson = await cRes.json();

        if (eJson.success && eJson.exams) {
          setExams(eJson.exams);
          if (eJson.exams.length > 0) {
            setSelectedExamId(eJson.exams[0].id);
          }
        }
        if (cJson.success && cJson.data) {
          setClasses(cJson.data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadMeta();
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;

    async function loadSummary() {
      setLoading(true);
      try {
        const q = new URLSearchParams({ examId: selectedExamId });
        if (selectedClassId) q.set('classId', selectedClassId);

        const res = await fetch(`/api/guru/results?${q.toString()}`);
        const json = await res.json();
        if (json.success && Array.isArray(json.results)) {
          const results = json.results;
          const scores = results
            .map((r: any) => (typeof r.finalScore === 'number' ? r.finalScore : r.score))
            .filter((s: any) => typeof s === 'number' && !isNaN(s));

          const total = results.length;
          const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
          const max = scores.length > 0 ? Math.max(...scores) : 0;
          const min = scores.length > 0 ? Math.min(...scores) : 0;
          const passed = results.filter((r: any) => {
            const sc = typeof r.finalScore === 'number' ? r.finalScore : r.score;
            return sc >= 75;
          }).length;

          setSummary({
            total,
            submittedCount: results.filter((r: any) => r.status === 'GRADED' || r.status === 'PUBLISHED').length,
            avg: avg.toFixed(1),
            max: max.toFixed(1),
            min: min.toFixed(1),
            passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : '0',
          });
        }
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [selectedExamId, selectedClassId]);

  const handleExportCSV = async () => {
    if (!selectedExamId) return;
    setDownloading('csv');
    try {
      const q = new URLSearchParams({ examId: selectedExamId });
      if (selectedClassId) q.set('classId', selectedClassId);

      const res = await fetch(`/api/guru/results/export?${q.toString()}`);
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        const rows = json.data;
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
        link.setAttribute('download', `Rekap_Nilai_${selectedExamId}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Berhasil mengunduh rekap lembar nilai CSV');
      } else {
        showToast('Tidak ada data nilai untuk diekspor', 'error');
      }
    } catch {
      showToast('Gagal mengunduh file ekspor', 'error');
    } finally {
      setDownloading(null);
    }
  };

  const handleExportDirect = (format: 'xlsx' | 'pdf') => {
    if (!selectedExamId) return;
    setDownloading(format);
    window.open(`/api/export?examId=${selectedExamId}&format=${format}`, '_blank');
    setTimeout(() => {
      setDownloading(null);
      showToast(`Permintaan unduh ${format.toUpperCase()} sedang diproses.`);
    }, 1500);
  };

  return (
    <GuruLayout
      title="Pusat Laporan & Ekspor Nilai"
      subtitle="Unduh rekapitulasi nilai resmi, lembar asesmen, dan data performa siswa untuk administrasi kurikulum"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Laporan', href: '/guru/reports' },
        { label: 'Ekspor Data' },
      ]}
    >
      <div className="space-y-6 pb-12">
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

        {/* Filter Section */}
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-1.5 w-full">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  Pilih Asesmen / Ujian
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.subjectName || 'Mata Pelajaran'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full md:w-64 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                  Filter Rombel / Kelas
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Semua Rombel Terkait</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Total Peserta</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{summary.total} Siswa</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{summary.submittedCount} sudah dinilai</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Rata-Rata Nilai</div>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{summary.avg}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Skala 0 - 100</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Tertinggi / Terendah</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {summary.max} <span className="text-slate-300 text-lg font-normal">/</span> {summary.min}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Rentang sebaran nilai</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 font-medium">Ketuntasan (KKM ≥ 75)</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{summary.passRate}%</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Memenuhi standar kelulusan</div>
            </div>
          </div>
        )}

        {/* Report Download Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Rekap Nilai CSV */}
          <Card className="hover:border-indigo-300 transition-all">
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-2">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                Rekap Nilai Siswa (CSV)
              </CardTitle>
              <CardDescription>
                Format lembar kerja universal (Comma Separated Values), kompatibel dengan Excel, Google Sheets, dan dapodik.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="primary"
                className="w-full"
                onClick={handleExportCSV}
                isLoading={downloading === 'csv'}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Unduh Rekap CSV
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Buku Nilai Resmi XLSX */}
          <Card className="hover:border-indigo-300 transition-all">
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center mb-2">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                Buku Nilai Resmi (XLSX)
              </CardTitle>
              <CardDescription>
                Buku nilai berformat spreadsheet resmi dengan formula sanitasi terproteksi dan identitas sekolah lengkap.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                onClick={() => handleExportDirect('xlsx')}
                isLoading={downloading === 'xlsx'}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Unduh Format XLSX
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Dokumen Berkas PDF */}
          <Card className="hover:border-indigo-300 transition-all">
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                Lembar Nilai Cetak (PDF)
              </CardTitle>
              <CardDescription>
                Format siap cetak untuk arsip fisik tata usaha kurikulum dan laporan hasil asesmen per rombel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full border-rose-200 text-rose-700 hover:bg-rose-50"
                onClick={() => handleExportDirect('pdf')}
                isLoading={downloading === 'pdf'}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Unduh Format PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </GuruLayout>
  );
}
