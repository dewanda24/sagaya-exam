'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Award,
  ArrowLeft,
  Clock,
  Calendar,
  Sparkles,
  BookOpen,
  User,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  FileCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';

export default function ExamCompletedPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [resultInfo, setResultInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCompletedSession() {
      try {
        const [sessionRes, resultRes] = await Promise.all([
          fetch(`/api/student/session/${sessionId}`),
          fetch(`/api/student/session/${sessionId}/result`),
        ]);

        const sessionJson = await sessionRes.json();
        const resultJson = await resultRes.json();

        if (sessionJson.success) {
          setSessionInfo(sessionJson.data);
        }
        if (resultJson.success) {
          setResultInfo(resultJson.data);
        }
      } catch (err) {
        console.error('Error loading completed exam state:', err);
      } finally {
        setLoading(false);
      }
    }

    if (sessionId) {
      loadCompletedSession();
      // Trigger festive celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // Safe fallback if canvas-confetti is not rendered
      }
    }
  }, [sessionId]);

  const participant = sessionInfo?.participant;
  const exam = sessionInfo?.exam;
  const isResultPublished = resultInfo?.isPublished;

  return (
    <div className="min-h-screen bg-surface-ground flex flex-col justify-between py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      {/* Top Simple Header */}
      <header className="max-w-2xl mx-auto w-full flex items-center justify-between pb-6 border-b border-divider">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary-600 text-white flex items-center justify-center font-black text-sm">
            SE
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Sagaya CBT Engine</h2>
            <p className="text-[11px] text-text-secondary">Sesi Ujian Resmi Berbasis Komputer</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm" icon={<ShieldCheck className="w-3 h-3" />}>
            Final &amp; Terverifikasi
          </Badge>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="max-w-2xl mx-auto w-full my-auto py-8">
        <Card className="border-border shadow-elevated p-6 sm:p-8 text-center space-y-6">
          {/* Animated Success Icon */}
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-text-primary tracking-tight">
              Ujian Selesai!
            </h1>
            <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
              Terima kasih telah mengerjakan ujian dengan tertib dan jujur. Seluruh lembar jawaban Anda telah tersimpan secara aman di server CBT.
            </p>
          </div>

          {/* Receipt Box */}
          <div className="bg-surface-subtle border border-divider rounded-xl p-5 text-left text-xs sm:text-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-divider/60 font-semibold text-text-primary">
              <span className="text-xs uppercase tracking-wider text-text-muted">Bukti Pengumpulan</span>
              <span className="font-mono text-xs text-text-secondary">ID: {sessionId.substring(0, 8)}...</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-text-muted text-xs block">Nama Peserta</span>
                <span className="font-bold text-text-primary">{participant?.studentName || 'Peserta Ujian'}</span>
              </div>
              <div>
                <span className="text-text-muted text-xs block">NISN / Kelas</span>
                <span className="font-semibold text-text-primary">
                  {participant?.nisn || '-'} ({participant?.className || '-'})
                </span>
              </div>
              <div>
                <span className="text-text-muted text-xs block">Mata Pelajaran</span>
                <span className="font-bold text-primary-600">{exam?.subject || exam?.title || 'Ujian'}</span>
              </div>
              <div>
                <span className="text-text-muted text-xs block">Paket Soal</span>
                <span className="font-semibold text-text-primary">Paket {participant?.assignedPackage || 'A'}</span>
              </div>
              <div>
                <span className="text-text-muted text-xs block">Waktu Pengumpulan</span>
                <span className="font-semibold text-text-primary">
                  {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </span>
              </div>
              <div>
                <span className="text-text-muted text-xs block">Status Sesi</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  SUBMITTED (FINAL)
                </span>
              </div>
            </div>
          </div>

          {/* Result Availability Notice / CTA */}
          {isResultPublished ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-left space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Award className="w-4 h-4 text-emerald-600" />
                <span>Hasil Ujian Telah Tersedia</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Pihak sekolah/guru telah mempublikasikan nilai ujian ini. Anda dapat melihat perolehan skor dan evaluasi pengerjaan Anda sekarang.
              </p>
              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => router.push(`/ujian/${sessionId}/result`)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  Lihat Hasil Ujian
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-left space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Hasil Sedang Diproses</span>
              </div>
              <p className="text-xs text-blue-800 leading-relaxed">
                Hasil ujian dan perolehan nilai akan diumumkan oleh guru atau pihak sekolah setelah seluruh proses verifikasi dan penilaian selesai.
              </p>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push('/ujian')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Halaman Masuk Ujian
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => router.push('/')}
            >
              Kembali ke Beranda
            </Button>
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-text-muted pt-6">
        &copy; {new Date().getFullYear()} Sagaya Exam CBT &bull; Lingkungan Ujian Aman &amp; Terstandar
      </footer>
    </div>
  );
}
