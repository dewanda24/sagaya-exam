'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  User,
  Clock,
  BookOpen,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Laptop,
  Wifi,
  WifiOff,
  CheckCircle2,
  HelpCircle,
  LogOut,
  RefreshCw,
  FileText,
  AlertCircle,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Checkbox } from '@/components/ui/Checkbox';

interface ParticipantData {
  studentName?: string;
  nisn?: string;
  className?: string;
  assignedPackage?: string;
}

interface ExamData {
  id?: string;
  title?: string;
  subject?: string;
  durationMinutes?: number;
  navigationPolicy?: string;
}

interface SessionData {
  session: {
    id: string;
    status: string;
    startedAt?: string;
    expiresAt?: string;
    remainingSeconds?: number;
  };
  participant: ParticipantData;
  exam: ExamData;
  questions?: any[];
}

export default function ExamLobbyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [starting, setStarting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [pingStatus, setPingStatus] = useState<'checking' | 'ready' | 'slow' | 'offline'>('checking');
  const [leaving, setLeaving] = useState(false);

  // Network & Connectivity ping
  useEffect(() => {
    let isMounted = true;

    async function checkConnectivity() {
      if (!navigator.onLine) {
        if (isMounted) {
          setIsOnline(false);
          setPingStatus('offline');
          setPingLatency(null);
        }
        return;
      }

      try {
        const start = performance.now();
        const res = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
        const latency = Math.round(performance.now() - start);

        if (isMounted) {
          if (res.ok) {
            setIsOnline(true);
            setPingLatency(latency);
            setPingStatus(latency > 500 ? 'slow' : 'ready');
          } else {
            setIsOnline(true);
            setPingStatus('slow');
          }
        }
      } catch {
        if (isMounted) {
          setIsOnline(false);
          setPingStatus('offline');
        }
      }
    }

    checkConnectivity();
    const pingInterval = setInterval(checkConnectivity, 15000);

    const handleOnline = () => {
      setIsOnline(true);
      checkConnectivity();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setPingStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch current session data
  const loadCurrentSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/exam/session/current', { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || 'Sesi ujian tidak valid atau telah berakhir.');
        return;
      }

      setSessionData(json.data);

      // If session is already IN_PROGRESS, navigate directly to workspace
      if (json.data.session?.status === 'IN_PROGRESS') {
        router.push('/exam/session');
      }
    } catch {
      setError('Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentSession();
  }, []);

  // Handle start exam with double-click protection
  const handleStartExam = async () => {
    if (starting) return; // Prevent race condition
    if (!agreed) {
      setError('Silakan baca dan setujui instruksi serta tata tertib ujian terlebih dahulu.');
      return;
    }
    if (!identityConfirmed) {
      setError('Harap konfirmasikan identitas peserta Anda sebelum memulai.');
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const res = await fetch('/api/exam/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || 'Gagal memulai sesi ujian. Silakan coba kembali.');
        setStarting(false);
      } else {
        // Move to exam execution workspace
        router.push('/exam/session');
      }
    } catch {
      setError('Terjadi kendala saat memulai sesi ujian. Periksa koneksi internet Anda.');
      setStarting(false);
    }
  };

  // Handle "Bukan Saya" / Leave Lobby
  const handleLeaveLobby = async () => {
    setLeaving(true);
    try {
      await fetch('/api/exam/session/leave', { method: 'POST' }).catch(() => {});
    } finally {
      router.push('/ujian');
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-ground flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-10 h-10 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-text-primary">Mempersiapkan Ruang Ujian</h2>
            <p className="text-xs text-text-secondary">
              Memverifikasi token, sinkronisasi lembar soal, dan mengikat perangkat...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error / Session Missing State
  if (error && !sessionData) {
    return (
      <div className="min-h-screen bg-surface-ground flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 sm:p-8 text-center space-y-5 shadow-elevated border-border">
          <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-text-primary">Sesi Ujian Tidak Ditemukan</h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">{error}</p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={loadCurrentSession}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Coba Lagi
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => router.push('/ujian')}
            >
              Kembali ke Masuk Ujian
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { participant, exam, questions } = sessionData || {};
  const totalQuestions = questions?.length || 0;

  return (
    <div className="min-h-screen bg-surface-ground py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-surface rounded-lg border border-border p-5 sm:p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-text-primary">Lobi Ruang Ujian</h1>
                <Badge variant="primary" size="sm">
                  Persiapan Ujian
                </Badge>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Sagaya Exam Session Engine &bull; Periksa data dan kesiapan sebelum memulai
              </p>
            </div>
          </div>

          {/* Quick Status Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-subtle border border-divider text-text-secondary font-medium">
              <Laptop className="w-3.5 h-3.5 text-text-muted" />
              <span>Perangkat Terikat</span>
            </div>
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-medium ${
                isOnline
                  ? pingStatus === 'slow'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>
                    Koneksi {pingLatency !== null ? `${pingLatency}ms` : 'Stabil'}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Terputus</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Alerts */}
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 2-Column Grid: Identity & Exam Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Identity Confirmation Card */}
          <Card className="p-6 shadow-card border-border flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-divider">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary-600" />
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    Konfirmasi Identitas
                  </h2>
                </div>
                {identityConfirmed ? (
                  <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                    Terkonfirmasi
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm">
                    Belum Dikonfirmasi
                  </Badge>
                )}
              </div>

              <div className="p-3.5 rounded-md bg-surface-subtle border border-divider text-xs space-y-2.5">
                <p className="text-text-muted font-medium">Anda akan mengikuti ujian sebagai:</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-text-secondary text-xs">Nama Lengkap</span>
                    <span className="font-bold text-text-primary text-right">
                      {participant?.studentName || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-text-secondary text-xs">Kelas / Rombel</span>
                    <span className="font-medium text-text-primary">
                      {participant?.className || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-text-secondary text-xs">NIS / NISN</span>
                    <span className="font-mono text-xs font-semibold text-text-secondary">
                      {participant?.nisn || '-'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-text-muted">
                Periksa nama dan data diri di atas. Jika data tidak sesuai, jangan lanjutkan dan beri tahu pengawas.
              </p>
            </div>

            {/* Confirmation CTA */}
            <div className="pt-4 mt-4 border-t border-divider flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleLeaveLobby}
                disabled={leaving}
                className="text-xs font-semibold text-danger hover:underline inline-flex items-center gap-1 disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                {leaving ? 'Keluar...' : 'Bukan Saya'}
              </button>

              <button
                type="button"
                onClick={() => setIdentityConfirmed(true)}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                  identityConfirmed
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                }`}
              >
                {identityConfirmed ? '✓ Ya, ini saya' : 'Konfirmasi Identitas'}
              </button>
            </div>
          </Card>

          {/* Exam Information Card */}
          <Card className="p-6 shadow-card border-border flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-divider">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary-600" />
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    Informasi Ujian
                  </h2>
                </div>
                <Badge variant="primary" size="sm">
                  Paket {participant?.assignedPackage || 'A'}
                </Badge>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-secondary">Nama Ujian</span>
                  <span className="font-bold text-text-primary text-right max-w-[60%]">
                    {exam?.title || '-'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-secondary">Mata Pelajaran</span>
                  <span className="font-semibold text-text-primary">{exam?.subject || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-secondary">Alokasi Waktu</span>
                  <span className="font-bold text-primary-700 inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {exam?.durationMinutes || 90} Menit
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-secondary">Jumlah Soal</span>
                  <span className="font-semibold text-text-primary">
                    {totalQuestions > 0 ? `${totalQuestions} Butir Soal` : 'Sesuai Paket'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-text-secondary">Navigasi Soal</span>
                  <span className="text-text-secondary">
                    {exam?.navigationPolicy === 'STRICT_LINEAR'
                      ? 'Berurutan (Linear)'
                      : 'Bebas Berpindah'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-divider">
              <p className="text-[11px] text-text-muted text-center">
                Periksa informasi ujian di atas sebelum menekan tombol mulai.
              </p>
            </div>
          </Card>
        </div>

        {/* Readiness Check Banner */}
        <Card className="p-5 border-border shadow-card bg-surface">
          <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
            Pemeriksaan Kesiapan Sistem
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2.5 p-3 rounded-md bg-surface-subtle border border-divider">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-text-primary block">Browser Didukung</span>
                <span className="text-text-muted text-[11px]">Kompatibel modern</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-md bg-surface-subtle border border-divider">
              {isOnline ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-danger shrink-0" />
              )}
              <div>
                <span className="font-bold text-text-primary block">Koneksi Internet</span>
                <span className="text-text-muted text-[11px]">
                  {isOnline ? 'Terhubung ke server' : 'Koneksi terputus'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-md bg-surface-subtle border border-divider">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-text-primary block">Perangkat Terikat</span>
                <span className="text-text-muted text-[11px]">Sesi aman aktif</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Instructions & Rules Acknowledgement */}
        <Card className="p-6 shadow-card border-border space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-divider">
            <FileText className="w-4 h-4 text-primary-600" />
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Instruksi & Tata Tertib Pengerjaan
            </h2>
          </div>

          <ol className="text-xs sm:text-sm text-text-secondary space-y-2 list-decimal list-inside leading-relaxed">
            <li>
              <strong>Pastikan koneksi internet stabil</strong> sebelum memulai pengerjaan ujian.
            </li>
            <li>
              <strong>Gunakan perangkat yang telah terdaftar.</strong> Sesi Anda terikat dengan browser dan perangkat saat ini.
            </li>
            <li>
              <strong>Baca setiap soal dengan teliti.</strong> Anda dapat mengubah jawaban selama waktu ujian masih tersedia.
            </li>
            <li>
              <strong>Jawaban tersimpan secara otomatis</strong> secara berkala oleh server Sagaya Exam Engine.
            </li>
            <li>
              <strong>Jangan menutup halaman atau berpindah tab.</strong> Tindakan berpindah jendela terdeteksi dan tercatat pada sistem pengawas.
            </li>
            <li>
              <strong>Waktu ujian dihitung mutlak oleh server.</strong> Jika waktu habis, jawaban otomatis tersubmit.
            </li>
          </ol>

          <div className="pt-4 border-t border-divider">
            <Checkbox
              id="acknowledge-rules-checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              label={
                <span className="text-xs sm:text-sm font-medium text-text-primary">
                  Saya telah membaca dan memahami seluruh instruksi ujian, serta bersedia mematuhi tata tertib yang berlaku.
                </span>
              }
            />
          </div>
        </Card>

        {/* Action Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 pb-8">
          <Button
            variant="ghost"
            onClick={handleLeaveLobby}
            disabled={leaving || starting}
            className="w-full sm:w-auto text-text-muted hover:text-text-primary"
          >
            Batal & Keluar
          </Button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="primary"
              size="lg"
              onClick={handleStartExam}
              disabled={!agreed || !identityConfirmed || starting || !isOnline}
              isLoading={starting}
              rightIcon={!starting ? <ArrowRight className="w-4 h-4" /> : undefined}
              className="w-full sm:w-auto px-8 py-3 font-bold shadow-elevated"
            >
              {starting ? 'Memulai ujian...' : 'Mulai Ujian'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
