'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import {
  Award,
  Download,
  Search,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCw,
  FileCheck2,
  Eye,
} from 'lucide-react';

function GuruResultsContent() {
  const searchParams = useSearchParams();
  const initialExamId = searchParams?.get('examId') || '';

  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState(initialExamId);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
          if (!selectedExamId && eJson.exams.length > 0) {
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

  const loadResults = async () => {
    if (!selectedExamId) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set('examId', selectedExamId);
      if (selectedClassId) q.set('classId', selectedClassId);
      if (search) q.set('search', search);

      const res = await fetch(`/api/guru/results?${q.toString()}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.results || []);
        setTotal(json.total || 0);
      } else {
        setError(json.error || 'Gagal memuat hasil ujian.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      loadResults();
    }
  }, [selectedExamId, selectedClassId]);

  const handleExportCSV = async () => {
    if (!selectedExamId) return;
    setExporting(true);
    try {
      const q = new URLSearchParams();
      q.set('examId', selectedExamId);
      if (selectedClassId) q.set('classId', selectedClassId);

      const res = await fetch(`/api/guru/results/export?${q.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        const rows = json.data;
        if (rows.length === 0) {
          alert('Tidak ada data hasil ujian untuk diekspor.');
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
        link.setAttribute('download', `Hasil_Nilai_Ujian_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert(json.error || 'Gagal mengekspor data.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan saat mengekspor.');
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      key: 'index',
      header: 'No',
      cell: (_, idx) => <span className="font-mono text-xs text-slate-400">{idx + 1}</span>,
      className: 'w-12 text-center',
    },
    {
      key: 'studentName',
      header: 'Nama Peserta Didik',
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="font-bold text-slate-900 text-sm">{row.studentName}</div>
          <div className="text-xs text-slate-500 font-mono">NIS: {row.nis || '—'}</div>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'className',
      header: 'Rombel',
      cell: (row) => <Badge variant="neutral" size="sm">{row.className || 'Rombel'}</Badge>,
      sortable: true,
    },
    {
      key: 'score',
      header: 'Nilai Akhir',
      cell: (row) => {
        const score = typeof row.finalScore === 'number' ? row.finalScore : row.score;
        const isPassed = row.isPassed !== undefined ? row.isPassed : score >= 75;
        return (
          <div className="space-y-1">
            <span className="font-mono text-base font-bold text-slate-900">
              {score !== null && score !== undefined ? score.toFixed(1) : '—'}
            </span>
            <div>
              <Badge variant={isPassed ? 'success' : 'danger'} size="sm">
                {isPassed ? 'Tuntas' : 'Remedial'}
              </Badge>
            </div>
          </div>
        );
      },
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status Sesi & Koreksi',
      cell: (row) => (
        <div className="space-y-1">
          <StatusBadge status={row.status || 'COMPLETED'} size="sm" />
          {row.pendingEssayCount > 0 && (
            <div className="text-[11px] text-amber-700 font-medium">
              {row.pendingEssayCount} essay belum dinilai
            </div>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      key: 'submittedAt',
      header: 'Waktu Pengumpulan',
      cell: (row) => (
        <span className="text-xs text-slate-500 font-mono">
          {row.submittedAt
            ? new Date(row.submittedAt).toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Aksi',
      cell: (row) => {
        const resId = row.resultId || row.id;
        if (!resId) return <span className="text-slate-400 text-xs">—</span>;
        return (
          <div className="flex items-center justify-center">
            <Link
              href={`/guru/results/${resId}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 transition-all"
              title="Lihat Rincian Hasil"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Detail</span>
            </Link>
          </div>
        );
      },
      className: 'w-24 text-center',
    },
  ];

  return (
    <GuruLayout
      title="Daftar Nilai & Hasil Asesmen"
      subtitle="Rekapitulasi pencapaian skor peserta didik, status ketuntasan KKM, dan ekspor lembar nilai resmi"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Penilaian', href: '/guru/grading' },
        { label: 'Hasil Nilai' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            isLoading={exporting}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Ekspor Nilai (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadResults}
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
          <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 flex items-center gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-danger-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Bar */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Exam Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Pilih Paket Ujian:
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold text-slate-900"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} ({ex.subjectName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Filter Rombel:
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                >
                  <option value="">Semua Rombel</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.studentCount} Siswa)
                    </option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cari Siswa:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Nama atau NIS siswa..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadResults()}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <DataTable
          data={results}
          columns={columns}
          isLoading={loading}
          error={error}
          onRetry={loadResults}
          emptyTitle="Belum Ada Nilai Tersimpan"
          emptyDescription="Hasil ujian peserta akan tampil di sini secara otomatis setelah siswa menyelesaikan pengerjaan."
          pageSize={20}
          itemName="nilai siswa"
        />
      </div>
    </GuruLayout>
  );
}

export default function GuruResultsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">Memuat hasil nilai...</div>}>
      <GuruResultsContent />
    </Suspense>
  );
}
