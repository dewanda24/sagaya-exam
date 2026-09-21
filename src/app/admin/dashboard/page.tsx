'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardHeader, CardTitle, CardContent, StatCard } from '@/components/ui/Card';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Users,
  GraduationCap,
  Layers,
  Calendar,
  Award,
  ShieldCheck,
  Building2,
  UserCheck,
  Radio,
  Clock,
  ArrowRight,
  Activity,
  AlertTriangle,
  PlayCircle,
  FileText,
  DoorOpen,
  CheckCircle2,
  Search,
} from 'lucide-react';

interface ExamItem {
  id: string;
  title: string;
  status: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  subjectName: string;
  className: string;
  teacherName: string;
  participantCount: number;
}

interface ActivityItem {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: any;
  createdAt: string;
  actorName: string;
}

interface DashboardMetrics {
  totalStudents: number;
  totalClasses: number;
  totalQuestions: number;
  totalTeachers: number;
  totalProctors: number;
  totalExams: number;
  totalRooms: number;
  activeExamsCount: number;
  upcomingExamsCount: number;
  pendingReviewCount: number;
  activeSchoolInfo?: {
    id: string;
    name: string;
    code: string;
    level: string;
    logoUrl?: string;
    principalName?: string;
    quotaStudents?: number;
    quotaExams?: number;
    isActive?: boolean;
  } | null;
  liveSessions?: {
    inProgress: number;
    submitted: number;
    violations: number;
  };
  activeExam: {
    id: string;
    title: string;
    subjectName: string;
    schoolName: string;
    status: string;
    durationMinutes: number;
    totalQuestions: number;
    participantCount: number;
  } | null;
  todayExams: ExamItem[];
  recentActivities: ActivityItem[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMetrics(data.data);
        }
      })
      .catch((err) => console.error('Gagal memuat dashboard metrics:', err))
      .finally(() => setLoading(false));
  }, []);

  const school = metrics?.activeSchoolInfo;
  const activeExam = metrics?.activeExam;
  const liveSessions = metrics?.liveSessions;

  const formatActivityAction = (action: string) => {
    switch (action) {
      case 'USER_CREATED':
      case 'USER_REGISTERED':
        return 'Pengguna baru didaftarkan';
      case 'STUDENTS_IMPORTED':
      case 'STUDENT_IMPORTED':
        return 'Import data siswa massal';
      case 'TEACHER_ASSIGNED':
      case 'TEACHER_CREATED':
        return 'Penugasan guru ditambahkan';
      case 'EXAM_CREATED':
        return 'Paket ujian baru dibuat';
      case 'EXAM_SCHEDULED':
      case 'SCHEDULE_CREATED':
        return 'Jadwal sesi ujian ditetapkan';
      case 'PROCTOR_ASSIGNED':
        return 'Pengawas ruang ditugaskan';
      case 'EXAM_PUBLISHED':
      case 'RESULTS_PUBLISHED':
        return 'Hasil kelulusan dipublikasikan';
      case 'ACADEMIC_YEAR_CREATED':
        return 'Tahun ajaran baru dikonfigurasi';
      case 'SEMESTER_STATUS_UPDATED':
        return 'Status semester diperbarui';
      default:
        return action.replace(/_/g, ' ').toLowerCase();
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'active';
      case 'SCHEDULED':
      case 'READY':
        return 'scheduled';
      case 'COMPLETED':
      case 'LOCKED':
        return 'completed';
      case 'CANCELLED':
        return 'cancelled';
      case 'DRAFT':
      default:
        return 'draft';
    }
  };

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="Ringkasan aktivitas ujian dan data sekolah"
      breadcrumbs={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Dashboard' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/admin/exams">
            <Button variant="primary" size="sm" leftIcon={<Calendar className="w-4 h-4" />}>
              Kelola Ujian
            </Button>
          </Link>
          <Link href="/admin/monitoring">
            <Button variant="outline" size="sm" leftIcon={<Radio className="w-4 h-4 text-emerald-600" />}>
              Live Monitoring
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* =========================================================
            SCHOOL INSTITUTION BANNER
            ========================================================= */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white border border-slate-800 shadow-md relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-2 flex items-center justify-center shrink-0 shadow-inner">
                {school?.logoUrl ? (
                  <img
                    src={school.logoUrl}
                    alt="Logo Sekolah"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Building2 className="w-7 h-7 text-blue-300" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {school?.name || 'Satuan Pendidikan'}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                    {school?.level || 'SMA'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Terverifikasi
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 font-medium">
                  NPSN: <span className="font-mono text-white">{school?.code || '—'}</span>
                  {school?.principalName && ` • Kepala Sekolah: ${school.principalName}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Link href="/admin/school">
                <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                  Profil Sekolah
                </Button>
              </Link>
              <Link href="/admin/students">
                <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                  Data Siswa
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* =========================================================
            KPI METRICS (8 REQUIRED ACTUAL METRICS)
            ========================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            title="Total Siswa"
            value={loading ? '—' : metrics?.totalStudents ?? '—'}
            subtitle="Peserta terdaftar"
            icon={<Users className="w-5 h-5" />}
            color="primary"
          />
          <StatCard
            title="Total Guru"
            value={loading ? '—' : metrics?.totalTeachers ?? '—'}
            subtitle="Tenaga pendidik"
            icon={<UserCheck className="w-5 h-5" />}
            color="primary"
          />
          <StatCard
            title="Total Pengawas"
            value={loading ? '—' : metrics?.totalProctors ?? '—'}
            subtitle="Petugas ruang"
            icon={<ShieldCheck className="w-5 h-5" />}
            color="warning"
          />
          <StatCard
            title="Total Kelas"
            value={loading ? '—' : metrics?.totalClasses ?? '—'}
            subtitle="Rombongan belajar"
            icon={<Layers className="w-5 h-5" />}
            color="neutral"
          />
          <StatCard
            title="Ujian Aktif"
            value={loading ? '—' : metrics?.activeExamsCount ?? '—'}
            subtitle="Sedang berjalan"
            icon={<Radio className="w-5 h-5" />}
            color="success"
          />
          <StatCard
            title="Ujian Mendatang"
            value={loading ? '—' : metrics?.upcomingExamsCount ?? '—'}
            subtitle="Terjadwal & siap"
            icon={<Calendar className="w-5 h-5" />}
            color="primary"
          />
          <StatCard
            title="Active Sessions"
            value={loading ? '—' : liveSessions?.inProgress ?? '—'}
            subtitle="Siswa di ujian"
            icon={<Activity className="w-5 h-5" />}
            color="warning"
          />
          <StatCard
            title="Hasil Menunggu Review"
            value={loading ? '—' : metrics?.pendingReviewCount ?? '—'}
            subtitle="Jawaban essay/koreksi"
            icon={<Award className="w-5 h-5" />}
            color="danger"
          />
        </div>

        {/* =========================================================
            UJIAN BERLANGSUNG (ACTIVE EXAM MONITORING RADAR)
            ========================================================= */}
        {activeExam ? (
          <Card className="border-emerald-200 bg-emerald-50/30 overflow-hidden shadow-sm">
            <CardHeader className="bg-emerald-50/60 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0 animate-pulse">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Ujian Berlangsung
                    </span>
                    <StatusBadge status="ACTIVE" size="sm" />
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {activeExam.title}
                  </h3>
                </div>
              </div>

              <Link href={`/admin/monitoring/${activeExam.id}`}>
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Buka Monitoring
                </Button>
              </Link>
            </CardHeader>

            <CardContent className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Total Peserta</div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {activeExam.participantCount || 0}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-bold text-emerald-600 uppercase">Sedang Mengerjakan</div>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    {liveSessions?.inProgress || 0}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-bold text-blue-600 uppercase">Telah Selesai</div>
                  <div className="text-xl font-black text-blue-700 mt-1">
                    {liveSessions?.submitted || 0}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Belum Mulai</div>
                  <div className="text-xl font-black text-slate-700 mt-1">
                    {Math.max(
                      0,
                      (activeExam.participantCount || 0) -
                        ((liveSessions?.inProgress || 0) + (liveSessions?.submitted || 0))
                    )}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-bold text-rose-600 uppercase">Pelanggaran Tab</div>
                  <div className="text-xl font-black text-rose-700 mt-1">
                    {liveSessions?.violations || 0}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[11px] font-bold text-indigo-600 uppercase">Durasi</div>
                  <div className="text-xl font-black text-indigo-700 mt-1">
                    {activeExam.durationMinutes} mnt
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* =========================================================
            TWO COLUMN WORKSPACE: UJIAN HARI INI & AKTIVITAS TERBARU
            ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: UJIAN HARI INI */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between border-b border-slate-100 py-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-base font-black text-slate-900">
                    Ujian Hari Ini & Sesi Terkini
                  </CardTitle>
                </div>
                <Link
                  href="/admin/exams"
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  Lihat Semua Ujian <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>

              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Memuat daftar ujian...
                  </div>
                ) : !metrics?.todayExams || metrics.todayExams.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700 text-sm">Tidak Ada Jadwal Ujian Hari Ini</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Seluruh agenda ujian sekolah dapat dijadwalkan melalui menu Manajemen Ujian.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {metrics.todayExams.map((exam) => (
                      <div
                        key={exam.id}
                        className="p-4 sm:p-5 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {exam.title}
                            </span>
                            <StatusBadge status={exam.status} size="sm" />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                            <span>Mapel: <strong className="text-slate-700">{exam.subjectName}</strong></span>
                            <span>•</span>
                            <span>Kelas: <strong className="text-slate-700">{exam.className}</strong></span>
                            <span>•</span>
                            <span>{exam.participantCount} Peserta</span>
                            <span>•</span>
                            <span>{exam.durationMinutes} Menit</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {exam.status === 'ACTIVE' ? (
                            <Link href={`/admin/monitoring/${exam.id}`}>
                              <Button variant="primary" size="sm">
                                Pantau Live
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/admin/exams/${exam.id}`}>
                              <Button variant="outline" size="sm">
                                Detail Ujian
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: AKTIVITAS TERBARU (REAL AUDIT/ACTIVITY STREAM) */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex items-center justify-between border-b border-slate-100 py-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  <CardTitle className="text-base font-black text-slate-900">
                    Aktivitas Terbaru
                  </CardTitle>
                </div>
                <Link
                  href="/admin/audit"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  Log Audit <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>

              <CardContent className="p-4">
                {loading ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Memuat log aktivitas...
                  </div>
                ) : !metrics?.recentActivities || metrics.recentActivities.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Activity className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700 text-xs">Belum Ada Aktivitas</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tindakan administratif sekolah akan tercatat di sini secara otomatis.
                    </p>
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {metrics.recentActivities.map((act) => (
                      <div key={act.id} className="relative">
                        <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-blue-600 border-2 border-white ring-2 ring-blue-100" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {formatActivityAction(act.action)}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                            <span className="font-semibold text-slate-600">{act.actorName}</span>
                            <span>•</span>
                            <span>
                              {act.createdAt
                                ? new Date(act.createdAt).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Baru saja'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
