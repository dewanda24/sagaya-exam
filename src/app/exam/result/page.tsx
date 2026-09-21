'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  Sparkles,
  ArrowLeft,
  FileCheck2,
  AlertCircle,
  RotateCw,
} from 'lucide-react';

interface StudentResultSummary {
  resultId: string;
  examId: string;
  examTitle: string;
  subjectName: string;
  subjectCode: string;
  durationMinutes: number;
  finalScore: number;
  percentage: number;
  passingGrade: number;
  isPassed: boolean;
  status: string;
  publishedAt: string | null;
}

export default function StudentResultsPortalPage() {
  const [results, setResults] = useState<StudentResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const storedToken =
        typeof window !== 'undefined'
          ? localStorage.getItem('sagaya_student_token') ||
            sessionStorage.getItem('sagaya_student_session_token')
          : null;

      const headers: Record<string, string> = {};
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
        headers['x-student-session-token'] = storedToken;
      }

      const res = await fetch('/api/student/results', { headers });
      const json = await res.json();
      if (json.success) {
        setResults(json.data || []);
      } else {
        setError(json.error || 'Gagal memuat hasil ujian.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/exam"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Kembali ke Beranda Asesmen"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20">
                S
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  SAGAYA CBT
                </h1>
                <p className="text-[10px] text-slate-500 font-medium">
                  Portal Hasil Ujian Siswa
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={fetchResults}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition text-slate-700 dark:text-slate-300"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 border border-indigo-800/40 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20">
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-3">
              <Award className="w-3.5 h-3.5" />
              Rekapitulasi Capaian Pembelajaran
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Lembar Hasil Asesmen Anda
            </h2>
            <p className="text-slate-300 text-sm mt-2 leading-relaxed">
              Daftar seluruh asesmen yang telah selesai dinilai dan dipublikasikan secara resmi oleh bapak/ibu guru dan pihak sekolah.
            </p>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-end pr-8">
            <GraduationCap className="w-64 h-64 text-indigo-400" />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Results List */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Mengambil arsip lembar hasil...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 mx-auto flex items-center justify-center">
              <FileCheck2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Belum Ada Hasil yang Terbit
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Hasil ujian Anda sedang dalam proses koreksi oleh guru atau menunggu jadwal publikasi resmi dari sekolah. Silakan periksa kembali berkala.
            </p>
            <Link
              href="/exam"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 transition"
            >
              Kembali ke Halaman Ujian
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((item) => (
              <Link
                key={item.resultId}
                href={`/exam/result/${item.resultId}`}
                className="group relative flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                      {item.subjectName}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        item.isPassed
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      {item.isPassed ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Tuntas KKM
                        </>
                      ) : (
                        'Remedial'
                      )}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    {item.examTitle}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {item.durationMinutes} Menit
                    </span>
                    {item.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(item.publishedAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">
                      Nilai Akhir
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {Number(item.finalScore).toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-400">/ 100</span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Lihat Detail</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
