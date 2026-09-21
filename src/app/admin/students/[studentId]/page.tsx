'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Users,
  GraduationCap,
  Calendar,
  Award,
  Activity,
  ArrowLeft,
  Building2,
  Clock,
  Layers,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { Student } from '@/lib/core/types';

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'KELAS' | 'UJIAN' | 'HASIL' | 'ACTIVITY'>('PROFILE');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchStudent = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/students?id=${encodeURIComponent(studentId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setStudent(json.data);
      } else {
        setStudent(null);
      }
    } catch {
      showToast('Koneksi server bermasalah.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) fetchStudent();
  }, [studentId]);

  if (loading) {
    return (
      <AdminLayout title="Detail Siswa">
        <div className="p-12 text-center text-slate-400 text-xs">
          Memuat data siswa...
        </div>
      </AdminLayout>
    );
  }

  if (!student) {
    return (
      <AdminLayout title="Detail Siswa">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">Siswa Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Data siswa dengan ID ini tidak terdaftar pada satuan pendidikan Anda atau telah dihapus.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push('/admin/students')}
          >
            Kembali ke Data Siswa
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={`Siswa: ${student.fullName}`}
      subtitle={`NISN: ${student.nisn} • Rombel: ${student.classRoomName || '—'}`}
      breadcrumbs={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Siswa', href: '/admin/students' },
        { label: student.fullName },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => router.push('/admin/students')}
        >
          Kembali
        </Button>
      }
    >
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all animate-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Student Hero Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black text-xl shrink-0 border border-blue-100">
                {student.gender === 'P' ? 'P' : 'L'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    {student.fullName}
                  </h1>
                  <Badge variant="primary" size="sm">
                    {student.classRoomName || 'Belum Ada Rombel'}
                  </Badge>
                  <StatusBadge status={student.isActive !== false ? 'ACTIVE' : 'DRAFT'} size="sm" />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  NISN: <strong className="font-mono text-slate-800">{student.nisn}</strong>
                  {student.nis && ` • NIS: ${student.nis}`}
                  {student.gender && ` • Jenis Kelamin: ${student.gender === 'P' ? 'Perempuan' : 'Laki-laki'}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
                <span className="text-xs text-slate-400 block font-medium">PIN Akses Kartu</span>
                <span className="font-mono font-black text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md inline-block mt-0.5">
                  {student.cardAccessCode || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-t border-slate-100 mt-6 pt-3 overflow-x-auto">
            {(['PROFILE', 'KELAS', 'UJIAN', 'HASIL', 'ACTIVITY'] as const).map((tab) => (
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
                {tab === 'PROFILE' && 'Profile'}
                {tab === 'KELAS' && 'Kelas & Rombel'}
                {tab === 'UJIAN' && 'Riwayat Ujian'}
                {tab === 'HASIL' && 'Hasil Akademik'}
                {tab === 'ACTIVITY' && 'Aktivitas'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'PROFILE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Biodata Pokok Peserta Didik
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Nama Lengkap</span>
                  <span className="font-bold text-slate-900">{student.fullName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">NISN</span>
                  <span className="font-mono font-bold text-slate-900">{student.nisn}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Nomor Induk Siswa (NIS)</span>
                  <span className="font-mono text-slate-800">{student.nis || '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Jenis Kelamin</span>
                  <span className="font-semibold text-slate-800">
                    {student.gender === 'P' ? 'Perempuan (P)' : 'Laki-laki (L)'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Tempat, Tanggal Lahir</span>
                  <span className="text-slate-800">
                    {student.birthPlace || '—'}
                    {student.birthDate && `, ${new Date(student.birthDate).toLocaleDateString('id-ID')}`}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Tahun Masuk</span>
                  <span className="font-mono text-slate-800">{student.entryYear || '—'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  Status Kepesertaan &amp; Ujian
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Rombongan Belajar</span>
                  <span className="font-bold text-blue-700">{student.classRoomName || '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">PIN Kartu Ujian</span>
                  <span className="font-mono font-bold text-indigo-700">{student.cardAccessCode || '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Status Keaktifan</span>
                  <StatusBadge status={student.isActive !== false ? 'ACTIVE' : 'DRAFT'} size="sm" />
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Terdaftar Sejak</span>
                  <span className="text-slate-700">
                    {student.createdAt ? new Date(student.createdAt).toLocaleDateString('id-ID') : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'KELAS' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Penetapan Rombongan Belajar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {student.classRoomId ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{student.classRoomName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Rombel Aktif Terdaftar</p>
                  </div>
                  <Link href={`/admin/classes/${student.classRoomId}`}>
                    <Button variant="outline" size="sm">
                      Buka Rombel
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Siswa belum ditempatkan pada rombongan belajar manapun.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'UJIAN' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-600" />
                Riwayat Sesi Ujian Peserta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center text-slate-400 text-xs">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Agenda Ujian Peserta</p>
              <p className="text-slate-400 mt-0.5">
                Sesi ujian yang diikutsertakan oleh siswa ini dapat dipantau langsung di Monitoring Ujian.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'HASIL' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" />
                Transkrip &amp; Rekapitulasi Nilai Siswa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center text-slate-400 text-xs">
              <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Hasil Evaluasi Belajar</p>
              <p className="text-slate-400 mt-0.5">
                Nilai ujian yang telah dipublikasikan dapat dilihat di modul Hasil &amp; Leger Nilai.
              </p>
              <Link href="/admin/results" className="mt-3 inline-block">
                <Button variant="outline" size="sm">
                  Ke Halaman Hasil Ujian
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
                Riwayat Log Aktivitas Siswa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center text-slate-400 text-xs">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Audit Log Peserta</p>
              <p className="text-slate-400 mt-0.5">
                Pendaftaran, import data, dan login kartu ujian siswa ini tersimpan dalam log audit sekolah.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
