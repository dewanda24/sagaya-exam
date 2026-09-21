'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password Policy Rules
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPolicySatisfied = hasMinLength && hasLetter && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setErrorMessage('Token reset kata sandi tidak ditemukan pada tautan.');
      return;
    }

    if (!isPolicySatisfied) {
      setErrorMessage('Pastikan kata sandi memenuhi seluruh ketentuan keamanan.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(
          json.error || 'Token reset telah kedaluwarsa atau tidak valid. Silakan ajukan ulang.'
        );
      } else {
        setIsSuccess(true);
      }
    } catch {
      setErrorMessage('Terjadi kendala koneksi saat memperbarui kata sandi.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="py-12 sm:py-20 px-4 sm:px-6 max-w-md mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-text-primary">Tautan Reset Tidak Lengkap</h1>
        <p className="text-xs text-text-secondary leading-relaxed">
          Tautan pemulihan kata sandi yang Anda buka tidak memuat token verifikasi yang valid.
        </p>
        <Link href="/forgot-password">
          <Button variant="primary" size="sm">
            Minta Tautan Pemulihan Baru
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6 max-w-md mx-auto">
      <div className="text-center mb-8 space-y-2">
        <Badge variant="primary" icon={<Lock className="w-3.5 h-3.5" />}>
          Pembaruan Keamanan
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
          Tetapkan Kata Sandi Baru
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
          Silakan masukkan kata sandi baru untuk akun petugas/pendidik Anda.
        </p>
      </div>

      <Card className="p-6 sm:p-8 shadow-elevated border-border">
        {isSuccess ? (
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-bold text-text-primary">
                Kata Sandi Berhasil Diperbarui
              </h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                Kata sandi baru Anda telah aktif. Seluruh sesi login lama pada perangkat lain telah dicabut.
              </p>
            </div>

            <div className="pt-2">
              <Link href="/login">
                <Button variant="primary" size="md" leftIcon={<ArrowRight className="w-4 h-4" />}>
                  Masuk Sekarang
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="new-password"
                className="text-xs font-semibold text-text-secondary tracking-normal flex items-center justify-between"
              >
                <span>Kata Sandi Baru</span>
                <span className="text-danger text-xs">*</span>
              </label>

              <div className="relative flex items-center">
                <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter..."
                  className="w-full text-sm text-text-primary bg-surface border border-border rounded-md min-h-[42px] pl-10 pr-10 py-2 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-500/15 transition disabled:bg-slate-50"
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

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="confirm-password"
                className="text-xs font-semibold text-text-secondary tracking-normal flex items-center justify-between"
              >
                <span>Konfirmasi Kata Sandi Baru</span>
                <span className="text-danger text-xs">*</span>
              </label>

              <div className="relative flex items-center">
                <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru..."
                  className="w-full text-sm text-text-primary bg-surface border border-border rounded-md min-h-[42px] pl-10 pr-3.5 py-2 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-500/15 transition disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Password Policy Checklist */}
            <div className="p-3.5 rounded-md bg-surface-subtle border border-border space-y-1.5 text-xs text-text-secondary">
              <p className="font-semibold text-[11px] text-text-primary mb-1">Ketentuan Keamanan:</p>
              <div className="flex items-center gap-2">
                {hasMinLength ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className={hasMinLength ? 'text-emerald-700 font-medium' : ''}>
                  Minimal 8 karakter
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasLetter ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className={hasLetter ? 'text-emerald-700 font-medium' : ''}>
                  Memuat huruf (a-z / A-Z)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasNumber ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className={hasNumber ? 'text-emerald-700 font-medium' : ''}>
                  Memuat angka (0-9)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {passwordsMatch ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className={passwordsMatch ? 'text-emerald-700 font-medium' : ''}>
                  Konfirmasi kata sandi cocok
                </span>
              </div>
            </div>

            {errorMessage && (
              <Alert variant="danger" onClose={() => setErrorMessage(null)}>
                {errorMessage}
              </Alert>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              disabled={!isPolicySatisfied}
              className="w-full justify-center text-sm font-bold min-h-[44px]"
            >
              Simpan Kata Sandi Baru
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <PublicLayout>
      <Suspense fallback={<div className="py-24 text-center text-text-muted">Memuat...</div>}>
        <ResetPasswordContent />
      </Suspense>
    </PublicLayout>
  );
}
