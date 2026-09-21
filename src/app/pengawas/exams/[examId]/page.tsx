'use client';

import { useState, useEffect, use } from 'react';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
import Link from 'next/link';
import {
  ShieldCheck,
  DoorOpen,
  Users,
  CheckSquare,
  Clock,
  ArrowLeft,
  FileCheck2,
  Calendar,
  AlertTriangle,
  Radio,
  FileText,
  UserCheck,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ProctorExamDetailPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);

  const [examData, setExamData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExam = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proctor/exams/${examId}`);
      const json = await res.json();
      if (json.success) {
        setExamData(json.data);
        setError(null);
      } else {
        setError(json.error || 'Gagal memuat detail ujian.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExam();
  }, [examId]);

  const exam = examData?.exam;
  const rooms = examData?.assignedRooms || [];
  const isOngoing = exam?.status === 'ACTIVE';

  const startDate = exam?.startTime
    ? new Date(exam.startTime).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '-';
  const startTime = exam?.startTime
    ? new Date(exam.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '-';
  const endTime = exam?.endTime
    ? new Date(exam.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '-';

  return (
    <PengawasLayout
      title={exam?.title || 'Detail Ujian'}
      subtitle="Pusat informasi penugasan ujian dan manajemen ruang pengawasan operasional."
      breadcrumbs={[
        { label: 'Dasbor', href: '/pengawas/dashboard' },
        { label: 'Ujian Aktif', href: '/pengawas/exams' },
        { label: exam?.title || 'Detail Ujian' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExam}
            isLoading={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            Segarkan
          </Button>
          <Link href={`/pengawas/exams/${examId}/monitoring`}>
            <Button
              variant={isOngoing ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={<Radio className="w-3.5 h-3.5" />}
            >
              Live Monitoring
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchExam}>
              Coba Lagi
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="h-44 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              <div className="h-32 rounded-2xl bg-white border border-slate-200 animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            {/* Exam Header Overview Card */}
            <Card className="p-6 bg-white border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="info" size="sm">
                      {exam?.subjectName} ({exam?.subjectCode})
                    </Badge>
                    <Badge
                      variant={isOngoing ? 'success' : exam?.status === 'COMPLETED' ? 'neutral' : 'info'}
                      size="sm"
                      className={isOngoing ? 'animate-pulse' : ''}
                    >
                      {exam?.status}
                    </Badge>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {exam?.title}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/pengawas/exams/${examId}/precheck`}>
                    <Button variant="outline" size="sm" leftIcon={<CheckSquare className="w-3.5 h-3.5" />}>
                      Pra-Pemeriksaan Kesiapan
                    </Button>
                  </Link>
                  <Link href={`/pengawas/exams/${examId}/attendance`}>
                    <Button variant="outline" size="sm" leftIcon={<FileText className="w-3.5 h-3.5" />}>
                      Presensi Peserta
                    </Button>
                  </Link>
                  <Link href={`/pengawas/exams/${examId}/incidents`}>
                    <Button variant="outline" size="sm" leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}>
                      Log Insiden
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Exam Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal</span>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{startDate}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Waktu & Durasi</span>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{startTime} – {endTime} WIB ({exam?.durationMinutes}m)</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ruang Tugas Anda</span>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <DoorOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{rooms.length} Ruang Pengawasan</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Peserta Ruang</span>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>
                      {rooms.reduce((acc: number, r: any) => acc + (r.participantCount || 0), 0)} Siswa
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Assigned Rooms Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DoorOpen className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    RUANG PENGAWASAN YANG DITUGASKAN
                  </h2>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {rooms.length} ruang aktif
                </span>
              </div>

              {rooms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rooms.map((room: any) => (
                    <Card
                      key={room.id}
                      className="p-5 bg-white border-slate-200 hover:border-emerald-300 transition shadow-2xs space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="neutral" size="sm">{room.code}</Badge>
                            <span className="text-xs font-semibold text-slate-500">
                              Sesi {room.sessionNumber || 1}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900">{room.name}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400 block">Kapasitas</span>
                          <span className="text-sm font-bold text-slate-800">{room.capacity} Meja</span>
                        </div>
                      </div>

                      {/* Participant & Co-Proctor Info */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            Peserta Terdaftar:
                          </span>
                          <span className="font-bold text-slate-900">
                            {room.participantCount} Siswa
                          </span>
                        </div>

                        {room.proctors && room.proctors.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Rekan Pengawas Ruang:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {room.proctors.map((proc: any, pIdx: number) => (
                                <span
                                  key={pIdx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-700"
                                >
                                  <UserCheck className="w-3 h-3 text-emerald-600" />
                                  {proc.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Room Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <Link href={`/pengawas/exams/${examId}/precheck?roomId=${room.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full" leftIcon={<CheckSquare className="w-3.5 h-3.5" />}>
                            Pra-Cek
                          </Button>
                        </Link>
                        <Link href={`/pengawas/exams/${examId}/attendance?roomId=${room.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full" leftIcon={<FileText className="w-3.5 h-3.5" />}>
                            Presensi
                          </Button>
                        </Link>
                        <Link href={`/pengawas/exams/${examId}/rooms/${room.id}`} className="flex-1">
                          <Button
                            variant={isOngoing ? 'primary' : 'secondary'}
                            size="sm"
                            className="w-full"
                            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                          >
                            Pantau
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-8 text-center bg-white border-slate-200">
                  <EmptyState
                    title="Tidak ada ruang pengawasan"
                    description="Anda tidak ditugaskan pada ruang mana pun dalam ujian ini."
                  />
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </PengawasLayout>
  );
}
