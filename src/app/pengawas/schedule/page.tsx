'use client';

import { useState, useEffect, useCallback } from 'react';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  DoorOpen,
  Users,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  FileText,
  RotateCcw,
  CheckSquare,
  Radio,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ProctorSchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchFilter) params.set('search', searchFilter);

      const res = await fetch(`/api/proctor/schedule?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setSchedules(json.data || []);
      }
    } catch (err) {
      console.error('Gagal mengambil jadwal pengawasan:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter, searchFilter]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const filtered = schedules.filter((s) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      s.examTitle?.toLowerCase().includes(q) ||
      s.subjectName?.toLowerCase().includes(q) ||
      s.roomName?.toLowerCase().includes(q) ||
      s.roomCode?.toLowerCase().includes(q)
    );
  });

  return (
    <PengawasLayout
      title="Jadwal Pengawasan Ujian"
      subtitle="Daftar penugasan pengawasan ruang ujian yang ditugaskan secara sah kepada Anda."
      breadcrumbs={[
        { label: 'Dasbor', href: '/pengawas/dashboard' },
        { label: 'Jadwal Ujian' },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchSchedule()}
          isLoading={loading}
          leftIcon={<RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        >
          Muat Ulang
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Filter Toolbar */}
        <Card className="p-4 bg-white border-slate-200 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Cari Ujian / Ruang</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Nama ujian atau ruang..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Filter Tanggal</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Status Ujian</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">ACTIVE (Sedang Berlangsung)</option>
                <option value="SCHEDULED">SCHEDULED (Terjadwal)</option>
                <option value="COMPLETED">COMPLETED (Selesai)</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFilter('');
                  setStatusFilter('ALL');
                  setSearchFilter('');
                }}
                className="w-full"
              >
                Reset Filter
              </Button>
            </div>
          </div>
        </Card>

        {/* Schedule Cards List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-white border border-slate-200" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((item, idx) => {
              const startDate = new Date(item.startTime).toLocaleDateString('id-ID', {
                weekday: 'long',
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
              const isOngoing = item.examStatus === 'ACTIVE';

              return (
                <Card
                  key={idx}
                  className="p-5 bg-white border-slate-200 hover:border-emerald-300 transition shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info" size="sm">
                        {item.subjectName} ({item.subjectCode || 'MAPEL'})
                      </Badge>
                      <Badge
                        variant={isOngoing ? 'success' : item.examStatus === 'COMPLETED' ? 'neutral' : 'info'}
                        size="sm"
                        className={isOngoing ? 'animate-pulse' : ''}
                      >
                        {item.examStatus}
                      </Badge>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{item.examTitle}</h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        {startDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        {startTime} – {endTime} WIB ({item.durationMinutes} Menit)
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <DoorOpen className="w-3.5 h-3.5 text-blue-600" />
                        {item.roomName} ({item.roomCode})
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        {item.studentCount} Peserta (Sesi {item.sessionNumber})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
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
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center bg-white border-slate-200">
            <EmptyState
              title="Tidak ada jadwal yang sesuai kriteria"
              description="Coba ubah filter tanggal atau kata kunci pencarian Anda untuk menemukan jadwal pengawasan."
              actionLabel="Reset Seluruh Filter"
              onAction={() => {
                setDateFilter('');
                setStatusFilter('ALL');
                setSearchFilter('');
              }}
            />
          </Card>
        )}
      </div>
    </PengawasLayout>
  );
}
