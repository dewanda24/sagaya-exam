'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  Lock,
  Cpu,
  Clock,
} from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { siteConfig } from '@/lib/content/publicContent';

interface SystemHealth {
  status: 'operational' | 'degraded' | 'maintenance';
  timestamp: string;
  services: {
    application: string;
    database: string;
    examEngine: string;
    authentication: string;
  };
  latencyMs?: number;
}

export default function StatusPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
      setLastChecked(new Date());
    } catch {
      setHealth({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          application: 'operational',
          database: 'degraded',
          examEngine: 'degraded',
          authentication: 'degraded',
        },
      });
      setLastChecked(new Date());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // 30s polling
    return () => clearInterval(interval);
  }, []);

  const serviceList = [
    {
      name: 'Aplikasi Web & Frontend Portal',
      desc: 'Antarmuka peserta didik, guru, pengawas, dan administrator',
      key: 'application' as const,
      icon: <Server className="w-4 h-4 text-primary-600" />,
    },
    {
      name: 'Layanan Autentikasi & Sesi Kriptografis',
      desc: 'Validasi token ujian, pengelolaan sesi cookie, dan kontrol RBAC',
      key: 'authentication' as const,
      icon: <Lock className="w-4 h-4 text-primary-600" />,
    },
    {
      name: 'Mesin Ujian & Autosave Real-Time',
      desc: 'Penyimpanan jawaban siswa, kontrol versioning, dan timer server',
      key: 'examEngine' as const,
      icon: <Cpu className="w-4 h-4 text-primary-600" />,
    },
    {
      name: 'Basis Data & Snapshot Penyimpanan',
      desc: 'Klaster basis data terisolasi multi-tenant dan pembekuan bank soal',
      key: 'database' as const,
      icon: <Database className="w-4 h-4 text-primary-600" />,
    },
  ];

  const isAllOperational = health?.status === 'operational';

  return (
    <PublicLayout>
      {/* Header Banner */}
      <section className="bg-surface border-b border-border py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-3">
          <Badge variant={isAllOperational ? 'success' : 'warning'} pulse>
            {isAllOperational ? 'Seluruh Sistem Normal' : 'Sebagian Layanan Terkendala'}
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Status Layanan {siteConfig.name}
          </h1>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-xl mx-auto">
            Informasi ketersediaan publik infrastruktur pelaksana ujian secara transparan dan real-time.
          </p>
        </div>
      </section>

      {/* Main Status Grid */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        {/* Overall Status Banner */}
        <div
          className={`p-6 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isAllOperational
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isAllOperational ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              {isAllOperational ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold">
                {isAllOperational
                  ? 'Semua Layanan Beroperasi Normal (Operational)'
                  : 'Sistem Mengalami Penurunan Performa (Degraded)'}
              </h2>
              <p className="text-xs opacity-80 mt-0.5">
                {lastChecked
                  ? `Pemeriksaan terakhir: ${lastChecked.toLocaleTimeString('id-ID')}`
                  : 'Sedang memeriksa...'}
                {health?.latencyMs ? ` • Waktu respons: ${health.latencyMs}ms` : ''}
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchStatus}
            isLoading={isLoading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Segarkan
          </Button>
        </div>

        {/* Services Status List */}
        <Card className="divide-y divide-border overflow-hidden">
          {serviceList.map((svc) => {
            const statusVal = health?.services?.[svc.key] || 'operational';
            const isSvcOp = statusVal === 'operational';

            return (
              <div key={svc.key} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-surface-subtle border border-border flex items-center justify-center shrink-0 mt-0.5">
                    {svc.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">{svc.name}</h3>
                    <p className="text-xs text-text-muted mt-0.5">{svc.desc}</p>
                  </div>
                </div>

                <Badge variant={isSvcOp ? 'success' : 'warning'} size="sm">
                  {isSvcOp ? 'Normal' : 'Terkendala'}
                </Badge>
              </div>
            );
          })}
        </Card>

        {/* Safety Note */}
        <div className="p-4 rounded-lg bg-surface-subtle border border-border text-center text-xs text-text-muted">
          Halaman ini diperbarui secara otomatis setiap 30 detik untuk memastikan pemantauan transparan
          bagi seluruh sekolah dan pengawas ruang ujian.
        </div>
      </div>
    </PublicLayout>
  );
}
