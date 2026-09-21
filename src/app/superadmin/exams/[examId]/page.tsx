'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarCheck,
  Building2,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Play,
  Archive,
  RefreshCw,
  ArrowLeft,
  XCircle,
  FileCheck2,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';

interface ExamDetailData {
  exam: {
    id: string;
    title: string;
    status: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    passingGrade: number;
    randomizeQuestions: boolean;
    randomizeOptions: boolean;
    subjectName?: string;
    createdAt: string;
  };
  assignedSchools: Array<{
    id: string;
    schoolId: string;
    schoolName: string;
    schoolCode: string;
    status: string;
    quotaStudents: number;
    participantCount: number;
  }>;
  summary: {
    totalSchools: number;
    totalParticipants: number;
    totalQuestions: number;
    totalSessions: number;
  };
}

export default function SuperAdminExamDetailPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const resolvedParams = use(params);
  const examId = resolvedParams.examId;
  const router = useRouter();

  const [data, setData] = useState<ExamDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    action: 'PUBLISHED' | 'LOCKED' | 'ARCHIVED' | 'ACTIVE' | null;
    title: string;
    description: string;
    variant: 'primary' | 'danger';
  }>({ action: null, title: '', description: '', variant: 'primary' });
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/superadmin/exams/${examId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal memuat detail paket ujian.');
      }
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data ujian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [examId]);

  const handleExecuteStatusTransition = async () => {
    if (!confirmModal.action) return;

    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/superadmin/exams/${examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRANSITION_STATUS',
          status: confirmModal.action,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal mengubah status ujian.');

      setConfirmModal({ action: null, title: '', description: '', variant: 'primary' });
      loadDetail();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status ujian.');
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout
        title="Detail Paket Ujian"
        breadcrumbs={[
          { label: 'Ujian Platform', href: '/superadmin/exams' },
          { label: 'Memuat...' },
        ]}
      >
        <div className="py-20 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
          <span>Memuat konfigurasi paket ujian wilayah...</span>
        </div>
      </SuperAdminLayout>
    );
  }

  if (error || !data) {
    return (
      <SuperAdminLayout
        title="Detail Paket Ujian"
        breadcrumbs={[
          { label: 'Ujian Platform', href: '/superadmin/exams' },
          { label: 'Error' },
        ]}
      >
        <div className="max-w-md mx-auto py-12">
          <Card className="p-6 text-center space-y-4">
            <XCircle className="w-10 h-10 text-danger mx-auto" />
            <h2 className="text-base font-bold text-text-primary">Paket Ujian Tidak Ditemukan</h2>
            <p className="text-xs text-text-muted">{error}</p>
            <Link href="/superadmin/exams">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Kembali ke Daftar Ujian
              </Button>
            </Link>
          </Card>
        </div>
      </SuperAdminLayout>
    );
  }

  const { exam, assignedSchools, summary } = data;

  return (
    <SuperAdminLayout
      title={exam.title}
      subtitle="Tata kelola dan distribusi paket asesmen tingkat wilayah"
      breadcrumbs={[
        { label: 'Ujian Platform', href: '/superadmin/exams' },
        { label: exam.title },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDetail}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Segarkan
          </Button>

          {exam.status === 'DRAFT' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                setConfirmModal({
                  action: 'PUBLISHED',
                  title: 'Publikasikan Ujian Wilayah?',
                  description:
                    'Paket ujian ini akan didistribusikan ke sekolah-sekolah yang ditugaskan dan siap diselenggarakan sesuai jadwal.',
                  variant: 'primary',
                })
              }
              leftIcon={<Play className="w-3.5 h-3.5" />}
            >
              Publikasikan Ujian
            </Button>
          )}

          {exam.status === 'PUBLISHED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setConfirmModal({
                  action: 'LOCKED',
                  title: 'Kunci Lembar Ujian (Lock)?',
                  description:
                    'Setelah dikunci, butir soal dan konfigurasi ujian menjadi immutable dan tidak dapat diedit lagi oleh pihak manapun.',
                  variant: 'primary',
                })
              }
              leftIcon={<Lock className="w-3.5 h-3.5" />}
            >
              Kunci Lembar Soal
            </Button>
          )}

          {exam.status !== 'ARCHIVED' && (
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                setConfirmModal({
                  action: 'ARCHIVED',
                  title: 'Arsipkan Paket Ujian?',
                  description:
                    'Ujian akan ditutup secara permanen dan sesi aktif peserta akan dihentikan secara administratif.',
                  variant: 'danger',
                })
              }
              leftIcon={<Archive className="w-3.5 h-3.5" />}
            >
              Arsipkan
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Exam Identity Header Card */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-base border border-primary-100 shrink-0">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-text-primary">{exam.title}</h1>
                  <StatusBadge
                    status={exam.status}
                  />
                  <Badge variant="primary" size="sm">
                    {exam.durationMinutes} Menit
                  </Badge>
                </div>
                <p className="text-xs text-text-muted">
                  Passing Grade: <strong className="text-text-secondary">{exam.passingGrade}</strong> • Acak Soal:{' '}
                  {exam.randomizeQuestions ? 'Ya' : 'Tidak'} • Acak Opsi:{' '}
                  {exam.randomizeOptions ? 'Ya' : 'Tidak'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <span className="text-text-muted block">Sekolah Ditugaskan</span>
                <span className="font-bold text-text-primary text-base">
                  {summary.totalSchools || assignedSchools.length} Sekolah
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-subtle border border-border rounded-lg overflow-x-auto">
          {[
            { id: 'overview', label: 'Ringkasan & Konfigurasi' },
            { id: 'schools', label: `Sekolah Terdaftar (${assignedSchools.length})` },
            { id: 'schedule', label: 'Jadwal & Waktu' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition shrink-0 ${
                activeTab === t.id
                  ? 'bg-surface text-primary-700 font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-divider">
                Parameter Evaluasi
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Judul Ujian</span>
                  <span className="font-semibold text-text-primary">{exam.title}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Durasi Pengerjaan</span>
                  <span className="font-bold text-text-primary">{exam.durationMinutes} Menit</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Nilai Ambang Batas (KKM)</span>
                  <span className="font-bold text-primary-700">{exam.passingGrade}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Pengacakan Butir Soal</span>
                  <span className="font-semibold text-text-primary">
                    {exam.randomizeQuestions ? 'Aktif (Per Siswa Berbeda)' : 'Nonaktif'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Pengacakan Opsi Jawaban</span>
                  <span className="font-semibold text-text-primary">
                    {exam.randomizeOptions ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-divider">
                Snapshot & Integritas Soal
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Total Butir Soal</span>
                  <span className="font-semibold text-text-primary">
                    {summary.totalQuestions || 0} Soal Terpilih
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Status Snapshot</span>
                  <span className="font-bold text-emerald-600">
                    {exam.status === 'LOCKED' || exam.status === 'PUBLISHED'
                      ? 'Immutable (Terkunci)'
                      : 'Draft Snapshot'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Dibuat Pada</span>
                  <span className="text-text-secondary">
                    {new Date(exam.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Kebijakan Hasil</span>
                  <span className="text-text-secondary">Diumumkan Pasca Ujian Selesai</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 2: Assigned Schools */}
        {activeTab === 'schools' && (
          <Card className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-divider">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Satuan Pendidikan Peserta</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Sekolah yang diberi mandat menyelenggarakan asesmen ini
                </p>
              </div>
              <Badge variant="primary" size="sm">{assignedSchools.length} Sekolah</Badge>
            </div>

            <div className="divide-y divide-divider pt-2">
              {assignedSchools.length > 0 ? (
                assignedSchools.map((sch) => (
                  <div key={sch.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-surface-subtle border border-divider flex items-center justify-center text-primary-600 shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <Link
                          href={`/superadmin/schools/${sch.schoolId}`}
                          className="font-bold text-text-primary hover:underline hover:text-primary-600 block"
                        >
                          {sch.schoolName}
                        </Link>
                        <p className="text-text-muted text-[11px]">
                          Kode: <span className="font-mono">{sch.schoolCode}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-[11px] space-y-0.5">
                      <span className="text-text-primary font-bold block">
                        {sch.participantCount || 0} Siswa Terdaftar
                      </span>
                      <span className="text-text-muted block">Status: {sch.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10">
                  <EmptyState
                    title="Belum Ada Sekolah Ditugaskan"
                    description="Paket ujian wilayah ini belum ditugaskan ke satuan pendidikan manapun."
                  />
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Tab 3: Schedule */}
        {activeTab === 'schedule' && (
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-divider flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-600" />
              Jadwal Pelaksanaan Asesmen
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-lg bg-surface-subtle border border-divider space-y-1">
                <span className="text-text-muted block">Waktu Mulai Ujian</span>
                <span className="text-sm font-bold text-text-primary font-mono">
                  {new Date(exam.startTime).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="p-4 rounded-lg bg-surface-subtle border border-divider space-y-1">
                <span className="text-text-muted block">Batas Akhir Ujian (Selesai)</span>
                <span className="text-sm font-bold text-text-primary font-mono">
                  {new Date(exam.endTime).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmModal.action}
        onClose={() => setConfirmModal({ action: null, title: '', description: '', variant: 'primary' })}
        onConfirm={handleExecuteStatusTransition}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel="Ya, Lanjutkan"
        confirmVariant={confirmModal.variant}
        isLoading={submittingAction}
      />
    </SuperAdminLayout>
  );
}
