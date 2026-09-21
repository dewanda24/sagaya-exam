'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/Button';

export default function ForbiddenPage() {
  return (
    <PublicLayout>
      <div className="py-20 sm:py-32 px-4 sm:px-6 max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-danger flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono font-bold text-danger uppercase tracking-wider">
            Akses Ditolak (403)
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Akses Tidak Tersedia
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Anda tidak memiliki izin untuk membuka halaman ini. Pastikan Anda telah masuk dengan akun yang sesuai.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/">
            <Button variant="secondary" size="md" leftIcon={<Home className="w-4 h-4" />}>
              Kembali ke Beranda
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="primary" size="md">
              Masuk Akun Lain
            </Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
