'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Target, Users, BookOpen, Check, ArrowRight } from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { siteConfig } from '@/lib/content/publicContent';

export default function AboutPage() {
  const principles = [
    {
      title: 'Integritas Akademik & Keamanan',
      desc: 'Setiap butir soal, kunci jawaban, dan algoritma penskoran diproses murni di sisi server untuk menjamin kejujuran dan mencegah kebocoran data ujian.',
    },
    {
      title: 'Kemudahan Akses Tanpa Hambatan',
      desc: 'Siswa masuk menggunakan token unik tanpa kerumitan lupa kata sandi akun, memungkinkan ujian massal dimulai serentak secara tertib.',
    },
    {
      title: 'Keandalan Multi-Tenant Terisolasi',
      desc: 'Mendukung pengelolaan banyak institusi pendidikan secara mandiri dengan segregasi basis data yang ketat antar sekolah.',
    },
    {
      title: 'Analitik Berbasis Data Nyata',
      desc: 'Memberikan wawasan pedagogis yang akurat kepada pendidik mengenai tingkat kesukaran dan daya pembeda butir soal.',
    },
  ];

  return (
    <PublicLayout>
      {/* Header Banner */}
      <section className="bg-surface border-b border-border py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-3">
          <Badge variant="primary">Tentang Platform</Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Mengenal Lebih Dekat {siteConfig.name}
          </h1>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
            Platform asesmen digital yang dirancang untuk mendukung ekosistem evaluasi pembelajaran
            di satuan pendidikan Indonesia secara profesional, aman, dan terstandarisasi.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        {/* Purpose & Approach */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
            Tujuan dan Pendekatan Kami
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Evaluasi pembelajaran merupakan tahapan krusial dalam siklus pendidikan. Kendala teknis seperti
            sistem yang lambat, kerumitan manajemen akun peserta didik, serta ketidakakuratan rekapitulasi nilai
            sering kali menyita waktu berharga para guru dan tenaga kependidikan.
          </p>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            {siteConfig.name} hadir dengan pendekatan terpusat: menyederhanakan alur masuk siswa melalui token unik
            yang aman, membekukan soal dalam snapshot kekal, dan memberikan pengawas ruangan instrumen pemantauan
            real-time yang responsif di berbagai perangkat.
          </p>
        </section>

        {/* Principles Grid */}
        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
            Prinsip Fundamental
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {principles.map((pr, idx) => (
              <Card key={idx} className="p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 text-xs font-bold flex items-center justify-center border border-primary-200">
                    {idx + 1}
                  </span>
                  <h3 className="text-sm font-bold text-text-primary">{pr.title}</h3>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed pl-8">
                  {pr.desc}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* User Roles */}
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
            Siapa yang Menggunakan {siteConfig.name}?
          </h2>
          <div className="p-6 rounded-lg bg-surface-subtle border border-border space-y-3 text-xs sm:text-sm text-text-secondary leading-relaxed">
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-text-primary">Admin Sekolah:</strong> Bertanggung jawab atas pengelolaan data master kelas, registrasi rombongan belajar, alokasi ruang ujian, dan sinkronisasi kurikulum.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-text-primary">Dewan Guru:</strong> Merancang butir soal, mengatur jadwal ujian, menilai jawaban essay secara objektif, dan mengkaji laporan daya pembeda soal.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-text-primary">Pengawas Ruang:</strong> Mengawasi jalannya sesi di laboratorium komputer atau ruang kelas, mengatasi insiden terputus, dan menandatangani berita acara resmi.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-text-primary">Peserta Didik:</strong> Menempuh evaluasi dalam lingkungan tes yang tenang, jernih, dan bebas dari gangguan teknis yang tidak perlu.
              </div>
            </div>
          </div>
        </section>

        {/* Action CTA */}
        <div className="p-6 rounded-lg bg-surface border border-border shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-text-primary">Mulai Eksplorasi Fitur</h3>
            <p className="text-xs text-text-muted mt-0.5">Pelajari kapabilitas lengkap platform penilaian Sagaya Exam.</p>
          </div>
          <Link href="/fitur">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Lihat Daftar Fitur
            </Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
