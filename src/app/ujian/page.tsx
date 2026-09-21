'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  KeyRound,
  ShieldCheck,
  ArrowRight,
  Clipboard,
  Wifi,
  WifiOff,
  Clock,
  AlertCircle,
  Laptop,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { formatTokenInput } from '@/lib/school/token-generator';

export default function StudentExamEntrancePage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [deviceId, setDeviceId] = useState('');
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Generate or retrieve stable device identifier
    let storedId = localStorage.getItem('sagaya_device_id');
    if (!storedId) {
      storedId = 'dev-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
      localStorage.setItem('sagaya_device_id', storedId);
    }
    setDeviceId(storedId);

    // Network check
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto focus input
    inputRef.current?.focus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Countdown timer for rate limiting
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return;
    const interval = setInterval(() => {
      setRetryCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [retryCountdown]);

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTokenInput(e.target.value);
    setToken(formatted);
    if (errorMessage) setErrorMessage(null);
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const cleaned = formatTokenInput(text);
          setToken(cleaned);
          setPasteSuccess(true);
          if (errorMessage) setErrorMessage(null);
          setTimeout(() => setPasteSuccess(false), 2000);
        }
      }
    } catch {
      // Clipboard access not granted or unavailable
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retryCountdown !== null && retryCountdown > 0) return;

    if (!token || token.length < 8) {
      setErrorMessage('Masukkan token ujian yang valid (contoh: ABCD-1234).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const activeDeviceId = deviceId || 'web-client-' + Math.random().toString(36).substring(2, 10);
      const res = await fetch('/api/exam/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': activeDeviceId,
        },
        body: JSON.stringify({
          token,
          deviceId: activeDeviceId,
        }),
      });

      const json = await res.json();

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After')) || 60;
        setRetryCountdown(retryAfter);
        setErrorMessage(
          `Terlalu banyak percobaan. Silakan coba kembali dalam ${retryAfter} detik.`
        );
        return;
      }

      if (!res.ok || !json.success) {
        // Safe contextual error presentation
        if (json.code === 'TOKEN_EXPIRED') {
          setErrorMessage('Token ujian sudah tidak dapat digunakan karena waktu sesi telah berakhir.');
        } else if (json.code === 'EXAM_NOT_ACTIVE') {
          setErrorMessage('Ujian saat ini belum dimulai atau sedang dinonaktifkan oleh panitia.');
        } else if (json.code === 'DEVICE_MISMATCH') {
          setErrorMessage('Perangkat Anda tidak sesuai dengan sesi ujian yang sudah terdaftar.');
        } else {
          setErrorMessage(
            json.error || 'Token tidak dapat digunakan. Periksa kembali token Anda atau hubungi pengawas ruangan.'
          );
        }
      } else {
        // Successful authentication -> navigate to lobby
        router.push('/exam/lobby');
      }
    } catch {
      setErrorMessage('Tidak dapat menghubungi server ujian. Pastikan koneksi internet Anda stabil.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-lg mx-auto">
        <div className="text-center mb-8 space-y-2">
          <Badge variant="primary" icon={<KeyRound className="w-3.5 h-3.5" />}>
            Terminal Peserta Didik
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Mulai Ujian Sekolah
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Masukkan token ujian 8-karakter yang tercantum pada kartu peserta atau yang dibagikan oleh pengawas ruang.
          </p>
        </div>

        <Card className="p-6 sm:p-8 shadow-elevated border-border">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Device & Readiness Bar */}
            <div className="flex items-center justify-between p-3 rounded-md bg-surface-subtle border border-divider text-xs">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-text-muted" />
                <span className="font-semibold text-text-secondary">Koneksi Perangkat</span>
              </div>
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                    <Wifi className="w-3.5 h-3.5" /> Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-danger font-bold">
                    <WifiOff className="w-3.5 h-3.5" /> Offline
                  </span>
                )}
              </div>
            </div>

            {/* Token Input Group */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="exam-token-input"
                  className="text-xs font-bold text-text-secondary uppercase tracking-wider"
                >
                  Token Ujian
                </label>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-xs text-primary-600 hover:text-primary-700 font-semibold inline-flex items-center gap-1 transition"
                  aria-label="Tempel token dari papan klip"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  <span>{pasteSuccess ? 'Tertempel!' : 'Tempel Token'}</span>
                </button>
              </div>

              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  id="exam-token-input"
                  type="text"
                  maxLength={9}
                  value={token}
                  onChange={handleTokenChange}
                  disabled={isLoading || (retryCountdown !== null && retryCountdown > 0)}
                  placeholder="ABCD-1234"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full text-center text-2xl sm:text-3xl font-mono font-black tracking-widest text-text-primary bg-surface border-2 border-border rounded-lg min-h-[56px] px-4 py-3 outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-500/15 transition-all uppercase placeholder:text-slate-300 placeholder:font-sans placeholder:tracking-normal disabled:bg-slate-50 disabled:text-text-muted"
                />
              </div>

              <p className="text-[11px] text-text-muted text-center">
                Format 8 karakter otomatis dirapikan (contoh: <strong>A7K9-2M4P</strong>)
              </p>
            </div>

            {/* Error / Rate Limit Alert */}
            {errorMessage && (
              <Alert
                variant={retryCountdown !== null ? 'warning' : 'danger'}
                onClose={() => setErrorMessage(null)}
              >
                {errorMessage}
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              disabled={!token || (retryCountdown !== null && retryCountdown > 0)}
              leftIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full justify-center text-sm font-bold min-h-[48px]"
            >
              {retryCountdown !== null && retryCountdown > 0
                ? `Tunggu (${retryCountdown}d)`
                : 'Verifikasi & Lanjutkan'}
            </Button>
          </form>

          {/* Secure Assurance Notice */}
          <div className="mt-6 pt-5 border-t border-divider flex items-start gap-2.5 text-xs text-text-muted">
            <Lock className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Token ujian Anda terenkripsi dan diverifikasi oleh server secara aman tanpa menyimpan
              identitas di URL peramban.
            </p>
          </div>
        </Card>

        {/* Assistance Link */}
        <div className="text-center mt-6 text-xs text-text-muted">
          <span>Belum memiliki token ujian? </span>
          <Link href="/panduan" className="text-primary-600 font-bold hover:underline">
            Baca panduan siswa
          </Link>
          <span> atau tanyakan ke pengawas ruang.</span>
        </div>
      </div>
    </PublicLayout>
  );
}
