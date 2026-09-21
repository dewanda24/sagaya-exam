'use client';

import { useState, useEffect } from 'react';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
import Link from 'next/link';
import {
  ShieldCheck,
  Calendar,
  Clock,
  DoorOpen,
  ArrowRight,
  BookOpen,
  RefreshCw,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ProctorExamsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proctor/exams');
      const json = await res.json();
      if (json.success) {
        setExams(json.data || []);
        setError(null);
      } else {
        setError(json.error || 'Gagal memuat daftar ujian.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  return (
    <PengawasLayout
      title="Ujian Ditugaskan"
      subtitle="Pilih ujian dan ruang pengawasan Anda untuk memulai pemantauan atau verifikasi pra-ujian."
      breadcrumbs={[
        { label: 'Dasbor', href: '/pengawas/dashboard' },
        { label: 'Ujian Aktif' },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchExams()}
          isLoading={loading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Segarkan
        </Button>
      }
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchExams()}>
              Coba Lagi
            </Button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-white border border-slate-200" />
            ))}
          </div>
        ) : exams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((item) => {
              const startDate = new Date(item.startTime).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
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
                  key={item.id}
                  className="p-5 bg-white border-slate-200 hover:border-emerald-300 transition shadow-2xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="info" size="sm">
                        {item.subjectName || 'Mata Pelajaran'}
                      </Badge>
                      <Badge
                        variant={isOngoing ? 'success' : item.status === 'COMPLETED' ? 'neutral' : 'info'}
                        size="sm"
                        className={isOngoing ? 'animate-pulse' : ''}
                      >
                        {item.status}
                      </Badge>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 line-clamp-2">{item.title}</h3>

                    <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{startDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>{startTime} – {endTime} WIB ({item.durationMinutes}m)</span>
                      </div>
                      <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                        <DoorOpen className="w-3.5 h-3.5" />
                        <span>{item.roomCount} Ruang Ditugaskan</span>
                      </div>
                    </div>
                  </div>

                  <Link href={`/pengawas/exams/${item.id}`}>
                    <Button
                      variant={isOngoing ? 'primary' : 'secondary'}
                      size="sm"
                      className="w-full"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Buka Ruang Pengawasan
                    </Button>
                  </Link>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center bg-white border-slate-200">
            <EmptyState
              title="Belum ada ujian yang ditugaskan"
              description="Tidak ada data penugasan ujian untuk akun Anda. Hubungi Administrator Sekolah jika Anda seharusnya ditugaskan pada ujian tertentu."
              actionLabel="Periksa Jadwal Pengawasan"
              onAction={() => (window.location.href = '/pengawas/schedule')}
            />
          </Card>
        )}
      </div>
    </PengawasLayout>
  );
}
