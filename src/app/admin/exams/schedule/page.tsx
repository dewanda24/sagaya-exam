'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import {
  Calendar,
  Clock,
  DoorOpen,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ArrowRight,
  Filter,
  FileCheck2,
  Users,
} from 'lucide-react';

interface ScheduleExam {
  id: string;
  title: string;
  status: string;
  subjectName: string;
  className: string;
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
  participantCount: number;
}

interface ScheduleRoom {
  id: string;
  name: string;
  code: string;
  capacity: number;
}

export default function ExamSchedulePage() {
  const [exams, setExams] = useState<ScheduleExam[]>([]);
  const [rooms, setRooms] = useState<ScheduleRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/exams').then((r) => r.json()),
      fetch('/api/admin/exam-rooms').then((r) => r.json()),
    ])
      .then(([examsRes, roomsRes]) => {
        if (examsRes.success) setExams(examsRes.data.exams || []);
        if (roomsRes.success) setRooms(roomsRes.data || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredExams = selectedStatus
    ? exams.filter((e) => e.status === selectedStatus)
    : exams;

  const columns: ColumnDef<ScheduleExam>[] = [
    {
      key: 'title',
      header: 'Nama Paket Ujian',
      cell: (row) => (
        <div>
          <Link
            href={`/admin/exams/${row.id}`}
            className="font-bold text-slate-900 text-xs hover:text-blue-600 transition block"
          >
            {row.title}
          </Link>
          <span className="text-[10px] text-slate-500 font-medium">
            Mapel: {row.subjectName} • Rombel: {row.className}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'schedule',
      header: 'Waktu Pelaksanaan',
      cell: (row) => (
        <div className="text-xs">
          <div className="font-semibold text-slate-800 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{row.durationMinutes} Menit</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {row.startTime ? new Date(row.startTime).toLocaleString('id-ID') : 'Jadwal Fleksibel'}
          </span>
        </div>
      ),
    },
    {
      key: 'participants',
      header: 'Peserta',
      cell: (row) => (
        <span className="inline-flex items-center gap-1 font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
          <Users className="w-3 h-3 text-slate-500" />
          {row.participantCount || 0} Siswa
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status Sesi',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
      sortable: true,
    },
    {
      key: 'actions',
      header: <span className="text-right block">Aksi</span>,
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status === 'ACTIVE' ? (
            <Link href={`/admin/monitoring/${row.id}`}>
              <Button variant="primary" size="sm">
                Monitoring Live
              </Button>
            </Link>
          ) : (
            <Link href={`/admin/exams/${row.id}`}>
              <Button variant="outline" size="sm">
                Detail Sesi
              </Button>
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Jadwal Pelaksanaan Ujian"
      subtitle="Kalender dan matriks jadwal sesi ujian di laboratorium sekolah"
      breadcrumbs={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Ujian', href: '/admin/exams' },
        { label: 'Jadwal' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/admin/proctors/assignments">
            <Button variant="outline" size="sm" leftIcon={<UserCheck className="w-4 h-4 text-blue-600" />}>
              Penugasan Pengawas
            </Button>
          </Link>
          <Link href="/admin/exams">
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Jadwalkan Ujian
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filter bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">Filter Status Ujian:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-semibold text-slate-700"
            >
              <option value="">Semua Status ({exams.length})</option>
              <option value="ACTIVE">ACTIVE (Sedang Berjalan)</option>
              <option value="SCHEDULED">SCHEDULED (Terjadwal)</option>
              <option value="DRAFT">DRAFT (Konsep)</option>
              <option value="COMPLETED">COMPLETED (Selesai)</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span>Tersedia <strong>{rooms.length}</strong> Ruang Lab Komputer</span>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
          <DataTable
            data={filteredExams}
            columns={columns}
            isLoading={loading}
            emptyTitle="Belum Ada Jadwal Ujian"
            emptyDescription="Tidak ada agenda ujian yang terjadwal. Silakan jadwalkan paket ujian baru."
            pageSize={10}
            itemName="jadwal ujian"
          />
        </div>
      </div>
    </AdminLayout>
  );
}
