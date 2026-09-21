'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Layers,
  FileEdit,
  Award,
  Clock,
  ArrowRight,
  PlusCircle,
  FileCheck2,
  Users,
  AlertCircle,
  BookOpen,
  GraduationCap,
  Sparkles,
  RotateCw,
  Activity,
  CheckCheck,
  Lock,
} from 'lucide-react';

export default function GuruDashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profRes, statsRes] = await Promise.all([
        fetch('/api/guru/profile'),
        fetch('/api/guru/dashboard'),
      ]);

      const profJson = await profRes.json();
      const statsJson = await statsRes.json();

      if (profJson.success) {
        setProfile(profJson.data);
      }
      if (statsJson.success) {
        setStats(statsJson.data);
      } else {
        setError(statsJson.error || 'Gagal memuat statistik dashboard guru.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <GuruLayout
      title="Dashboard Pengajar"
      subtitle="Ruang kerja terpadu untuk penyusunan soal, manajemen ujian, dan penilaian siswa"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={loading}
            leftIcon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Segarkan
          </Button>
          <Link href="/guru/question-bank/new">
            <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Buat Soal Baru
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-8 pb-10">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 p-6 md:p-8 text-white shadow-lg border border-primary-500/20">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold tracking-wide text-primary-100">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Portal Pengajar & Asesmen
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Selamat Datang, {profile?.fullName || 'Bapak/Ibu Guru'}
              </h1>
              <p className="text-sm text-primary-100/90 max-w-2xl leading-relaxed">
                {profile?.school?.name ? `${profile.school.name} • ` : ''}
                NIP: {profile?.nip || '-'} • NUPTK: {profile?.nuptk || '-'}
              </p>
              {profile?.assignedSubjects && profile.assignedSubjects.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {profile.assignedSubjects.map((sub: any) => (
                    <span
                      key={sub.id}
                      className="px-2.5 py-1 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-medium text-white"
                    >
                      {sub.name} ({sub.code})
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/guru/exams/new">
                <Button variant="secondary" size="md" leftIcon={<FileCheck2 className="w-4 h-4" />}>
                  Buat Jadwal Ujian
                </Button>
              </Link>
              <Link href="/guru/grading">
                <Button
                  variant="outline"
                  size="md"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/30"
                  leftIcon={<FileEdit className="w-4 h-4" />}
                >
                  Koreksi Essay ({stats?.pendingEssays ?? 0})
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="danger" size="sm" onClick={loadData}>
              Coba Lagi
            </Button>
          </div>
        )}

        {/* 4 Key StatCards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <StatCard
            title="Total Butir Soal"
            value={loading ? '...' : (stats?.questions?.total ?? 0)}
            subtitle={`${stats?.questions?.approved ?? 0} siap pakai, ${stats?.questions?.draft ?? 0} draft`}
            icon={<Layers className="w-5 h-5" />}
            color="primary"
          />
          <StatCard
            title="Paket Ujian"
            value={loading ? '...' : (stats?.exams?.total ?? 0)}
            subtitle={`${stats?.exams?.active ?? 0} aktif, ${stats?.exams?.upcoming ?? 0} terjadwal`}
            icon={<FileCheck2 className="w-5 h-5" />}
            color="success"
          />
          <StatCard
            title="Antrean Koreksi Essay"
            value={loading ? '...' : (stats?.pendingEssays ?? 0)}
            subtitle="Lembar jawaban perlu dinilai"
            icon={<FileEdit className="w-5 h-5" />}
            color={stats?.pendingEssays > 0 ? 'warning' : 'neutral'}
          />
          <StatCard
            title="Siswa Terdaftar"
            value={loading ? '...' : (stats?.totalAssignedStudents ?? 0)}
            subtitle="Di seluruh rombel yang diampu"
            icon={<Users className="w-5 h-5" />}
            color="neutral"
          />
        </div>

        {/* Question Lifecycle Status Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="w-4 h-4 text-primary-600" />
                  Siklus Hidup Bank Soal Anda
                </CardTitle>
                <CardDescription>
                  Distribusi status butir soal yang Anda susun dalam platform
                </CardDescription>
              </div>
              <Link href="/guru/question-bank">
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Buka Bank Soal
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Link
                href="/guru/question-bank?status=DRAFT"
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors text-center"
              >
                <span className="text-xs text-slate-500 font-semibold block">DRAFT</span>
                <span className="text-2xl font-bold text-slate-800 mt-1 block">
                  {loading ? '-' : (stats?.questions?.draft ?? 0)}
                </span>
                <span className="text-[11px] text-slate-400">Penyusunan</span>
              </Link>

              <Link
                href="/guru/question-bank?status=PENDING_REVIEW"
                className="p-3.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition-colors text-center"
              >
                <span className="text-xs text-amber-700 font-semibold block">MENUNGGU REVIEW</span>
                <span className="text-2xl font-bold text-amber-900 mt-1 block">
                  {loading ? '-' : (stats?.questions?.pendingReview ?? 0)}
                </span>
                <span className="text-[11px] text-amber-600">Verifikasi Tim</span>
              </Link>

              <Link
                href="/guru/question-bank?status=APPROVED"
                className="p-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 transition-colors text-center"
              >
                <span className="text-xs text-emerald-700 font-semibold block">APPROVED</span>
                <span className="text-2xl font-bold text-emerald-900 mt-1 block">
                  {loading ? '-' : (stats?.questions?.approved ?? 0)}
                </span>
                <span className="text-[11px] text-emerald-600">Terverifikasi</span>
              </Link>

              <Link
                href="/guru/question-bank?status=PUBLISHED"
                className="p-3.5 rounded-xl bg-blue-50 hover:bg-blue-100/80 border border-blue-200 transition-colors text-center"
              >
                <span className="text-xs text-blue-700 font-semibold block">PUBLISHED</span>
                <span className="text-2xl font-bold text-blue-900 mt-1 block">
                  {loading ? '-' : (stats?.questions?.published ?? 0)}
                </span>
                <span className="text-[11px] text-blue-600">Tersedia Ujian</span>
              </Link>

              <Link
                href="/guru/question-bank?status=LOCKED"
                className="p-3.5 rounded-xl bg-purple-50 hover:bg-purple-100/80 border border-purple-200 transition-colors text-center"
              >
                <span className="text-xs text-purple-700 font-semibold block">LOCKED</span>
                <span className="text-2xl font-bold text-purple-900 mt-1 block">
                  {loading ? '-' : (stats?.questions?.locked ?? 0)}
                </span>
                <span className="text-[11px] text-purple-600">Dipakai di Ujian</span>
              </Link>

              <div className="p-3.5 rounded-xl bg-primary-50/50 border border-primary-200 text-center">
                <span className="text-xs text-primary-700 font-semibold block">TOTAL SOAL</span>
                <span className="text-2xl font-bold text-primary-900 mt-1 block">
                  {loading ? '-' : (stats?.questions?.total ?? 0)}
                </span>
                <span className="text-[11px] text-primary-600">Semua Status</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2-Column Split: Assigned Classes & Recent Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Classes & Subjects */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="w-4 h-4 text-primary-600" />
                  Kelas yang Diampu
                </CardTitle>
                <Link href="/guru/classes" className="text-xs text-primary-600 hover:underline font-semibold">
                  Semua Kelas
                </Link>
              </div>
              <CardDescription>
                Daftar rombongan belajar yang Anda ajar pada tahun ajaran aktif
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {profile?.assignedClasses && profile.assignedClasses.length > 0 ? (
                  profile.assignedClasses.map((c: any) => (
                    <Link
                      key={c.id}
                      href={`/guru/classes/${c.id}`}
                      className="block p-3.5 rounded-xl border border-slate-200 hover:border-primary-300 bg-white hover:bg-primary-50/20 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-slate-800">{c.name}</span>
                        <Badge variant="primary" size="sm">
                          {c.studentCount} Siswa
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 flex items-center justify-between">
                        <span>{c.subjectName}</span>
                        <span>TA {c.academicYear || '-'}</span>
                      </p>
                    </Link>
                  ))
                ) : (
                  <div className="p-6 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                    Belum ada rombongan belajar yang ditugaskan kepada Anda.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Teacher Activities */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="w-4 h-4 text-primary-600" />
                  Aktivitas Pengajar Terbaru
                </CardTitle>
                <Badge variant="neutral" size="sm">Audit Log</Badge>
              </div>
              <CardDescription>
                Riwayat tindakan penyusunan soal, penerbitan ujian, dan penilaian terkini
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {stats?.recentActivities && stats.recentActivities.length > 0 ? (
                  stats.recentActivities.map((act: any, idx: number) => (
                    <div key={idx} className="py-3 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Badge variant="info" size="sm">
                          {act.action}
                        </Badge>
                        <p className="text-xs text-slate-700 mt-1">
                          {act.details?.topic ? `Topik: ${act.details.topic} ` : ''}
                          {act.details?.title ? `Judul: ${act.details.title} ` : ''}
                          {act.details?.updatedFields ? `Field diubah: ${act.details.updatedFields.join(', ')} ` : ''}
                          {act.details?.action ? `Aksi: ${act.details.action}` : ''}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(act.createdAt).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Belum ada catatan aktivitas tercatat.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </GuruLayout>
  );
}
