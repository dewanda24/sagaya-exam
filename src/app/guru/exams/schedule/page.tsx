'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import {
  Calendar,
  Clock,
  FileCheck2,
  Users,
  ArrowRight,
  RotateCw,
  PlusCircle,
  AlertCircle,
  Eye,
} from 'lucide-react';

export default function GuruExamSchedulePage() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/guru/exams?limit=50');
      const json = await res.json();
      if (json.success) {
        setExams(json.exams || []);
      } else {
        setError(json.error || 'Gagal memuat jadwal ujian.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const now = new Date().getTime();

  const activeExams = exams.filter(
    (e) => e.status === 'ACTIVE' || (new Date(e.startTime).getTime() <= now && new Date(e.endTime).getTime() >= now)
  );

  const upcomingExams = exams.filter(
    (e) => (e.status === 'SCHEDULED' || e.status === 'DRAFT') && new Date(e.startTime).getTime() > now
  );

  const pastExams = exams.filter(
    (e) => e.status === 'COMPLETED' || new Date(e.endTime).getTime() < now
  );

  return (
    <GuruLayout
      title="Kalender Jadwal Ujian"
      subtitle="Agenda linimasa pelaksanaan asesmen mata pelajaran di lingkungan satuan pendidikan"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Ujian', href: '/guru/exams' },
        { label: 'Jadwal Ujian' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSchedule}
            isLoading={loading}
            leftIcon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Segarkan
          </Button>
          <Link href="/guru/exams/new">
            <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Buat Jadwal Baru
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-8 pb-12">
        {error && (
          <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-danger-600" />
              <span>{error}</span>
            </div>
            <Button variant="danger" size="sm" onClick={loadSchedule}>
              Coba Lagi
            </Button>
          </div>
        )}

        {/* 1. UJIAN SEDANG BERLANGSUNG */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="text-base font-bold text-slate-900">Sedang Berlangsung (Aktif Sekarang)</h2>
            <Badge variant="success" size="sm">{activeExams.length}</Badge>
          </div>

          {activeExams.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-xs text-slate-500">
                Tidak ada paket ujian yang sedang aktif saat ini.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeExams.map((e) => (
                <Card key={e.id} className="border-emerald-200 bg-emerald-50/20">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        {e.subjectName}
                      </span>
                      <StatusBadge status={e.status || 'ACTIVE'} size="sm" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">{e.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {e.durationMinutes} Menit
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {e.participantCount || 0} Peserta
                      </span>
                    </div>
                    <div className="pt-3 border-t border-emerald-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        Batas: {new Date(e.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <Link href={`/guru/monitoring?examId=${e.id}`}>
                        <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                          Pantau Live
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 2. UJIAN AKAN DATANG */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-600" />
            <h2 className="text-base font-bold text-slate-900">Terjadwal Mendatang</h2>
            <Badge variant="primary" size="sm">{upcomingExams.length}</Badge>
          </div>

          {upcomingExams.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-xs text-slate-500">
                Belum ada jadwal ujian mendatang yang terdaftar.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingExams.map((e) => (
                <Card key={e.id} className="hover:border-primary-300 transition-all">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {e.subjectName}
                      </span>
                      <StatusBadge status={e.status || 'SCHEDULED'} size="sm" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-2">{e.title}</h3>
                    <div className="text-xs text-slate-500 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {new Date(e.startTime).toLocaleDateString('id-ID', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {new Date(e.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} -{' '}
                          {new Date(e.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400">{e.durationMinutes} menit</span>
                      <Link href={`/guru/exams/${e.id}`}>
                        <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                          Detail
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 3. UJIAN SELESAI */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h2 className="text-base font-bold text-slate-700">Riwayat Ujian Selesai</h2>
            <Badge variant="neutral" size="sm">{pastExams.length}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pastExams.slice(0, 6).map((e) => (
              <Card key={e.id} className="opacity-80 hover:opacity-100 transition-opacity">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">{e.subjectName}</span>
                    <StatusBadge status="COMPLETED" size="sm" />
                  </div>
                  <h4 className="font-semibold text-slate-800 text-sm line-clamp-1">{e.title}</h4>
                  <div className="pt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      {new Date(e.endTime).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                    <Link href={`/guru/exams/${e.id}`}>
                      <Button variant="ghost" size="sm">
                        Lihat Naskah
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </GuruLayout>
  );
}
