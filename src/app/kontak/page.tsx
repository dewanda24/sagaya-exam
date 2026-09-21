'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, HelpCircle, ShieldAlert, Building2, Clock, CheckCircle2 } from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { siteConfig } from '@/lib/content/publicContent';

export default function ContactPage() {
  const supportChannels = [
    {
      title: 'Kendala Saat Ujian Berlangsung',
      desc: 'Jika Anda adalah siswa yang mengalami masalah token tidak terbaca, koneksi terputus, atau perangkat mati saat ujian berlangsung.',
      actionText: 'Segera lapor langsung kepada Pengawas Ruangan yang bertugas di lokasi Anda.',
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      badge: 'Prioritas Langsung',
      variant: 'warning' as const,
    },
    {
      title: 'Akun Pendidik & Akses Guru',
      desc: 'Bagi guru atau proctor yang memerlukan reset kata sandi akun pendidik, penugasan mata pelajaran, atau jadwal sesi.',
      actionText: 'Silakan hubungi Tim Administrator / Kurikulum di satuan pendidikan sekolah Anda.',
      icon: <Building2 className="w-5 h-5 text-primary-600" />,
      badge: 'Internal Sekolah',
      variant: 'primary' as const,
    },
    {
      title: 'Laporan Kerentanan & Keamanan',
      desc: 'Jika Anda menemukan potensi celah keamanan atau bug teknis pada sistem Sagaya Exam.',
      actionText: `Kirimkan detail temuan secara bertanggung jawab ke ${siteConfig.supportEmail}.`,
      icon: <ShieldAlert className="w-5 h-5 text-rose-600" />,
      badge: 'Tim Pengembang',
      variant: 'danger' as const,
    },
  ];

  return (
    <PublicLayout>
      {/* Page Header */}
      <section className="bg-surface border-b border-border py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-3">
          <Badge variant="primary">Layanan Bantuan</Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Pusat Bantuan & Kontak
          </h1>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
            Temukan jalur komunikasi yang tepat sesuai dengan kebutuhan operasional dan teknis Anda.
          </p>
        </div>
      </section>

      {/* Main Support Grid */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {supportChannels.map((ch, idx) => (
            <Card key={idx} className="p-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-md bg-surface-subtle border border-border flex items-center justify-center">
                    {ch.icon}
                  </div>
                  <Badge variant={ch.variant} size="sm">{ch.badge}</Badge>
                </div>
                <h2 className="text-base font-bold text-text-primary leading-tight">
                  {ch.title}
                </h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {ch.desc}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-divider text-xs font-semibold text-text-primary bg-surface-subtle p-3 rounded-md">
                {ch.actionText}
              </div>
            </Card>
          ))}
        </div>

        {/* General Support Note */}
        <div className="p-6 rounded-lg bg-surface border border-border text-center space-y-2">
          <h3 className="text-sm font-bold text-text-primary">
            Informasi Operasional Sekolah
          </h3>
          <p className="text-xs text-text-muted leading-relaxed max-w-xl mx-auto">
            {siteConfig.name} dioperasikan secara terdistribusi oleh masing-masing satuan pendidikan.
            Seluruh data token, jadwal ujian, dan kartu peserta dikelola mandiri oleh panitia sekolah.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
