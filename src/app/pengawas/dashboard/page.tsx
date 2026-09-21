'use client';

import { useState, useEffect } from 'react';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
import Link from 'next/link';
import {
  ShieldCheck,
  Calendar,
  Clock,
  DoorOpen,
  Users,
  AlertTriangle,
  WifiOff,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  FileText,
  Radio,
  RefreshCw,
  Eye,
  CheckSquare,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ProctorDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/proctor/dashboard');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error || 'Gagal memuat dasbor pengawas.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <PengawasLayout
      title="Pusat Kendali Pengawasan"
      subtitle="Pemantauan ruang ujian, kesiapan operasional, dan presensi peserta real-time."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboard(true)}
            isLoading={refreshing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
          >
            Segarkan
          </Button>
          <Link href="/pengawas/schedule">
            <Button variant="primary" size="sm" leftIcon={<Calendar className="w-3.5 h-3.5" />}>
              Jadwal Pengawasan
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadDashboard(true)}>
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
            <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          </div>
        ) : (
          <>
            {/* KPI Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Ruang Tugas */}
              <Card className="p-4 bg-white border-slate-200 hover:border-emerald-300 transition shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Ruang Tugas</span>
                  <DoorOpen className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {data?.stats?.assignedRoomsCount ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Ruang ujian aktif</div>
              </Card>

              {/* Total Siswa */}
              <Card className="p-4 bg-white border-slate-200 hover:border-blue-300 transition shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Peserta</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {data?.stats?.totalParticipants ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Terdaftar di ruang</div>
              </Card>

              {/* Aktif Ujian */}
              <Card className="p-4 bg-white border-emerald-200/80 hover:border-emerald-400 transition shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Aktif Mengerjakan</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="text-2xl font-black text-emerald-700">
                  {data?.stats?.activeParticipants ?? 0}
                </div>
                <div className="text-[11px] text-emerald-600 mt-1">Sesi ujian aktif</div>
              </Card>

              {/* Perlu Perhatian */}
              <Card className="p-4 bg-white border-amber-200/80 hover:border-amber-400 transition shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Bermasalah</span>
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-700">
                  {data?.stats?.problematicParticipants ?? 0}
                </div>
                <div className="text-[11px] text-amber-600 mt-1">Pelanggaran / anomali</div>
              </Card>

              {/* Terputus */}
              <Card className="p-4 bg-white border-rose-200/80 hover:border-rose-400 transition shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Koneksi Putus</span>
                  <WifiOff className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-2xl font-black text-rose-700">
                  {data?.stats?.disconnectedParticipants ?? 0}
                </div>
                <div className="text-[11px] text-rose-600 mt-1">Detak jantung henti</div>
              </Card>

              {/* Sesi Hari Ini */}
              <Card className="p-4 bg-white border-slate-200 hover:border-sky-300 transition shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Sesi Hari Ini</span>
                  <Clock className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {data?.stats?.todaySchedulesCount ?? 0}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Jadwal pengawasan</div>
              </Card>
            </div>

            {/* Active Exam Spotlight (Banner if any exam is ongoing) */}
            {data?.ongoingExams && data.ongoingExams.length > 0 && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-900 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-emerald-700/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1.5">
                      <Radio className="w-3 h-3 text-emerald-300 animate-pulse" />
                      UJIAN SEDANG BERJALAN
                    </span>
                    <span className="text-xs text-emerald-200 font-medium">
                      {data.ongoingExams.length} sesi aktif
                    </span>
                  </div>
                  <h2 className="text-lg font-bold tracking-tight">
                    {data.ongoingExams[0].examTitle} ({data.ongoingExams[0].roomName})
                  </h2>
                  <p className="text-xs text-emerald-100/80">
                    Siswa sedang mengerjakan soal di ruang ini. Segera masuk ke monitoring langsung untuk pengawasan ketat.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link href={`/pengawas/exams/${data.ongoingExams[0].examId}/rooms/${data.ongoingExams[0].roomId}/attendance`}>
                    <Button variant="outline" size="sm" className="bg-white/10 text-white hover:bg-white/20 border-white/20">
                      Presensi
                    </Button>
                  </Link>
                  <Link href={`/pengawas/exams/${data.ongoingExams[0].examId}/monitoring`}>
                    <Button variant="primary" size="sm" className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold">
                      Buka Live Monitoring
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Main Content Grid: Jadwal Hari Ini & Insiden */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Jadwal Pengawasan Hari Ini */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      JADWAL PENGAWASAN HARI INI
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {new Date().toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {data?.todaySchedules && data.todaySchedules.length > 0 ? (
                  <div className="space-y-3">
                    {data.todaySchedules.map((item: any, idx: number) => {
                      const startTime = new Date(item.startTime).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const endTime = new Date(item.endTime).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const isOngoing = item.status === 'ACTIVE';

                      return (
                        <Card
                          key={idx}
                          className="p-5 bg-white border-slate-200 hover:border-emerald-300 transition shadow-2xs space-y-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="info" size="sm">
                                  {item.subjectName}
                                </Badge>
                                <Badge
                                  variant={isOngoing ? 'success' : 'neutral'}
                                  size="sm"
                                  className={isOngoing ? 'animate-pulse' : ''}
                                >
                                  {item.status}
                                </Badge>
                              </div>
                              <h3 className="text-base font-bold text-slate-900">{item.examTitle}</h3>
                            </div>
                            <div className="text-left sm:text-right">
                              <div className="text-sm font-bold text-slate-800">
                                {startTime} – {endTime} WIB
                              </div>
                              <div className="text-xs text-slate-500">{item.durationMinutes} Menit</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3 text-xs text-slate-600">
                              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60 font-medium">
                                <DoorOpen className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{item.roomName} ({item.roomCode})</span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60 font-medium">
                                <Users className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Sesi {item.sessionNumber}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Link href={`/pengawas/exams/${item.examId}/precheck`}>
                                <Button variant="outline" size="sm" leftIcon={<CheckSquare className="w-3.5 h-3.5" />}>
                                  Pra-Cek
                                </Button>
                              </Link>
                              <Link href={`/pengawas/exams/${item.examId}/attendance`}>
                                <Button variant="outline" size="sm" leftIcon={<FileText className="w-3.5 h-3.5" />}>
                                  Presensi
                                </Button>
                              </Link>
                              <Link href={`/pengawas/exams/${item.examId}/monitoring`}>
                                <Button
                                  variant={isOngoing ? 'primary' : 'secondary'}
                                  size="sm"
                                  leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                                >
                                  Monitoring
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="p-8 bg-white border-slate-200 text-center">
                    <EmptyState
                      title="Tidak ada jadwal pengawasan"
                      description="Tidak ada penugasan ruang ujian untuk akun Anda pada hari ini. Anda dapat memeriksa jadwal ujian mendatang pada menu Jadwal."
                      actionLabel="Lihat Seluruh Jadwal"
                      onAction={() => (window.location.href = '/pengawas/schedule')}
                    />
                  </Card>
                )}
              </div>

              {/* Right Col: Pelanggaran & Insiden Terbuka */}
              <div className="space-y-6">
                {/* Pelanggaran Terkini */}
                <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Pelanggaran Terkini
                    </div>
                    <Badge variant="warning" size="sm">Real-time</Badge>
                  </div>

                  {data?.recentViolations && data.recentViolations.length > 0 ? (
                    <div className="space-y-2.5">
                      {data.recentViolations.map((v: any) => {
                        const sevVariant =
                          v.severity === 'CRITICAL'
                            ? 'danger'
                            : v.severity === 'WARNING'
                            ? 'warning'
                            : 'info';

                        return (
                          <div
                            key={v.id}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800">{v.studentName}</span>
                              <Badge variant={sevVariant} size="sm">
                                {v.eventType}
                              </Badge>
                            </div>
                            <div className="text-slate-600 text-[11px]">{v.description || 'Deteksi tab/browser.'}</div>
                            <div className="text-slate-400 text-[10px] flex items-center justify-between pt-1">
                              <span>{v.roomName}</span>
                              <span>{new Date(v.createdAt).toLocaleTimeString('id-ID')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-400 font-medium">
                      Belum ada laporan pelanggaran tercatat.
                    </div>
                  )}
                </Card>

                {/* Insiden Terbuka */}
                <Card className="p-5 bg-white border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      Insiden Belum Selesai
                    </div>
                    <Link
                      href="/pengawas/incidents"
                      className="text-xs text-emerald-700 font-semibold hover:underline"
                    >
                      Pusat Insiden →
                    </Link>
                  </div>

                  {data?.openIncidents && data.openIncidents.length > 0 ? (
                    <div className="space-y-2.5">
                      {data.openIncidents.map((inc: any) => (
                        <div
                          key={inc.id}
                          className="p-3 rounded-xl bg-rose-50/50 border border-rose-200/80 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-900">{inc.category}</span>
                            <Badge variant="danger" size="sm">{inc.severity}</Badge>
                          </div>
                          <p className="text-slate-700 text-[11px]">{inc.description}</p>
                          <div className="text-slate-500 text-[10px] flex items-center justify-between pt-1">
                            <span>{inc.roomName}</span>
                            <span>{new Date(inc.createdAt).toLocaleTimeString('id-ID')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-slate-400 font-medium">
                      Seluruh insiden telah terselesaikan.
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </PengawasLayout>
  );
}
