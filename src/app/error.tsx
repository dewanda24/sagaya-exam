'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error securely to console without rendering raw details to user
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md w-full p-8 rounded-xl bg-surface border border-border shadow-elevated space-y-6">
        <div className="w-14 h-14 rounded-full bg-rose-50 text-danger border border-rose-200 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono font-bold text-danger uppercase tracking-wider">
            Gangguan Sistem (500)
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
            Terjadi Gangguan pada Sistem
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Sistem mengalami masalah saat memproses permintaan Anda. Tim teknis telah menerima log insiden ini.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/">
            <Button variant="secondary" size="md" leftIcon={<Home className="w-4 h-4" />}>
              Beranda
            </Button>
          </Link>
          <Button
            variant="primary"
            size="md"
            onClick={() => reset()}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Coba Lagi
          </Button>
        </div>
      </div>
    </div>
  );
}
