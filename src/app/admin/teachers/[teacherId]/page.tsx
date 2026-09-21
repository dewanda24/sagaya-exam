'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  UserCheck,
  BookOpen,
  Layers,
  FileCheck2,
  Calendar,
  Activity,
  ArrowLeft,
  Building2,
  Clock,
  Phone,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface AssignedSubject {
  id: string;
  subjectId: string;
  subjectName: string;
}

interface AssignedClass {
  id: string;
  classRoomId: string;
  className: string;
  subjectName: string;
}

interface TeacherDetail {
  id: string;
  username: string;
  fullName: string;
  role: string;
  schoolName: string;
  nip?: string;
  nuptk?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  assignedSubjectsList: AssignedSubject[];
  assignedClassesList: AssignedClass[];
}

export default function TeacherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params.teacherId as string;

  const [teacher, setTeacher] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SUBJECTS' | 'CLASSES' | 'QUESTIONS' | 'EXAMS' | 'ACTIVITY'>('PROFILE');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTeacher = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/teachers?id=${encodeURIComponent(teacherId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTeacher(json.data);
      } else {
        setTeacher(null);
      }
    } catch {
      showToast('Koneksi server terputus.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teacherId) fetchTeacher();
  }, [teacherId]);

  if (loading) {
    return (
      <AdminLayout title="Detail Guru">
        <div className="p-12 text-center text-slate-400 text-xs">
          Memuat profil guru...
        </div>
      </AdminLayout>
    );
  }

  if (!teacher) {
    return (
      <AdminLayout title="Detail Guru">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">Guru Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Data tenaga pendidik dengan ID ini tidak terdaftar pada sekolah Anda.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push('/admin/teachers')}
          >
            Kembali ke Data Guru
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={`Guru: ${teacher.fullName}`}
      subtitle={`NIP: ${teacher.nip || '—'} • Tenaga Pendidik`}
      breadcrumbs={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Guru', href: '/admin/teachers' },
        { label: teacher.fullName },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => router.push('/admin/teachers')}
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
        {/* Hero Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-xl shrink-0 border border-emerald-100">
                {teacher.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    {teacher.fullName}
                  </h1>
                  <Badge variant="success" size="sm">
                    Tenaga Pendidik
                  </Badge>
                  <StatusBadge status={teacher.isActive ? 'ACTIVE' : 'DRAFT'} size="sm" />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Username: <strong className="font-mono text-slate-800">@{teacher.username}</strong>
                  {teacher.nip && ` • NIP: ${teacher.nip}`}
                  {teacher.nuptk && ` • NUPTK: ${teacher.nuptk}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
                <span className="text-xs text-slate-400 block font-medium">Mata Pelajaran Diampu</span>
                <span className="text-xl font-black text-slate-900">
                  {teacher.assignedSubjectsList?.length || 0} Mapel
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-t border-slate-100 mt-6 pt-3 overflow-x-auto">
            {(['PROFILE', 'SUBJECTS', 'CLASSES', 'QUESTIONS', 'EXAMS', 'ACTIVITY'] as const).map((tab) => (
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
                {tab === 'SUBJECTS' && `Mata Pelajaran (${teacher.assignedSubjectsList?.length || 0})`}
                {tab === 'CLASSES' && `Kelas Diampu (${teacher.assignedClassesList?.length || 0})`}
                {tab === 'QUESTIONS' && 'Bank Soal'}
                {tab === 'EXAMS' && 'Ujian Dibuat'}
                {tab === 'ACTIVITY' && 'Aktivitas'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Contents */}
        {activeTab === 'PROFILE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  Identitas Tenaga Pendidik
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Nama Lengkap & Gelar</span>
                  <span className="font-bold text-slate-900">{teacher.fullName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Username Login</span>
                  <span className="font-mono font-bold text-slate-900">@{teacher.username}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Nomor Induk Pegawai (NIP)</span>
                  <span className="font-mono text-slate-800">{teacher.nip || '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">NUPTK</span>
                  <span className="font-mono text-slate-800">{teacher.nuptk || '—'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Nomor Telepon / WhatsApp</span>
                  <span className="font-mono text-slate-800">{teacher.phone || '—'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Status Penugasan Lembaga
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Satuan Pendidikan</span>
                  <span className="font-bold text-slate-900">{teacher.schoolName || 'Satuan Pendidikan'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Status Kepegawaian</span>
                  <StatusBadge status={teacher.isActive ? 'ACTIVE' : 'DRAFT'} size="sm" />
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Tanggal Terdaftar</span>
                  <span className="text-slate-700">
                    {teacher.createdAt ? new Date(teacher.createdAt).toLocaleDateString('id-ID') : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'SUBJECTS' && (
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                Daftar Mata Pelajaran yang Diampu
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {(!teacher.assignedSubjectsList || teacher.assignedSubjectsList.length === 0) ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Guru ini belum ditugaskan mengampu mata pelajaran apapun.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {teacher.assignedSubjectsList.map((s) => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-slate-800 text-xs">{s.subjectName}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'CLASSES' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Daftar Rombel / Kelas yang Diampu
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {(!teacher.assignedClassesList || teacher.assignedClassesList.length === 0) ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Guru ini belum ditugaskan mengajar di kelas manapun.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {teacher.assignedClassesList.map((c) => (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">{c.className}</span>
                        <span className="text-[10px] text-slate-500">{c.subjectName}</span>
                      </div>
                      <Badge variant="primary" size="sm">Rombel</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'QUESTIONS' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-600" />
                Bank Soal Milik Guru Ini
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center text-slate-400 text-xs">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Bank Soal Guru</p>
              <p className="text-slate-400 mt-0.5">
                Admin sekolah dapat memantau butir soal yang diunggah guru ini melalui Bank Soal Sekolah.
              </p>
              <Link href="/admin/question-bank" className="mt-3 inline-block">
                <Button variant="outline" size="sm">
                  Ke Bank Soal Sekolah
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {activeTab === 'EXAMS' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-600" />
                Paket Ujian yang Dibuat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center text-slate-400 text-xs">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Ujian Terkait</p>
              <p className="text-slate-400 mt-0.5">
                Paket ujian yang disusun oleh tenaga pendidik ini dapat dipublikasikan di modul Ujian.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'ACTIVITY' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-600" />
                Aktivitas Guru
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center text-slate-400 text-xs">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Audit Log Guru</p>
              <p className="text-slate-400 mt-0.5">
                Seluruh aktivitas pembuatan soal, penjadwalan ujian, dan penilaian oleh guru ini terekam di sistem.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
