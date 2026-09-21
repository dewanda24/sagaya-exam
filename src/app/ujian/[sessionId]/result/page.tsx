'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';

interface ResultResponse {
  isPublished: boolean;
  message?: string;
  exam: {
    title: string;
    subject: string;
    passingGrade: number;
  };
  participant: {
    studentName: string;
    nisn: string;
    className: string;
  };
  session: {
    submittedAt: string;
  };
  score?: {
    finalScore: number;
    passingGrade: number;
    isPassed: boolean;
    publishedAt: string | null;
  };
  breakdown?: Array<{
    number: number;
    questionText: string;
    score: number;
    maxScore: number;
    feedback: string | null;
  }>;
}

export default function StudentSessionResultPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [data, setData] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadResult() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/student/session/${sessionId}/result`);
        const json = await res.json();

        if (json.success) {
          setData(json.data);
          if (json.data.isPublished && json.data.score?.isPassed) {
            try {
              confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
            } catch {}
          }
        } else {
          setError(json.error || 'Gagal memuat hasil ujian.');
        }
      } catch (err: any) {
        setError(err.message || 'Terjadi kesalahan jaringan.');
      } finally {
        setLoading(false);
      }
    }

    if (sessionId) {
      loadResult();
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-ground flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-text-secondary">Memuat Hasil Ujian Resmi...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-ground flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Hasil Tidak Dapat Ditampilkan</h2>
          <p className="text-xs sm:text-sm text-text-secondary">{error || 'Data hasil ujian tidak ditemukan.'}</p>
          <div className="pt-2">
            <Button variant="primary" className="w-full" onClick={() => router.push(`/ujian/${sessionId}/selesai`)}>
              Kembali ke Bukti Ujian
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data.isPublished) {
    return (
      <div className="min-h-screen bg-surface-ground flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-6 sm:p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-text-primary">Hasil Belum Tersedia</h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              {data.message || 'Hasil ujian belum dipublikasikan oleh pihak sekolah atau masih dalam proses penilaian.'}
            </p>
          </div>

          <div className="bg-surface-subtle p-4 rounded-xl border border-divider text-left text-xs space-y-2">
            <div className="flex justify-between py-1 border-b border-divider/60">
              <span className="text-text-muted">Ujian</span>
              <span className="font-semibold text-text-primary">{data.exam.title}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-divider/60">
              <span className="text-text-muted">Mata Pelajaran</span>
              <span className="font-medium text-text-primary">{data.exam.subject}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-text-muted">Peserta</span>
              <span className="font-semibold text-text-primary">{data.participant.studentName}</span>
            </div>
          </div>

          <div className="pt-2">
            <Button variant="primary" className="w-full" onClick={() => router.push(`/ujian/${sessionId}/selesai`)}>
              Kembali ke Halaman Selesai
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { score, exam, participant, breakdown = [] } = data;
  const isPassed = !!score?.isPassed;

  return (
    <div className="min-h-screen bg-surface-ground py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/ujian/${sessionId}/selesai`)}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Kembali
          </Button>
          <Badge variant="neutral" size="sm" icon={<ShieldCheck className="w-3 h-3 text-primary-600" />}>
            Hasil Terverifikasi
          </Badge>
        </div>

        {/* Score Hero Card */}
        <Card className="border-border shadow-elevated overflow-hidden">
          <div className={`p-6 sm:p-8 text-center text-white ${isPassed ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'bg-gradient-to-br from-slate-700 to-slate-900'}`}>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold mb-3">
              <Award className="w-3.5 h-3.5" />
              <span>{exam.title} &bull; {exam.subject}</span>
            </div>

            <div className="my-2">
              <div className="text-6xl sm:text-7xl font-black tracking-tight font-mono">
                {score?.finalScore ?? 0}
              </div>
              <div className="text-xs uppercase tracking-widest text-white/80 font-bold mt-1">
                Nilai Akhir
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-white shadow-sm text-slate-900">
              {isPassed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>TUNTAS (KKM: {exam.passingGrade})</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>BELUM TUNTAS (KKM: {exam.passingGrade})</span>
                </>
              )}
            </div>
          </div>

          {/* Participant Info Strip */}
          <div className="bg-surface-subtle border-t border-divider p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-text-muted block">Nama Peserta</span>
              <span className="font-bold text-text-primary">{participant.studentName}</span>
            </div>
            <div>
              <span className="text-text-muted block">NISN / Kelas</span>
              <span className="font-semibold text-text-primary">{participant.nisn || '-'} ({participant.className || '-'})</span>
            </div>
            <div>
              <span className="text-text-muted block">Tanggal Terbit</span>
              <span className="font-medium text-text-secondary">
                {score?.publishedAt ? new Date(score.publishedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}
              </span>
            </div>
          </div>
        </Card>

        {/* Question Breakdown Card (if permitted by school/guru) */}
        {breakdown.length > 0 && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-600" />
                <span>Rincian Perolehan Poin Soal</span>
              </CardTitle>
              <CardDescription>
                Daftar butir soal dan pencapaian poin berdasarkan penilaian sistem
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-divider text-xs">
                {breakdown.map((item) => (
                  <div key={item.number} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-1 max-w-[75%]">
                      <div className="font-bold text-text-primary">
                        Soal Nomor {item.number}
                      </div>
                      {item.questionText && (
                        <p className="text-text-secondary text-[11px] line-clamp-2">
                          {item.questionText}
                        </p>
                      )}
                      {item.feedback && (
                        <p className="text-primary-700 text-[11px] font-medium bg-primary-50 px-2 py-1 rounded">
                          Catatan: {item.feedback}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-sm text-text-primary">
                        {item.score} / {item.maxScore}
                      </div>
                      <span className={`text-[10px] font-bold ${item.score === item.maxScore ? 'text-emerald-600' : item.score > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {item.score === item.maxScore ? 'Maksimal' : item.score > 0 ? 'Parsial' : 'Nol'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bottom CTA */}
        <div className="text-center pt-2">
          <Button variant="outline" onClick={() => router.push('/')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Kembali ke Beranda
          </Button>
        </div>
      </div>
    </div>
  );
}
