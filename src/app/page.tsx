'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  KeyRound,
  LogIn,
  Layers,
  CheckCircle2,
  BarChart3,
  BookOpen,
  Sparkles,
  Lock,
  RotateCw,
  Eye,
  Calculator,
  FileSpreadsheet,
  ArrowRight,
  Clock,
  Laptop,
  Check,
} from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  siteConfig,
  valueProps,
  examSteps,
  platformFeatures,
  securityHighlights,
  roleBenefits,
} from '@/lib/content/publicContent';

export default function HomePage() {
  const iconMap: Record<string, React.ReactNode> = {
    Layers: <Layers className="w-5 h-5 text-primary-600" />,
    ShieldCheck: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
    CheckCircle2: <CheckCircle2 className="w-5 h-5 text-primary-600" />,
    BarChart3: <BarChart3 className="w-5 h-5 text-primary-600" />,
    BookOpen: <BookOpen className="w-4 h-4 text-primary-600" />,
    Sparkles: <Sparkles className="w-4 h-4 text-amber-500" />,
    Lock: <Lock className="w-4 h-4 text-rose-500" />,
    RotateCw: <RotateCw className="w-4 h-4 text-blue-500" />,
    Eye: <Eye className="w-4 h-4 text-emerald-500" />,
    Calculator: <Calculator className="w-4 h-4 text-indigo-500" />,
    FileSpreadsheet: <FileSpreadsheet className="w-4 h-4 text-emerald-600" />,
  };

  return (
    <PublicLayout>
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-surface border-b border-border py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Copy */}
            <div className="lg:col-span-7 flex flex-col items-start gap-6">
              <Badge variant="primary" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                Sistem Ujian Digital Terstandarisasi
              </Badge>

              <div className="space-y-3">
                <h1 className="text-3xl sm:text-5xl font-extrabold text-text-primary tracking-tight leading-tight">
                  Platform Ujian Digital yang Aman, Terstruktur, dan Terpercaya.
                </h1>
                <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-2xl">
                  Kelola bank soal, pantau jalannya ujian secara langsung, dan hitung hasil dengan
                  skor server-side akurat. Didesain untuk kenyamanan pendidik dan peserta didik Indonesia.
                </p>
              </div>

              {/* Primary Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <Link href="/ujian">
                  <Button
                    variant="primary"
                    size="lg"
                    leftIcon={<KeyRound className="w-5 h-5" />}
                    className="w-full sm:w-auto shadow-sm"
                  >
                    Mulai Ujian Siswa
                  </Button>
                </Link>

                <Link href="/login">
                  <Button
                    variant="secondary"
                    size="lg"
                    leftIcon={<LogIn className="w-5 h-5" />}
                    className="w-full sm:w-auto"
                  >
                    Masuk Petugas & Guru
                  </Button>
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-divider text-xs text-text-muted">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Tanpa Akun Siswa Rumit</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Autosave Jawaban Real-Time</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Isolasi Data Sekolah</span>
                </div>
              </div>
            </div>

            {/* Right Product-Oriented Visual Showcase */}
            <div className="lg:col-span-5">
              <div className="relative rounded-xl border border-border bg-gradient-to-b from-surface-subtle to-surface p-5 shadow-elevated">
                {/* Mock UI Card: Exam Terminal Preview */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-divider">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-text-primary">
                        SESI UJIAN AKTIF
                      </span>
                    </div>
                    <Badge variant="neutral" size="sm">CBT-ROOM-01</Badge>
                  </div>

                  <div className="bg-surface rounded-lg p-4 border border-border space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-text-muted font-medium">Mata Pelajaran</p>
                        <p className="text-sm font-bold text-text-primary">Matematika Wajib XII</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-muted font-medium">Sisa Waktu</p>
                        <p className="text-sm font-mono font-bold text-primary-600">01:24:35</p>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary-600 h-1.5 rounded-full w-3/4 transition-all" />
                    </div>

                    <div className="flex justify-between text-[11px] text-text-muted font-semibold">
                      <span>Progres: 30 dari 40 Soal</span>
                      <span className="text-emerald-600">Tersimpan Otomatis</span>
                    </div>
                  </div>

                  {/* Operational Proctor Bar Preview */}
                  <div className="p-3 bg-surface rounded-lg border border-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary-600" />
                      <span className="font-semibold text-text-secondary">Monitoring Pengawas:</span>
                    </div>
                    <span className="font-bold text-emerald-600">36 Hadir • 0 Terputus</span>
                  </div>

                  <Link href="/ujian" className="block">
                    <Button variant="outline" size="sm" className="w-full justify-center text-xs">
                      Buka Terminal Peserta Ujian <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. VALUE PROPOSITION SECTION */}
      <section className="py-16 bg-surface-subtle border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Pilar Keandalan Sagaya Exam
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-2">
              Fondasi teknologi yang dirancang untuk mendukung kelancaran evaluasi pembelajaran berskala institusi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {valueProps.map((vp, idx) => (
              <Card key={idx} className="p-6 flex flex-col justify-between hover:shadow-md transition-all">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-md bg-surface-subtle border border-border flex items-center justify-center">
                    {iconMap[vp.icon] || <CheckCircle2 className="w-5 h-5 text-primary-600" />}
                  </div>
                  <h3 className="text-base font-bold text-text-primary">{vp.title}</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">{vp.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS (STEPPER TIMELINE) */}
      <section className="py-16 bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Alur Kerja Pelaksanaan Ujian
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-2">
              Siklus evaluasi terpadu dari penyusunan materi hingga pengolahan hasil akhir.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {examSteps.map((step) => (
              <div
                key={step.step}
                className="p-5 rounded-lg border border-border bg-surface-subtle/50 flex flex-col gap-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-primary-600 px-2 py-0.5 rounded bg-primary-50 border border-primary-200/60">
                    Langkah {step.step}
                  </span>
                </div>
                <h3 className="text-base font-bold text-text-primary">{step.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. KEY FEATURES SHOWCASE */}
      <section className="py-16 bg-surface-subtle border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Fitur Lengkap Platform
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-2">
              Mendukung seluruh kebutuhan asesmen sumatif, formatif, dan penilaian akhir sekolah.
            </p>
          </div>

          <div className="space-y-8">
            {platformFeatures.map((group, gIdx) => (
              <div key={gIdx} className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">
                  {group.category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {group.items.map((item, idx) => (
                    <Card key={idx} className="p-5 hover:border-border-hover transition">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-md bg-surface-subtle border border-border flex items-center justify-center shrink-0 mt-0.5">
                          {iconMap[item.icon] || <BookOpen className="w-4 h-4 text-primary-600" />}
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-text-primary">{item.title}</h4>
                          <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/fitur">
              <Button variant="secondary" size="md">
                Pelajari Seluruh Fitur <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 5. SECURITY SECTION (FACTUAL & VERIFIABLE) */}
      <section className="py-16 bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl p-8 sm:p-10 shadow-elevated border border-slate-700/50">
            <div className="flex items-center gap-2 mb-3 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Keamanan Sebagai Fondasi</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Arsitektur Teruji dan Bebas Kebocoran Jawaban
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 mb-6 leading-relaxed">
              Sagaya Exam menerapkan prinsip Zero-Client-Leakage di mana kunci jawaban dan rumus penilaian
              tidak pernah dikirimkan ke peramban siswa.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {securityHighlights.map((highlight, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{highlight}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. FOR SCHOOLS & ROLES */}
      <section className="py-16 bg-surface-subtle border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Dukungan Peran Sekolah
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-2">
              Setiap pemangku kepentingan memiliki antarmuka khusus yang disesuaikan dengan tanggung jawabnya.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {roleBenefits.map((rb, idx) => (
              <Card key={idx} className="p-6 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-text-primary">{rb.role}</h3>
                    <Badge variant="neutral" size="sm">{rb.badge}</Badge>
                  </div>
                  <ul className="space-y-2 text-xs text-text-secondary pt-2">
                    {rb.points.map((p, pIdx) => (
                      <li key={pIdx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-600 shrink-0 mt-1.5" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 7. PRIMARY CTA BANNER */}
      <section className="py-16 bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Siap Melaksanakan Ujian Digital Sekolah?
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary max-w-xl mx-auto leading-relaxed">
            Peserta dapat langsung mengakses lembar ujian menggunakan token yang telah dibagikan panitia,
            atau masuk ke portal manajemen jika Anda adalah petugas sekolah.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/ujian">
              <Button variant="primary" size="lg" leftIcon={<KeyRound className="w-5 h-5" />}>
                Mulai Ujian Sekarang
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg" leftIcon={<LogIn className="w-5 h-5" />}>
                Masuk ke Portal Petugas
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
