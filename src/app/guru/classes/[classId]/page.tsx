'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import {
  GraduationCap,
  Users,
  Search,
  ArrowLeft,
  ShieldCheck,
  RotateCw,
} from 'lucide-react';

interface StudentRoster {
  id: string;
  fullName: string;
  nis: string;
  nisn: string;
  gender: string;
  status: string;
  className?: string;
}

export default function GuruClassDetailPage() {
  const params = useParams();
  const classId = params?.classId as string;

  const [students, setStudents] = useState<StudentRoster[]>([]);
  const [total, setTotal] = useState(0);
  const [className, setClassName] = useState('Kelas');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStudents = async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/guru/classes/${classId}${q}`);
      const json = await res.json();
      if (json.success) {
        setStudents(json.students || []);
        setTotal(json.total || 0);
        if (json.students && json.students.length > 0 && json.students[0].className) {
          setClassName(json.students[0].className);
        }
      } else {
        setError(json.error || 'Gagal memuat data siswa.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [classId]);

  const columns: ColumnDef<StudentRoster>[] = [
    {
      key: 'index',
      header: 'No',
      cell: (_, idx) => <span className="text-xs font-mono text-slate-400">{idx + 1}</span>,
      className: 'w-12 text-center',
    },
    {
      key: 'fullName',
      header: 'Nama Lengkap Siswa',
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center text-xs font-bold border border-primary-100">
            {row.gender === 'P' ? 'P' : 'L'}
          </div>
          <span className="font-semibold text-slate-900">{row.fullName}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'nis',
      header: 'NIS',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.nis || '—'}</span>,
      sortable: true,
    },
    {
      key: 'nisn',
      header: 'NISN',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.nisn || '—'}</span>,
      sortable: true,
    },
    {
      key: 'gender',
      header: 'Jenis Kelamin',
      cell: (row) => (
        <span className="text-xs text-slate-600">
          {row.gender === 'L' ? 'Laki-laki' : row.gender === 'P' ? 'Perempuan' : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status Siswa',
      cell: (row) => (
        <StatusBadge
          status={row.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'}
          size="sm"
        />
      ),
      sortable: true,
    },
  ];

  return (
    <GuruLayout
      title={`Rombel ${className}`}
      subtitle="Daftar peserta didik aktif dalam rombongan belajar (Tampilan Khusus Pengajar • Read-Only)"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Kelas & Siswa', href: '/guru/classes' },
        { label: className },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Mode Terenkripsi & Read-Only
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadStudents}
            isLoading={loading}
            leftIcon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Segarkan
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-12">
        {/* Search & Stats Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Cari nama, NIS, atau NISN siswa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadStudents()}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="text-xs text-slate-500 self-end sm:self-center">
            Total <span className="font-bold text-slate-800">{total}</span> siswa terdaftar
          </div>
        </div>

        {/* DataTable */}
        <DataTable
          data={students}
          columns={columns}
          isLoading={loading}
          error={error}
          onRetry={loadStudents}
          emptyTitle="Belum Ada Siswa"
          emptyDescription="Tidak ada data siswa terdaftar dalam rombongan belajar ini."
          pageSize={20}
          itemName="siswa"
        />
      </div>
    </GuruLayout>
  );
}
