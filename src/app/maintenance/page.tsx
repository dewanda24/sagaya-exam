'use client';

import React from 'react';
import Link from 'next/link';
import { Wrench, RefreshCw, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { siteConfig } from '@/lib/content/publicContent';

export default function MaintenancePage() {
  return (
    <PublicLayout>
      <div className="py-20 sm:py-32 px-4 sm:px-6 max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-200 text-primary-600 flex items-center justify-center mx-auto">
          <Wrench className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <Badge variant="primary" size="sm">Pemeliharaan Terjadwal</Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Sistem Sedang Dalam Pemeliharaan
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            {siteConfig.name} sedang menjalani pemeliharaan berkala untuk peningkatan performa
            dan keamanan infrastruktur ujian. Silakan coba kembali setelah layanan tersedia.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-surface-subtle border border-border text-xs text-text-muted">
          Seluruh data bank soal, peserta, dan hasil ujian yang telah tersimpan tetap aman dan tidak terpengaruh.
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="md"
            onClick={() => window.location.reload()}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Periksa Kembali
          </Button>
          <Link href="/status">
            <Button variant="secondary" size="md">
              Lihat Status Sistem
            </Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
