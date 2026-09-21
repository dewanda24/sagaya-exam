'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  LogIn,
} from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { siteConfig } from '@/lib/content/publicContent';

function sanitizeRedirectUrl(url: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  // Ensure relative path starting with single slash, not // or /\
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    // Only allow known dashboard routes
    if (
      trimmed.startsWith('/superadmin') ||
      trimmed.startsWith('/admin') ||
      trimmed.startsWith('/guru') ||
      trimmed.startsWith('/pengawas') ||
      trimmed.startsWith('/account')
    ) {
      return trimmed;
    }
  }
  return '';
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = sanitizeRedirectUrl(searchParams.get('redirect'));
  const initialReason = searchParams.get('reason') || '';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (initialReason === 'session_expired') {
      return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
    }
    if (initialReason === 'session_revoked') {
      return 'Sesi Anda tidak lagi aktif. Silakan masuk kembali.';
    }
    if (initialReason === 'unauthorized') {
      return 'Akun Anda tidak memiliki izin untuk membuka halaman tersebut.';
    }
    return null;
  });
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Rate limit countdown ticker
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return;
    const interval = setInterval(() => {
      setRetryCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [retryCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retryCountdown !== null && retryCountdown > 0) return;

    if (!username.trim()) {
      setErrorMessage('Masukkan username atau email Anda.');
      return;
    }

    if (!password) {
      setErrorMessage('Masukkan kata sandi akun Anda.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          redirect: redirectParam || undefined,
        }),
      });

      const json = await res.json();

      if (res.status === 429) {
        const retrySec = Number(res.headers.get('Retry-After')) || 60;
        setRetryCountdown(retrySec);
        setErrorMessage(
          `Terlalu banyak percobaan masuk. Silakan coba kembali dalam ${retrySec} detik.`
        );
        return;
      }

      if (!res.ok || !json.success) {
        // Safe contextual error messages without account enumeration
        if (json.code === 'AUTH_ACCOUNT_SUSPENDED') {
          setErrorMessage('Akun Anda saat ini ditangguhkan. Silakan hubungi administrator sekolah.');
        } else if (json.code === 'AUTH_ACCOUNT_LOCKED') {
          setErrorMessage('Akun Anda terkunci karena alasan keamanan. Silakan hubungi administrator.');
        } else if (json.code === 'AUTH_ACCOUNT_INACTIVE') {
          setErrorMessage('Akun Anda belum aktif atau telah dinonaktifkan.');
        } else if (json.code === 'AUTH_RATE_LIMITED') {
          setErrorMessage('Terlalu banyak percobaan masuk. Silakan coba kembali beberapa saat lagi.');
        } else {
          setErrorMessage('Username atau kata sandi tidak valid.');
        }
        setPassword('');
        passwordInputRef.current?.focus();
      } else {
        // Successful staff login -> redirect based on server-authoritative role redirect
        const targetUrl = json.redirectUrl || redirectParam || '/admin/dashboard';
        router.push(targetUrl);
        router.refresh();
      }
    } catch {
      setErrorMessage('Tidak dapat terhubung ke server autentikasi. Periksa koneksi internet Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6 max-w-md mx-auto">
      {/* Header Info */}
      <div className="text-center mb-8 space-y-2">
        <Badge variant="primary" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
          Portal Petugas & Pendidik
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
          Masuk ke {siteConfig.name}
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
          Gunakan akun yang telah didaftarkan oleh administrator sekolah.
        </p>
      </div>

      {/* Login Card */}
      <Card className="p-6 sm:p-8 shadow-elevated border-border">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="text-xs font-semibold text-text-secondary tracking-normal flex items-center justify-between"
            >
              <span>Username atau Email</span>
              <span className="text-danger text-xs">*</span>
            </label>

            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
                <User className="w-4 h-4" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                disabled={isLoading || (retryCountdown !== null && retryCountdown > 0)}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="nama.pengguna"
                className="w-full text-sm text-text-primary bg-surface border border-border rounded-md min-h-[42px] pl-10 pr-3.5 py-2 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-500/15 transition disabled:bg-slate-50 disabled:text-text-muted"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-xs font-semibold text-text-secondary tracking-normal flex items-center gap-1"
              >
                <span>Kata Sandi</span>
                <span className="text-danger text-xs">*</span>
              </label>

              <Link
                href="/forgot-password"
                className="text-xs text-primary-600 hover:text-primary-700 font-semibold transition"
                tabIndex={-1}
              >
                Lupa kata sandi?
              </Link>
            </div>

            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
                <Lock className="w-4 h-4" />
              </div>
              <input
                ref={passwordInputRef}
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                disabled={isLoading || (retryCountdown !== null && retryCountdown > 0)}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="••••••••"
                className="w-full text-sm text-text-primary bg-surface border border-border rounded-md min-h-[42px] pl-10 pr-10 py-2 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-500/15 transition disabled:bg-slate-50 disabled:text-text-muted"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 p-1 rounded text-text-muted hover:text-text-primary transition"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <Alert
              variant={retryCountdown !== null ? 'warning' : 'danger'}
              onClose={() => setErrorMessage(null)}
            >
              {errorMessage}
            </Alert>
          )}

          {/* Submit Action */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            disabled={!username || !password || (retryCountdown !== null && retryCountdown > 0)}
            leftIcon={<LogIn className="w-4 h-4" />}
            className="w-full justify-center text-sm font-bold min-h-[44px]"
          >
            {isLoading
              ? 'Memproses...'
              : retryCountdown !== null && retryCountdown > 0
              ? `Tunggu (${retryCountdown}d)`
              : 'Masuk ke Sistem'}
          </Button>
        </form>

        {/* Security Notice */}
        <div className="mt-6 pt-5 border-t border-divider text-center text-xs text-text-muted leading-relaxed">
          Hak akses dan wewenang akun ditentukan otomatis oleh server berdasarkan peran yang terdaftar.
        </div>
      </Card>

      {/* Student Navigation Alternative */}
      <div className="text-center mt-6 text-xs text-text-muted">
        <span>Anda adalah peserta ujian (siswa)? </span>
        <Link href="/ujian" className="text-primary-600 font-bold hover:underline">
          Masuk dengan Token Ujian di sini
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <PublicLayout>
      <Suspense fallback={<div className="py-24 text-center text-text-muted">Memuat...</div>}>
        <LoginContent />
      </Suspense>
    </PublicLayout>
  );
}
