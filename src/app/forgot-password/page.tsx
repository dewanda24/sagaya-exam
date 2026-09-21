'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, ShieldAlert, KeyRound } from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { siteConfig } from '@/lib/content/publicContent';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage('Masukkan username atau email Anda.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const json = await res.json();

      if (!res.ok && res.status === 429) {
        setErrorMessage('Terlalu banyak permintaan pemulihan. Silakan tunggu beberapa menit.');
        return;
      }

      // Generic confirmation regardless of whether user exists
      setIsSubmitted(true);
      if (json.devResetLink) {
        setDevResetLink(json.devResetLink);
      }
    } catch {
      setErrorMessage('Terjadi kendala saat memproses permintaan. Periksa koneksi internet Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="py-12 sm:py-20 px-4 sm:px-6 max-w-md mx-auto">
        <div className="text-center mb-8 space-y-2">
          <Badge variant="primary" icon={<KeyRound className="w-3.5 h-3.5" />}>
            Pemulihan Akun
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Lupa Kata Sandi?
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Masukkan username atau email akun petugas/guru Anda untuk menerima instruksi pemulihan.
          </p>
        </div>

        <Card className="p-6 sm:p-8 shadow-elevated border-border">
          {isSubmitted ? (
            <div className="space-y-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h2 className="text-base font-bold text-text-primary">
                  Permintaan Telah Diproses
                </h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Jika akun dengan username/email <strong>{identifier}</strong> terdaftar dan aktif,
                  informasi pemulihan kata sandi telah diproses melalui saluran resmi institusi Anda.
                </p>
              </div>

              {devResetLink && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-left text-xs text-blue-900 space-y-1">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-blue-600">
                    Mode Pengembangan (Development):
                  </span>
                  <p className="truncate font-mono text-[11px]">
                    <a href={devResetLink} className="text-primary-600 underline">
                      Buka Tautan Reset Kata Sandi
                    </a>
                  </p>
                </div>
              )}

              <div className="pt-2">
                <Link href="/login">
                  <Button variant="primary" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                    Kembali ke Halaman Masuk
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="identifier"
                  className="text-xs font-semibold text-text-secondary tracking-normal flex items-center justify-between"
                >
                  <span>Username atau Email</span>
                  <span className="text-danger text-xs">*</span>
                </label>

                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="identifier"
                    type="text"
                    required
                    disabled={isLoading}
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="nama.pengguna atau email@sekolah.sch.id"
                    className="w-full text-sm text-text-primary bg-surface border border-border rounded-md min-h-[42px] pl-10 pr-3.5 py-2 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-500/15 transition disabled:bg-slate-50"
                  />
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
                disabled={!identifier.trim()}
                leftIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full justify-center text-sm font-bold min-h-[44px]"
              >
                Kirim Permintaan Pemulihan
              </Button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-xs text-text-secondary hover:text-text-primary font-semibold inline-flex items-center gap-1 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Ingat kata sandi? Masuk di sini</span>
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </PublicLayout>
  );
}
