'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import {
  ShieldCheck,
  RotateCw,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Radio,
  FileCheck2,
  Eye,
  Laptop,
} from 'lucide-react';

function GuruMonitoringContent() {
  const searchParams = useSearchParams();
  const initialExamId = searchParams?.get('examId') || '';

  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState(initialExamId);
  const [participants, setParticipants] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load list of exams
  useEffect(() => {
    async function loadExams() {
      try {
        const res = await fetch('/api/guru/exams');
        const json = await res.json();
        if (json.success && json.exams) {
          setExams(json.exams);
          if (!selectedExamId && json.exams.length > 0) {
            setSelectedExamId(json.exams[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadExams();
  }, []);

  const loadMonitoringData = async () => {
    if (!selectedExamId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guru/monitoring?examId=${selectedExamId}`);
      const json = await res.json();
      if (json.success) {
        setParticipants(json.participants || []);
        setSummary(json.summary || null);
      } else {
        setError(json.error || 'Gagal memuat radar monitoring ujian.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      loadMonitoringData();
    }
  }, [selectedExamId]);

  // Auto-refresh interval (10s)
  useEffect(() => {
    if (!autoRefresh || !selectedExamId) return;
    const interval = setInterval(() => {
      loadMonitoringData();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedExamId]);

  const ongoingCount = participants.filter((p) => p.status === 'ONGOING' || p.status === 'STARTED').length;
  const completedCount = participants.filter((p) => p.status === 'SUBMITTED' || p.status === 'COMPLETED').length;
  const totalViolations = participants.reduce((acc, p) => acc + (p.violationCount || 0), 0);

  const columns: ColumnDef<any>[] = [
    {
      key: 'index',
      header: 'No',
      cell: (_, idx) => <span className="font-mono text-xs text-slate-400">{idx + 1}</span>,
      className: 'w-12 text-center',
    },
    {
      key: 'studentName',
      header: 'Peserta Ujian',
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="font-bold text-slate-900 text-sm">{row.studentName || row.name}</div>
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
      key: 'status',
      header: 'Status Pengerjaan',
      cell: (row) => {
        const s = row.status || 'NOT_STARTED';
        return <StatusBadge status={s} size="sm" />;
      },
      sortable: true,
    },
    {
      key: 'timing',
      header: 'Waktu Mulai & Sisa',
      cell: (row) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <div className="flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>
              {row.startedAt
                ? new Date(row.startedAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Belum Mulai'}
            </span>
          </div>
          {row.remainingMinutes !== undefined && (
            <div className="text-slate-400">Sisa: {row.remainingMinutes} mnt</div>
          )}
        </div>
      ),
    },
    {
      key: 'violations',
      header: 'Indikasi Pelanggaran',
      cell: (row) => {
        const count = row.violationCount || 0;
        if (count === 0) {
          return (
            <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Bersih
            </span>
          );
        }
        return (
          <Badge variant={count > 3 ? 'danger' : 'warning'} size="sm">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {count}x Pindah Tab
          </Badge>
        );
      },
      sortable: true,
    },
  ];

  return (
    <GuruLayout
      title="Radar Monitoring Pelaksanaan Ujian"
      subtitle="Pemantauan progres pengerjaan siswa, status integritas sesi, dan statistik real-time (Khusus Pengajar)"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Ujian', href: '/guru/exams' },
        { label: 'Monitoring Langsung' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span>Auto-Refresh (10s)</span>
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMonitoringData}
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
            <Button variant="danger" size="sm" onClick={loadMonitoringData}>
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Exam Selector Bar */}
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                Pilih Ujian:
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="py-2 px-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold text-slate-900"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({ex.subjectName})
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Akses Pengajar Terisolasi • Tindakan Disiplin dikelola oleh Pengawas Ruang</span>
            </div>
          </CardContent>
        </Card>

        {/* Live Metrics StatCards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Peserta Terdaftar"
            value={participants.length}
            subtitle="Di seluruh rombel sasaran"
            icon={<Users className="w-5 h-5" />}
            color="primary"
          />
          <StatCard
            title="Sedang Mengerjakan"
            value={ongoingCount}
            subtitle="Sesi aktif di peramban siswa"
            icon={<Radio className="w-5 h-5" />}
            color="warning"
          />
          <StatCard
            title="Sudah Selesai Submit"
            value={completedCount}
            subtitle="Lembar jawaban tersimpan"
            icon={<CheckCircle2 className="w-5 h-5" />}
            color="success"
          />
          <StatCard
            title="Total Peringatan Tab"
            value={totalViolations}
            subtitle="Terdeteksi oleh pengawas browser"
            icon={<AlertTriangle className="w-5 h-5" />}
            color={totalViolations > 0 ? 'danger' : 'neutral'}
          />
        </div>

        {/* Participants Table */}
        <DataTable
          data={participants}
          columns={columns}
          isLoading={loading}
          error={error}
          onRetry={loadMonitoringData}
          emptyTitle="Belum Ada Aktivitas Peserta"
          emptyDescription="Peserta ujian belum memulai sesi pengerjaan pada paket ujian ini."
          pageSize={20}
          itemName="peserta ujian"
        />
      </div>
    </GuruLayout>
  );
}

export default function GuruMonitoringPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">Memuat monitoring ujian...</div>}>
      <GuruMonitoringContent />
    </Suspense>
  );
}
