'use client';

import React from 'react';
import Link from 'next/link';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <PublicLayout>
      <div className="py-20 sm:py-32 px-4 sm:px-6 max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-surface-subtle border border-border flex items-center justify-center mx-auto text-text-muted">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-mono font-bold text-primary-600 uppercase tracking-wider">
            Kesalahan 404
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Halaman Tidak Ditemukan
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Halaman yang Anda cari mungkin sudah dipindahkan, dihapus, atau tautan yang dimasukkan tidak valid.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/">
            <Button variant="primary" size="md" leftIcon={<Home className="w-4 h-4" />}>
              Kembali ke Beranda
            </Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
