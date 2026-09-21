'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Clock, RefreshCw, Home } from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/Button';

function RateLimitContent() {
  const searchParams = useSearchParams();
  const retryParam = Number(searchParams.get('retry')) || 60;
  const [countdown, setCountdown] = useState(retryParam);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  return (
    <div className="py-20 sm:py-32 px-4 sm:px-6 max-w-md mx-auto text-center space-y-6">
      <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
        <Clock className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-mono font-bold text-amber-600 uppercase tracking-wider">
          Batas Permintaan (429)
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
          Terlalu Banyak Permintaan
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
          Sistem mendeteksi terlalu banyak percobaan dalam waktu singkat demi keamanan server ujian.
          Silakan tunggu beberapa saat sebelum mencoba kembali.
        </p>
      </div>

      {countdown > 0 ? (
        <div className="p-4 rounded-lg bg-surface-subtle border border-border inline-block">
          <span className="text-xs text-text-muted">Dapat mencoba kembali dalam: </span>
          <span className="text-sm font-mono font-bold text-primary-600">{countdown} detik</span>
        </div>
      ) : (
        <p className="text-xs font-semibold text-emerald-600">
          Waktu tunggu selesai. Anda dapat mencoba kembali sekarang.
        </p>
      )}

      <div className="flex items-center justify-center gap-3 pt-2">
        <Link href="/">
          <Button variant="secondary" size="md" leftIcon={<Home className="w-4 h-4" />}>
            Kembali ke Beranda
          </Button>
        </Link>
        <Button
          variant="primary"
          size="md"
          disabled={countdown > 0}
          onClick={() => window.location.reload()}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Muat Ulang
        </Button>
      </div>
    </div>
  );
}

export default function RateLimitPage() {
  return (
    <PublicLayout>
      <Suspense fallback={<div className="py-24 text-center text-text-muted">Memuat...</div>}>
        <RateLimitContent />
      </Suspense>
    </PublicLayout>
  );
}
