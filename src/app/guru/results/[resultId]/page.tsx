'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Award,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Printer,
  BookOpen,
  Calendar,
  Layers,
  GraduationCap,
  MessageSquare,
  FileCheck2,
} from 'lucide-react';

export default function GuruResultDetailPage() {
  const params = useParams();
  const router = useRouter();
  const resultId = params.resultId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!resultId) return;

    const fetchResult = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/guru/results/${resultId}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || 'Gagal memuat rincian hasil.');
        }
      } catch (err: any) {
        setError(err.message || 'Koneksi server terputus.');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [resultId]);

  if (loading) {
    return (
      <GuruLayout
        title="Rincian Hasil Ujian"
        subtitle="Memuat data rekapitulasi nilai dan butir asesmen peserta didik..."
        breadcrumbs={[
          { label: 'Dashboard', href: '/guru/dashboard' },
          { label: 'Hasil Nilai', href: '/guru/results' },
          { label: 'Detail' },
        ]}
      >
        <div className="flex flex-col items-center justify-center p-16 space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Menyiapkan lembar skor siswa...</p>
        </div>
      </GuruLayout>
    );
  }

  if (error || !data) {
    return (
      <GuruLayout
        title="Rincian Hasil Ujian"
        subtitle="Terjadi kendala saat memuat data"
        breadcrumbs={[
          { label: 'Dashboard', href: '/guru/dashboard' },
          { label: 'Hasil Nilai', href: '/guru/results' },
          { label: 'Detail' },
        ]}
      >
        <div className="max-w-2xl mx-auto p-8 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
          <h2 className="text-lg font-bold text-rose-900 dark:text-rose-200">Gagal Mengakses Lembar Hasil</h2>
          <p className="text-sm text-rose-700 dark:text-rose-300">{error || 'Data hasil tidak ditemukan.'}</p>
          <Button variant="outline" onClick={() => router.push('/guru/results')}>
            Kembali ke Daftar Hasil
          </Button>
        </div>
      </GuruLayout>
    );
  }

  const { result, exam, student, questionResults } = data;
  const isPassed = result.finalScore >= (exam?.passingGrade || 75);

  return (
    <GuruLayout
      title={`Hasil Ujian: ${student?.name || 'Siswa'}`}
      subtitle={`Rincian capaian asesmen mata pelajaran ${exam?.subjectName || ''}`}
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Hasil Nilai', href: '/guru/results' },
        { label: student?.name || 'Rincian' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/guru/results')}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Kembali
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Cetak Lembar Nilai
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pb-12">
        {/* Identitas Siswa & Ringkasan Ujian Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  Identitas Peserta & Asesmen
                </CardTitle>
                <Badge
                  variant={
                    result.status === 'PUBLISHED'
                      ? 'success'
                      : result.status === 'VOID'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {result.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 uppercase font-semibold">Nama Peserta Didik</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{student?.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">NIS: {student?.nis || '-'} • NISN: {student?.nisn || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase font-semibold">Rombel / Kelas</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{student?.className || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase font-semibold">Judul Ujian</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{exam?.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{exam?.subjectName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase font-semibold">Waktu Penilaian & Publikasi</div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 font-mono mt-1">
                    Dinilai: {result.gradedAt ? new Date(result.gradedAt).toLocaleString('id-ID') : '-'}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                    Terbit: {result.publishedAt ? new Date(result.publishedAt).toLocaleString('id-ID') : 'Belum Publikasi'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Skor Final Scorecard */}
          <Card className="flex flex-col justify-center items-center p-6 text-center bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50 dark:from-slate-900 dark:to-slate-800 border-indigo-100 dark:border-slate-700">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
              Skor Akhir Siswa
            </div>
            <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              {Number(result.finalScore).toFixed(1)}
            </div>
            <div className="text-xs text-slate-500 mb-4">
              Mentah: <span className="font-semibold text-slate-700 dark:text-slate-300">{result.rawScore}</span> / {result.maxScore} ({Number(result.percentage).toFixed(1)}%)
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isPassed ? 'success' : 'danger'} size="md">
                {isPassed ? 'TUNTAS (Memenuhi KKM)' : 'REMEDIAL (Di Bawah KKM)'}
              </Badge>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              Batas KKM: {exam?.passingGrade || 75}
            </div>
          </Card>
        </div>

        {/* Butir Soal & Poin Breakdown */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-600" />
                Rincian Skor Per Butir Soal ({questionResults?.length || 0} Soal)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="py-3 px-4 w-14 text-center">No</th>
                    <th className="py-3 px-4">Tipe & Butir Soal</th>
                    <th className="py-3 px-4 w-32 text-center">Status</th>
                    <th className="py-3 px-4 w-32 text-right">Poin / Bobot</th>
                    <th className="py-3 px-4 w-64">Umpan Balik Guru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {questionResults?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                        Tidak ada data butir soal.
                      </td>
                    </tr>
                  ) : (
                    questionResults.map((q: any, idx: number) => {
                      const isCorrect = q.scoreStatus === 'CORRECT';
                      const isPartial = q.scoreStatus === 'PARTIAL';
                      const isIncorrect = q.scoreStatus === 'INCORRECT';

                      return (
                        <tr key={q.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4 text-center font-mono font-medium text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="neutral" size="sm">
                                {q.questionType || 'SOAL'}
                              </Badge>
                            </div>
                            <div className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2">
                              {q.questionText || 'Konten soal terlampir'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isCorrect && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Benar
                              </span>
                            )}
                            {isPartial && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                Parsial
                              </span>
                            )}
                            {isIncorrect && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                                <XCircle className="w-3.5 h-3.5" /> Salah
                              </span>
                            )}
                            {!isCorrect && !isPartial && !isIncorrect && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                {q.scoreStatus || 'UNGRADED'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {Number(q.score).toFixed(1)}
                            </span>
                            <span className="text-slate-400 text-xs"> / {Number(q.maxScore).toFixed(1)}</span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                            {q.feedback ? (
                              <div className="flex items-start gap-1.5 p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                                <span>{q.feedback}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Tidak ada catatan</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </GuruLayout>
  );
}
