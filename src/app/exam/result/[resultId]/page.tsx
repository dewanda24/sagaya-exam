'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Calendar,
  Sparkles,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  User,
  GraduationCap,
  FileText,
  Share2,
} from 'lucide-react';

interface ResultData {
  exam: {
    title: string;
    subjectName: string;
    passingGrade: number;
  };
  student: {
    name: string;
    nisn: string;
    className: string;
  };
  score: {
    rawScore: number;
    maxScore: number;
    finalScore: number;
    percentage: number;
    isPassed: boolean;
    status: string;
    publishedAt: string | null;
  };
  breakdown: Array<{
    number: number;
    questionText: string;
    score: number;
    maxScore: number;
    feedback: string | null;
  }>;
}

export default function StudentResultPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = use(params);
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResult() {
      try {
        setLoading(true);
        setError(null);

        // Get saved student session token from localStorage if present
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

        const res = await fetch(`/api/exam/results/${resultId}`, {
          headers,
        });

        const json = await res.json();
        if (json.success) {
          setData(json.data);
          if (json.data.score.isPassed) {
            triggerConfetti();
          }
        } else {
          setError(json.error || 'Gagal memuat hasil ujian.');
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan jaringan saat memuat hasil ujian.');
      } finally {
        setLoading(false);
      }
    }

    fetchResult();
  }, [resultId]);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // Ignored if canvas not ready
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white px-4">
        <div className="relative w-16 h-16 mb-4">
          <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <Sparkles className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <h2 className="text-lg font-bold">Memuat Hasil Ujian</h2>
        <p className="text-sm text-slate-400 mt-1">Mengambil data nilai terverifikasi server...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white px-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl text-center space-y-4 backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black">Informasi Hasil Ujian</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{error}</p>
          <div className="pt-4">
            <Link
              href="/exam"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-sm font-bold text-white transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Portal Ujian
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { exam, student, score, breakdown } = data;
  const isPassed = score.isPassed;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/exam"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-xs font-semibold text-slate-300 transition-all hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Portal Ujian
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Hasil Terverifikasi Server</span>
          </div>
        </div>

        {/* Main Hero Card */}
        <div
          className={`relative overflow-hidden rounded-3xl p-8 sm:p-10 border shadow-2xl backdrop-blur-xl ${
            isPassed
              ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900/90 border-emerald-500/30'
              : 'bg-gradient-to-br from-rose-950/30 via-slate-900 to-slate-900/90 border-rose-500/30'
          }`}
        >
          {/* Background Glow */}
          <div
            className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none ${
              isPassed ? 'bg-emerald-500/10' : 'bg-rose-500/10'
            }`}
          />

          <div className="relative z-10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-slate-800/80 text-slate-300 border border-slate-700">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                  {exam.subjectName}
                </span>
                <h1 className="text-2xl sm:text-3xl font-black mt-2 text-white tracking-tight">
                  {exam.title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Nama Siswa: <strong className="text-slate-200">{student.name}</strong> • Kelas:{' '}
                  <span className="text-slate-200">{student.className || '-'}</span> • NISN:{' '}
                  <span className="text-slate-200">{student.nisn || '-'}</span>
                </p>
              </div>

              {/* Status Badge */}
              <div
                className={`px-4 py-2 rounded-2xl border text-center ${
                  isPassed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 text-sm font-black">
                  {isPassed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> LULUS
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" /> BELUM LULUS
                    </>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">KKM: {exam.passingGrade}</div>
              </div>
            </div>

            {/* Score Big Meter */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Nilai Akhir
                </span>
                <div
                  className={`text-3xl sm:text-4xl font-black mt-1 ${
                    isPassed ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {score.finalScore}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Persentase
                </span>
                <div className="text-3xl sm:text-4xl font-black mt-1 text-white">
                  {score.percentage}%
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Poin Diperoleh
                </span>
                <div className="text-xl sm:text-2xl font-black mt-2 text-slate-200">
                  {score.rawScore} / {score.maxScore}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 text-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Status Publikasi
                </span>
                <div className="text-xs sm:text-sm font-bold mt-3 text-emerald-400 uppercase tracking-wider">
                  {score.status}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Question Breakdown Section */}
        {breakdown && breakdown.length > 0 && (
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Rincian Perolehan Nilai Soal</h3>
              </div>
              <span className="text-xs text-slate-400">{breakdown.length} Butir Soal</span>
            </div>

            <div className="space-y-3 pt-2">
              {breakdown.map((item) => (
                <div
                  key={item.number}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 hover:border-slate-700/60 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold flex items-center justify-center flex-shrink-0 text-slate-300">
                        {item.number}
                      </span>
                      <p className="text-xs sm:text-sm text-slate-300 font-medium whitespace-pre-wrap leading-relaxed">
                        {item.questionText}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span
                        className={`text-xs sm:text-sm font-black px-2.5 py-1 rounded-lg border ${
                          item.score === item.maxScore
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : item.score > 0
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}
                      >
                        {item.score} / {item.maxScore}
                      </span>
                    </div>
                  </div>

                  {item.feedback && (
                    <div className="pl-9 pt-1 text-xs text-amber-300/90 italic flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span>Umpan balik pengajar: &ldquo;{item.feedback}&rdquo;</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="text-center text-xs text-slate-500 py-4 space-y-1">
          <p>Hasil ujian ini diterbitkan secara resmi oleh sistem Sagaya Exam.</p>
          <p>Hubungi wali kelas atau proktor sekolah untuk pertanyaan lebih lanjut terkait hasil ujian.</p>
        </div>
      </div>
    </div>
  );
}
