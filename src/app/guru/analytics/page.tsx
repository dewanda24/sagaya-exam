'use client';

import { useState, useEffect } from 'react';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  BarChart3,
  TrendingUp,
  Layers,
  GraduationCap,
  AlertCircle,
  PieChart,
  RotateCw,
  Sparkles,
} from 'lucide-react';

export default function GuruAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/guru/analytics');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Gagal memuat analitik butir soal.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  return (
    <GuruLayout
      title="Analitik Butir Soal & Performa Kelas"
      subtitle="Evaluasi psikometrik kualitas bank soal, daya beda materi, dan disparitas pencapaian kompetensi siswa"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Analitik', href: '/guru/analytics' },
        { label: 'Psikometrik Soal' },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={loadAnalytics}
          isLoading={loading}
          leftIcon={<RotateCw className="w-3.5 h-3.5" />}
        >
          Hitung Ulang Metrik
        </Button>
      }
    >
      <div className="space-y-6 pb-12">
        {error && (
          <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 flex items-center gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-danger-600" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            Menghitung indeks kesukaran dan daya beda soal...
          </div>
        ) : (
          <>
            {/* Top Grid: Type & Difficulty distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Type Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary-600" />
                    Komposisi Tipe Format Soal
                  </CardTitle>
                  <CardDescription>
                    Proporsi sebaran instrumen penilaian objektif dan subjektif
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {data?.typeDistribution && data.typeDistribution.length > 0 ? (
                    data.typeDistribution.map((t: any) => (
                      <div
                        key={t.type}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                      >
                        <span className="font-semibold text-slate-800">{t.type}</span>
                        <Badge variant="primary" size="sm">
                          {t.count} Butir Soal
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">Belum ada data butir soal.</span>
                  )}
                </CardContent>
              </Card>

              {/* Difficulty Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-600" />
                    Distribusi Tingkat Kesukaran (LOTS/HOTS)
                  </CardTitle>
                  <CardDescription>
                    Keseimbangan proporsi kesulitan soal sesuai kaidah taksonomi Bloom
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {data?.difficultyDistribution && data.difficultyDistribution.length > 0 ? (
                    data.difficultyDistribution.map((d: any) => (
                      <div
                        key={d.difficulty}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                      >
                        <span
                          className={`font-bold ${
                            d.difficulty === 'EASY'
                              ? 'text-emerald-700'
                              : d.difficulty === 'HARD'
                              ? 'text-rose-700'
                              : 'text-blue-700'
                          }`}
                        >
                          {d.difficulty === 'EASY'
                            ? 'Mudah (LOTS)'
                            : d.difficulty === 'HARD'
                            ? 'Sukar (HOTS)'
                            : 'Sedang (MOTS)'}
                        </span>
                        <Badge
                          variant={
                            d.difficulty === 'EASY'
                              ? 'success'
                              : d.difficulty === 'HARD'
                              ? 'danger'
                              : 'info'
                          }
                          size="sm"
                        >
                          {d.count} Butir
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">Belum ada data tingkat kesukaran.</span>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Class Performance Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary-600" />
                  Komparasi Nilai Rata-rata Antar Rombel
                </CardTitle>
                <CardDescription>
                  Pencapaian rerata nilai ujian siswa pada tiap rombongan belajar yang Anda ampu
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.classPerformance && data.classPerformance.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.classPerformance.map((cp: any) => (
                      <div
                        key={cp.classId}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2"
                      >
                        <span className="font-bold text-slate-900 text-sm block">{cp.className}</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-primary-700 font-mono">
                            {Number(cp.averageScore || 0).toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-500">rerata</span>
                        </div>
                        <div className="pt-2 border-t border-slate-200 flex justify-between text-[11px] text-slate-500">
                          <span>Peserta: {cp.studentCount || 0}</span>
                          <span>Kelulusan: {cp.passPercentage || 0}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Belum ada nilai ujian yang tercatat untuk menghitung komparasi rombel.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </GuruLayout>
  );
}
