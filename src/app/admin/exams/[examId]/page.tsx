'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import {
  Calendar,
  Clock,
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Award,
  Layers,
  FileCheck2,
  ArrowLeft,
  DoorOpen,
  UserCheck,
  Activity,
  Play,
  StopCircle,
  Lock,
  Archive,
  RefreshCw,
} from 'lucide-react';

interface QuestionInExam {
  exam_question_id: string;
  order_index: number;
  weight: number;
  id: string;
  title: string;
  type: string;
  difficulty?: string;
  points?: number;
}

interface ExamDetail {
  id: string;
  title: string;
  status: string;
  subjectName: string;
  schoolName: string;
  windowMode: string;
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showScorePolicy: string;
  passingGrade?: number;
  totalParticipants: number;
  questions: QuestionInExam[];
}

export default function SchoolExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'CONFIGURATION' | 'QUESTIONS' | 'PARTICIPANTS' | 'SCHEDULE' | 'ROOMS' | 'PROCTORS' | 'SESSIONS' | 'RESULTS' | 'AUDIT'
  >('OVERVIEW');

  // Lifecycle confirmation modal
  const [lifecycleModal, setLifecycleModal] = useState<{
    isOpen: boolean;
    targetStatus: string;
    title: string;
    description: string;
    confirmVariant: 'primary' | 'warning' | 'danger';
  }>({
    isOpen: false,
    targetStatus: '',
    title: '',
    description: '',
    confirmVariant: 'primary',
  });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchExam = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/exams?id=${encodeURIComponent(examId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setExam(json.data);
      } else {
        setExam(null);
      }
    } catch {
      showToast('Gagal memuat detail ujian.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (examId) fetchExam();
  }, [examId]);

  const handleStatusChange = async () => {
    if (!exam || !lifecycleModal.targetStatus) return;
    setIsUpdatingStatus(true);
    try {
      const res = await fetch('/api/admin/exams', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: exam.id,
          action: 'UPDATE_STATUS',
          status: lifecycleModal.targetStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Status ujian berhasil diubah menjadi ${lifecycleModal.targetStatus}`);
        fetchExam();
      } else {
        showToast(json.error || 'Gagal mengubah status ujian.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setIsUpdatingStatus(false);
      setLifecycleModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Detail Ujian">
        <div className="p-12 text-center text-slate-400 text-xs">
          Memuat data ujian...
        </div>
      </AdminLayout>
    );
  }

  if (!exam) {
    return (
      <AdminLayout title="Detail Ujian">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">Ujian Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Paket ujian tidak terdaftar pada sekolah Anda atau telah dihapus.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push('/admin/exams')}
          >
            Kembali ke Manajemen Ujian
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const questionColumns: ColumnDef<QuestionInExam>[] = [
    {
      key: 'order_index',
      header: 'No.',
      cell: (row, idx) => (
        <span className="font-bold text-slate-700 text-xs">{row.order_index || idx + 1}</span>
      ),
    },
    {
      key: 'title',
      header: 'Butir Naskah Soal',
      cell: (row) => (
        <span className="font-bold text-slate-900 text-xs truncate max-w-md block">
          {row.title || 'Soal Ujian'}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'type',
      header: 'Tipe Soal',
      cell: (row) => (
        <Badge variant="primary" size="sm">
          {row.type || 'PILIHAN GANDA'}
        </Badge>
      ),
    },
    {
      key: 'weight',
      header: 'Bobot',
      cell: (row) => (
        <span className="font-mono text-xs font-bold text-slate-700">
          {row.weight || 1} Poin
        </span>
      ),
    },
  ];

  return (
    <AdminLayout
      title={`Ujian: ${exam.title}`}
      subtitle={`Mapel: ${exam.subjectName} • Durasi: ${exam.durationMinutes} Menit`}
      breadcrumbs={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Ujian', href: '/admin/exams' },
        { label: exam.title },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => router.push('/admin/exams')}
          >
            Kembali
          </Button>

          {exam.status === 'ACTIVE' ? (
            <Link href={`/admin/monitoring/${exam.id}`}>
              <Button variant="primary" size="sm" leftIcon={<Activity className="w-4 h-4" />}>
                Live Monitoring
              </Button>
            </Link>
          ) : null}
        </div>
      }
    >
      {/* Toast Alert */}
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

      <div className="space-y-6">
        {/* Exam Hero Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-lg shrink-0 border border-blue-100">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    {exam.title}
                  </h1>
                  <StatusBadge status={exam.status} size="sm" />
                  <Badge variant="primary" size="sm">
                    {exam.subjectName}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Durasi: <strong>{exam.durationMinutes} Menit</strong> • Mode:{' '}
                  <strong>{exam.windowMode}</strong> • Nilai Kelulusan:{' '}
                  <strong>{exam.passingGrade || 75}</strong>
                </p>
              </div>
            </div>

            {/* Lifecycle Transition Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {exam.status === 'DRAFT' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    setLifecycleModal({
                      isOpen: true,
                      targetStatus: 'PUBLISHED',
                      title: 'Publikasikan Ujian',
                      description: 'Setelah dipublikasikan, ujian siap dijadwalkan ke laboratorium komputer.',
                      confirmVariant: 'primary',
                    })
                  }
                >
                  Publikasikan
                </Button>
              )}

              {exam.status === 'PUBLISHED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    setLifecycleModal({
                      isOpen: true,
                      targetStatus: 'SCHEDULED',
                      title: 'Jadwalkan Ujian',
                      description: 'Tetapkan status ujian menjadi SCHEDULED.',
                      confirmVariant: 'primary',
                    })
                  }
                >
                  Jadwalkan Sesi
                </Button>
              )}

              {exam.status === 'SCHEDULED' && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Play className="w-4 h-4" />}
                  onClick={() =>
                    setLifecycleModal({
                      isOpen: true,
                      targetStatus: 'ACTIVE',
                      title: 'Mulai Ujian Sekarang',
                      description: 'Ujian akan dibuka untuk siswa yang terdaftar di lab.',
                      confirmVariant: 'primary',
                    })
                  }
                >
                  Mulai Ujian
                </Button>
              )}

              {exam.status === 'ACTIVE' && (
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<StopCircle className="w-4 h-4" />}
                  onClick={() =>
                    setLifecycleModal({
                      isOpen: true,
                      targetStatus: 'COMPLETED',
                      title: 'Akhiri Ujian',
                      description: 'Seluruh sesi siswa yang belum selesai akan disubmit otomatis.',
                      confirmVariant: 'danger',
                    })
                  }
                >
                  Selesaikan Ujian
                </Button>
              )}

              {exam.status === 'COMPLETED' && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Lock className="w-4 h-4" />}
                  onClick={() =>
                    setLifecycleModal({
                      isOpen: true,
                      targetStatus: 'LOCKED',
                      title: 'Kunci Nilai Ujian',
                      description: 'Kunci hasil ujian agar skor tidak dapat diubah lagi.',
                      confirmVariant: 'warning',
                    })
                  }
                >
                  Kunci Nilai
                </Button>
              )}
            </div>
          </div>

          {/* Navigation Tabs (10 Tabs) */}
          <div className="flex items-center gap-1 border-t border-slate-100 mt-6 pt-3 overflow-x-auto">
            {(
              [
                'OVERVIEW',
                'CONFIGURATION',
                'QUESTIONS',
                'PARTICIPANTS',
                'SCHEDULE',
                'ROOMS',
                'PROCTORS',
                'SESSIONS',
                'RESULTS',
                'AUDIT',
              ] as const
            ).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === tab
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab === 'OVERVIEW' && 'Overview'}
                {tab === 'CONFIGURATION' && 'Konfigurasi'}
                {tab === 'QUESTIONS' && `Soal (${exam.questions?.length || 0})`}
                {tab === 'PARTICIPANTS' && `Peserta (${exam.totalParticipants || 0})`}
                {tab === 'SCHEDULE' && 'Jadwal'}
                {tab === 'ROOMS' && 'Ruang Ujian'}
                {tab === 'PROCTORS' && 'Pengawas'}
                {tab === 'SESSIONS' && 'Sesi Live'}
                {tab === 'RESULTS' && 'Hasil'}
                {tab === 'AUDIT' && 'Audit'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Ringkasan Paket Ujian
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Judul Ujian</span>
                  <span className="font-bold text-slate-900">{exam.title}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Mata Pelajaran</span>
                  <span className="font-bold text-slate-900">{exam.subjectName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Status Siklus</span>
                  <StatusBadge status={exam.status} size="sm" />
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Alokasi Waktu Pengerjaan</span>
                  <span className="font-bold text-slate-900">{exam.durationMinutes} Menit</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Nilai Ambang Batas (KKM)</span>
                  <span className="font-bold text-emerald-700">{exam.passingGrade || 75} Poin</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  Kesiapan Naskah &amp; Peserta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-400 font-bold block mb-1">Butir Soal Terpasang</span>
                    <span className="text-2xl font-black text-slate-900">
                      {exam.questions?.length || 0}
                    </span>
                  </div>
                  <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                    <span className="text-xs text-blue-600 font-bold block mb-1">Peserta Terdaftar</span>
                    <span className="text-2xl font-black text-blue-700">
                      {exam.totalParticipants || 0}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setActiveTab('QUESTIONS')}
                  >
                    Periksa Butir Soal Terpilih
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'CONFIGURATION' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Parameter Keamanan &amp; Integritas Ujian
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Acak Urutan Soal (Shuffle Questions)</span>
                <span className="font-bold text-slate-800">
                  {exam.randomizeQuestions ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Acak Opsi Pilihan Ganda (Shuffle Options)</span>
                <span className="font-bold text-slate-800">
                  {exam.randomizeOptions ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Kebijakan Rilis Nilai Siswa</span>
                <span className="font-bold text-slate-800">{exam.showScorePolicy || 'AFTER_ALL_DONE'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Model Rentang Waktu (Window Mode)</span>
                <span className="font-bold text-slate-800">{exam.windowMode}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'QUESTIONS' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
            <DataTable
              data={exam.questions || []}
              columns={questionColumns}
              emptyTitle="Belum Ada Soal Ditugaskan"
              emptyDescription="Paket ujian ini belum memiliki naskah soal. Tambahkan dari Bank Soal Sekolah."
              pageSize={15}
              itemName="soal ujian"
            />
          </div>
        )}

        {activeTab === 'PARTICIPANTS' && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Peserta Ujian ({exam.totalParticipants || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center text-xs text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">Daftar Peserta Ujian</p>
              <p className="text-slate-400 mt-0.5">
                Peserta ujian ditentukan berdasarkan rombongan belajar yang dipilih pada saat penjadwalan.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'SCHEDULE' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                Jadwal &amp; Sesi Ujian
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs p-6">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Waktu Mulai</span>
                <span className="font-mono text-slate-800">
                  {exam.startTime ? new Date(exam.startTime).toLocaleString('id-ID') : 'Fleksibel'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Waktu Berakhir</span>
                <span className="font-mono text-slate-800">
                  {exam.endTime ? new Date(exam.endTime).toLocaleString('id-ID') : 'Fleksibel'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Durasi Pengerjaan</span>
                <span className="font-bold text-slate-800">{exam.durationMinutes} Menit</span>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'ROOMS' && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-blue-600" />
                Alokasi Ruang Laboratorium
              </CardTitle>
              <Link href="/admin/exam-rooms">
                <Button variant="outline" size="sm">
                  Kelola Ruang Ujian
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-6 text-center text-xs text-slate-400">
              <DoorOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">Ruang Ujian Terdaftar</p>
              <p className="text-slate-400 mt-0.5">
                Alokasi kapasitas bangku dan komputer dapat dikonfigurasi melalui modul Ruang Ujian.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'PROCTORS' && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                Petugas Pengawas Ruang
              </CardTitle>
              <Link href="/admin/proctors/assignments">
                <Button variant="outline" size="sm">
                  Tugaskan Pengawas
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-6 text-center text-xs text-slate-400">
              <UserCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">Pengawas Ruang Ujian</p>
              <p className="text-slate-400 mt-0.5">
                Penugasan pengawas per sesi ujian dikelola melalui modul Penugasan Pengawas.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'SESSIONS' && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-600" />
                Sesi Berjalan &amp; Live Monitoring
              </CardTitle>
              <Link href={`/admin/monitoring/${exam.id}`}>
                <Button variant="primary" size="sm">
                  Buka Monitoring Live
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-6 text-center text-xs text-slate-400">
              <Activity className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">Pantauan Sesi Peserta</p>
              <p className="text-slate-400 mt-0.5">
                Status koneksi siswa, pengerjaan, dan pelanggaran tab dapat dipantau langsung pada Monitoring Ujian.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'RESULTS' && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" />
                Hasil &amp; Nilai Peserta
              </CardTitle>
              <Link href={`/admin/results?examId=${exam.id}`}>
                <Button variant="outline" size="sm">
                  Buka Leger Nilai
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-6 text-center text-xs text-slate-400">
              <Award className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">Rekapitulasi Nilai</p>
              <p className="text-slate-400 mt-0.5">
                Skor objektif dan koreksi uraian siswa dapat diakses di modul Hasil Ujian.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'AUDIT' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                Log Audit &amp; Perubahan Paket Ujian
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center text-xs text-slate-400">
              <Clock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700">Audit Trail Ujian</p>
              <p className="text-slate-400 mt-0.5">
                Setiap pergantian status siklus, penambahan naskah, dan perubahan jadwal tersimpan secara aman.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lifecycle Confirmation Dialog */}
      <ConfirmDialog
        isOpen={lifecycleModal.isOpen}
        onClose={() => setLifecycleModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleStatusChange}
        title={lifecycleModal.title}
        description={lifecycleModal.description}
        confirmLabel={isUpdatingStatus ? 'Memproses...' : 'Ya, Konfirmasi'}
        cancelLabel="Batal"
        confirmVariant={lifecycleModal.confirmVariant}
        isLoading={isUpdatingStatus}
      />
    </AdminLayout>
  );
}
