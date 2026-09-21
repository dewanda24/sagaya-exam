'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import {
  Layers,
  Users,
  GraduationCap,
  Calendar,
  Activity,
  ArrowLeft,
  UserCheck,
  Building2,
  FileCheck2,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface StudentInClass {
  id: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: string;
  cardAccessCode?: string;
  status?: string;
  isActive?: boolean;
}

interface ClassDetail {
  id: string;
  name: string;
  level: string;
  academicYear: string;
  academicYearId?: string;
  homeroomTeacherName: string;
  isActive: boolean;
  students: StudentInClass[];
}

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;

  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'SISWA' | 'GURU' | 'UJIAN' | 'ACTIVITY'>('OVERVIEW');

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    fetch(`/api/admin/classes?id=${encodeURIComponent(classId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setClassData(data.data);
        } else {
          setClassData(null);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [classId]);

  const studentColumns: ColumnDef<StudentInClass>[] = [
    {
      key: 'fullName',
      header: 'Nama Siswa',
      cell: (row) => (
        <div className="font-bold text-slate-900 text-sm">
          <Link
            href={`/admin/students/${row.id}`}
            className="hover:text-blue-600 transition"
          >
            {row.fullName}
          </Link>
          <div className="text-[10px] text-slate-400 font-normal">
            {row.gender === 'P' ? 'Perempuan' : 'Laki-laki'}
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'nisn',
      header: 'NISN / NIS',
      cell: (row) => (
        <div className="font-mono text-xs">
          <span className="font-bold text-slate-800">{row.nisn}</span>
          <span className="text-slate-400 block text-[10px]">NIS: {row.nis || '—'}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'cardAccessCode',
      header: 'PIN Kartu',
      cell: (row) => (
        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
          {row.cardAccessCode || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.isActive !== false ? 'success' : 'neutral'} size="sm">
          {row.isActive !== false ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
  ];

  if (loading) {
    return (
      <AdminLayout title="Detail Kelas">
        <div className="p-12 text-center text-slate-400 text-sm">
          Memuat detail kelas...
        </div>
      </AdminLayout>
    );
  }

  if (!classData) {
    return (
      <AdminLayout title="Detail Kelas">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">Kelas Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Kelas dengan ID ini tidak terdaftar pada satuan pendidikan Anda atau telah dihapus.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push('/admin/classes')}
          >
            Kembali ke Daftar Kelas
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={`Kelas: ${classData.name}`}
      subtitle={`Tingkat ${classData.level} • ${classData.academicYear}`}
      breadcrumbs={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Kelas', href: '/admin/classes' },
        { label: classData.name },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => router.push('/admin/classes')}
        >
          Kembali
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Header Hero Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    {classData.name}
                  </h1>
                  <Badge variant="primary" size="sm">
                    Tingkat {classData.level}
                  </Badge>
                  <StatusBadge status={classData.isActive ? 'ACTIVE' : 'DRAFT'} size="sm" />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Wali Kelas: <strong className="text-slate-800">{classData.homeroomTeacherName}</strong> • Tahun Ajaran: <strong className="text-slate-800">{classData.academicYear}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
                <span className="text-xs text-slate-400 block font-medium">Total Peserta Didik</span>
                <span className="text-xl font-black text-slate-900">
                  {classData.students?.length || 0} Siswa
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-t border-slate-100 mt-6 pt-3 overflow-x-auto">
            {(['OVERVIEW', 'SISWA', 'GURU', 'UJIAN', 'ACTIVITY'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === tab
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab === 'OVERVIEW' && 'Overview'}
                {tab === 'SISWA' && `Siswa (${classData.students?.length || 0})`}
                {tab === 'GURU' && 'Guru & Pengajar'}
                {tab === 'UJIAN' && 'Ujian Terkait'}
                {tab === 'ACTIVITY' && 'Aktivitas'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Informasi Administrasi Rombel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Nama Kelas</span>
                  <span className="font-bold text-slate-800">{classData.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Tingkat Pendidikan</span>
                  <span className="font-bold text-slate-800">Kelas {classData.level}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Tahun Ajaran</span>
                  <span className="font-bold text-slate-800">{classData.academicYear}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Wali Kelas</span>
                  <span className="font-bold text-slate-800">{classData.homeroomTeacherName}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Status Rombel</span>
                  <StatusBadge status={classData.isActive ? 'ACTIVE' : 'CLOSED'} size="sm" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Statistik Siswa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Total</span>
                    <span className="text-lg font-black text-slate-900 mt-0.5 block">
                      {classData.students?.length || 0}
                    </span>
                  </div>
                  <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100">
                    <span className="text-[10px] text-blue-600 font-bold uppercase block">Laki-Laki</span>
                    <span className="text-lg font-black text-blue-700 mt-0.5 block">
                      {classData.students?.filter((s) => s.gender === 'L').length || 0}
                    </span>
                  </div>
                  <div className="bg-pink-50/60 p-3 rounded-xl border border-pink-100">
                    <span className="text-[10px] text-pink-600 font-bold uppercase block">Perempuan</span>
                    <span className="text-lg font-black text-pink-700 mt-0.5 block">
                      {classData.students?.filter((s) => s.gender === 'P').length || 0}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setActiveTab('SISWA')}
                  >
                    Lihat Seluruh Daftar Siswa
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'SISWA' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
            <DataTable
              data={classData.students || []}
              columns={studentColumns}
              emptyTitle="Belum Ada Siswa di Kelas Ini"
              emptyDescription="Tambahkan siswa atau import dari data dapodik untuk menempatkan ke rombel ini."
              pageSize={15}
              itemName="siswa"
            />
          </div>
        )}

        {activeTab === 'GURU' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                Tenaga Pendidik &amp; Pengajar Kelas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  {classData.homeroomTeacherName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{classData.homeroomTeacherName}</h4>
                  <p className="text-xs text-slate-500">Wali Kelas Penanggung Jawab Rombel</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'UJIAN' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-600" />
                Daftar Ujian Terjadwal untuk Kelas Ini
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center text-slate-500 text-xs">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Agenda Ujian Kelas</p>
              <p className="text-slate-400 mt-0.5">
                Ujian yang ditugaskan untuk rombel {classData.name} dapat dikelola di menu Ujian.
              </p>
              <Link href="/admin/exams" className="mt-3 inline-block">
                <Button variant="outline" size="sm">
                  Ke Halaman Ujian
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {activeTab === 'ACTIVITY' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-600" />
                Aktivitas &amp; Log Perubahan Rombel
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center text-slate-500 text-xs">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Audit Log Rombel</p>
              <p className="text-slate-400 mt-0.5">
                Semua pembaruan data siswa dan kelas tersimpan secara immutable dalam log audit sekolah.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
