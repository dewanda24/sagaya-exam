'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function PengawasIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/pengawas/dashboard');
  }, [router]);

  return (
    <PengawasLayout title="Ruang Kerja Pengawas" subtitle="Mengalihkan ke dasbor pengawas...">
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shadow-xs">
          <ShieldCheck className="w-8 h-8 animate-pulse" />
        </div>
        <div className="text-slate-800 font-bold text-base">Memuat Dasbor Pengawas...</div>
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    </PengawasLayout>
  );
}
