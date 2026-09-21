'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import {
  FileCheck2,
  PlusCircle,
  Search,
  Calendar,
  Clock,
  Lock,
  Play,
  CheckCircle2,
  AlertCircle,
  Eye,
  ShieldCheck,
  RotateCw,
  Radio,
  Users,
} from 'lucide-react';

export default function GuruExamsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Publish Dialog
  const [publishId, setPublishId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const loadExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (selectedSubject) q.set('subjectId', selectedSubject);
      if (selectedStatus) q.set('status', selectedStatus);

      const [eRes, sRes] = await Promise.all([
        fetch(`/api/guru/exams?${q.toString()}`),
        fetch('/api/guru/subjects'),
      ]);
      const eJson = await eRes.json();
      const sJson = await sRes.json();

      if (eJson.success) {
        setExams(eJson.exams || []);
        setTotal(eJson.total || 0);
      } else {
        setError(eJson.error || 'Gagal memuat daftar paket ujian.');
      }
      if (sJson.success && sJson.data) {
        setSubjects(sJson.data);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, [selectedSubject, selectedStatus]);

  const confirmPublishExam = async () => {
    if (!publishId) return;
    setIsPublishing(true);
    try {
      const res = await fetch(`/api/guru/exams/${publishId}/publish`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        setPublishId(null);
        loadExams();
      } else {
        alert(json.error || 'Gagal merilis ujian.');
      }
    } catch {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      setIsPublishing(false);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      key: 'title',
      header: 'Nama Paket Ujian',
      cell: (row) => (
        <div className="space-y-1">
          <Link
            href={`/guru/exams/${row.id}`}
            className="font-bold text-slate-900 hover:text-primary-600 transition-colors block text-sm"
          >
            {row.title}
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-200">
              {row.subjectName} ({row.subjectCode})
            </span>
            <span>• Dibuat: {row.creatorName || 'Pengajar'}</span>
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'schedule',
      header: 'Jadwal & Durasi',
      cell: (row) => (
        <div className="space-y-1 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">{row.durationMinutes} Menit</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {new Date(row.startTime).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
              })}{' '}
              -{' '}
              {new Date(row.endTime).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'stats',
      header: 'Soal & Peserta',
      cell: (row) => (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-800">
            {row.questionCount || 0} Butir Soal
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="w-3 h-3 text-slate-400" />
            <span>{row.participantCount || 0} Peserta</span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status Ujian',
      cell: (row) => <StatusBadge status={row.status || 'DRAFT'} size="sm" />,
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Aksi',
      cell: (row) => {
        const isDraft = row.status === 'DRAFT';
        const isScheduled = row.status === 'SCHEDULED';
        const isActive = row.status === 'ACTIVE';

        return (
          <div className="flex items-center gap-1.5">
            <Link href={`/guru/exams/${row.id}`}>
              <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                Detail
              </Button>
            </Link>

            {isDraft && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setPublishId(row.id)}
                leftIcon={<Play className="w-3.5 h-3.5" />}
              >
                Rilis Ujian
              </Button>
            )}

            {(isActive || isScheduled) && (
              <Link href={`/guru/monitoring?examId=${row.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  leftIcon={<Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />}
                >
                  Pantau
                </Button>
              </Link>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <GuruLayout
      title="Manajemen Ujian Pengajar"
      subtitle="Penyusunan naskah asesmen, penjadwalan rombel, dan monitoring pelaksanaan ujian resmi sekolah"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Ujian Saya' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadExams}
            isLoading={loading}
            leftIcon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Segarkan
          </Button>
          <Link href="/guru/exams/schedule">
            <Button variant="outline" size="sm" leftIcon={<Calendar className="w-3.5 h-3.5" />}>
              Kalender Jadwal
            </Button>
          </Link>
          <Link href="/guru/exams/new">
            <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Buat Paket Ujian
            </Button>
          </Link>
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
            <Button variant="danger" size="sm" onClick={loadExams}>
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Cari judul paket ujian..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadExams()}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

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

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="py-2 px-3 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Semua Status</option>
                <option value="DRAFT">DRAFT (Penyusunan)</option>
                <option value="SCHEDULED">SCHEDULED (Terjadwal)</option>
                <option value="ACTIVE">ACTIVE (Sedang Berlangsung)</option>
                <option value="COMPLETED">COMPLETED (Selesai)</option>
                <option value="ARCHIVED">ARCHIVED (Diarsipkan)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Exams DataTable */}
        <DataTable
          data={exams}
          columns={columns}
          isLoading={loading}
          error={error}
          onRetry={loadExams}
          emptyTitle="Belum Ada Paket Ujian"
          emptyDescription="Buat paket ujian pertama Anda untuk memulai asesmen berbasis komputer."
          emptyActionLabel="Buat Paket Ujian"
          onEmptyAction={() => (window.location.href = '/guru/exams/new')}
          pageSize={10}
          itemName="ujian"
        />
      </div>

      {/* CONFIRM PUBLISH DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(publishId)}
        onClose={() => setPublishId(null)}
        onConfirm={confirmPublishExam}
        title="Rilis Paket Ujian ke Siswa?"
        description="Merilis ujian akan mengunci butir naskah soal secara permanen (LOCKED) untuk menjaga integritas asesmen. Peserta didik pada rombel terpilih akan dapat mengakses ujian sesuai jadwal yang ditentukan."
        confirmLabel="Ya, Rilis Ujian Sekarang"
        cancelLabel="Batal"
        confirmVariant="primary"
        isLoading={isPublishing}
      />
    </GuruLayout>
  );
}
