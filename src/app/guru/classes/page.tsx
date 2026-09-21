'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import {
  GraduationCap,
  Users,
  Calendar,
  ArrowRight,
  BookOpen,
  RotateCw,
  Search,
} from 'lucide-react';

interface TeacherClass {
  id: string;
  name: string;
  level: string;
  academicYear: string;
  subjectId: string;
  subjectName: string;
  studentCount: number;
}

export default function GuruClassesPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/guru/classes');
      const json = await res.json();
      if (json.success) {
        setClasses(json.data || []);
      } else {
        setError(json.error || 'Gagal memuat kelas yang diampu.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const filtered = classes.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.subjectName.toLowerCase().includes(q) ||
      (c.academicYear && c.academicYear.toLowerCase().includes(q))
    );
  });

  const columns: ColumnDef<TeacherClass>[] = [
    {
      key: 'name',
      header: 'Nama Rombel / Kelas',
      cell: (row) => (
        <div className="space-y-0.5">
          <Link
            href={`/guru/classes/${row.id}`}
            className="font-bold text-slate-900 hover:text-primary-600 transition-colors"
          >
            {row.name}
          </Link>
          <div className="text-xs text-slate-500">Tingkat {row.level || '-'}</div>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'subjectName',
      header: 'Mata Pelajaran',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-primary-500" />
          <span className="text-sm font-medium text-slate-800">{row.subjectName}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'academicYear',
      header: 'Tahun Ajaran',
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.academicYear || '-'}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'studentCount',
      header: 'Peserta Didik',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant="primary" size="sm">
            <Users className="w-3 h-3 mr-1" />
            {row.studentCount} Siswa
          </Badge>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Aksi',
      cell: (row) => (
        <Link href={`/guru/classes/${row.id}`}>
          <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
            Lihat Siswa
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <GuruLayout
      title="Kelas & Rombongan Belajar"
      subtitle="Daftar rombongan belajar dan peserta didik yang menjadi wewenang akademik Anda"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Kelas & Siswa' },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={loadClasses}
          isLoading={loading}
          leftIcon={<RotateCw className="w-3.5 h-3.5" />}
        >
          Segarkan
        </Button>
      }
    >
      <div className="space-y-6 pb-12">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama rombel, mapel, atau TA..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="text-xs text-slate-500 self-end sm:self-center">
            Total <span className="font-bold text-slate-800">{filtered.length}</span> kelas diampu
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          data={filtered}
          columns={columns}
          isLoading={loading}
          error={error}
          onRetry={loadClasses}
          emptyTitle="Belum Ada Rombel Ditugaskan"
          emptyDescription="Anda belum memiliki rombongan belajar yang terhubung. Hubungi administrator sekolah untuk penugasan kelas."
          pageSize={10}
          itemName="kelas"
        />
      </div>
    </GuruLayout>
  );
}
