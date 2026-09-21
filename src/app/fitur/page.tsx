'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Layers,
  Users,
  ShieldCheck,
  BarChart3,
  Calculator,
  Lock,
  RotateCw,
  FileSpreadsheet,
  KeyRound,
  Eye,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { siteConfig } from '@/lib/content/publicContent';

export default function FeaturesPage() {
  const featureGroups = [
    {
      category: '1. Manajemen & Data Akademik',
      description: 'Pengelolaan hierarki kelembagaan, tahun ajaran, dan alokasi rombel sekolah.',
      items: [
        {
          title: 'Master Data Siswa & Kelas',
          desc: 'Pengelompokan siswa berdasarkan rombongan belajar, tingkat kelas, dan jurusan tanpa batas kuota lokal.',
          icon: <Users className="w-5 h-5 text-primary-600" />,
        },
        {
          title: 'Manajemen Mata Pelajaran',
          desc: 'Pemetaan guru pengampu dan kurikulum per mata pelajaran dengan penetapan Kriteria Ketuntasan Minimal (KKM).',
          icon: <BookOpen className="w-5 h-5 text-primary-600" />,
        },
        {
          title: 'Alokasi Ruang & Sesi Ujian',
          desc: 'Pengaturan kapasitas kursi laboratorium, penempatan proctor per ruangan, dan penjadwalan bertingkat.',
          icon: <Layers className="w-5 h-5 text-primary-600" />,
        },
      ],
    },
    {
      category: '2. Penyusunan Soal & Asesmen',
      description: 'Instrumen pembuatan soal berstandar kurikulum nasional dan asesmen AKM.',
      items: [
        {
          title: '6 Tipe Butir Soal Fleksibel',
          desc: 'Pilihan Ganda biasa, Pilihan Ganda Kompleks (multi-centang), Benar/Salah, Menjodohkan, Isian Singkat, dan Essay.',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
        },
        {
          title: 'Editor Formula Sains & KaTeX',
          desc: 'Dukungan notasi matematika lengkap untuk rumus aljabar, integral, matriks, dan simbol sains berkecepatan tinggi.',
          icon: <Sparkles className="w-5 h-5 text-amber-500" />,
        },
        {
          title: 'Immutable Exam Snapshot',
          desc: 'Soal dibekukan kekal saat sesi ujian dimulai sehingga kebal dari penyuntingan bank soal yang tidak disengaja.',
          icon: <Lock className="w-5 h-5 text-rose-500" />,
        },
      ],
    },
    {
      category: '3. Operasional Pengawasan & Peserta',
      description: 'Pemantauan real-time status pengerjaan siswa dan manajemen ruang ujian.',
      items: [
        {
          title: 'Akses Berbasis Token Kriptografis',
          desc: 'Siswa masuk menggunakan token terenkripsi 8 karakter unik yang diverifikasi secara server-authoritative.',
          icon: <KeyRound className="w-5 h-5 text-primary-600" />,
        },
        {
          title: 'Pusat Kendali Pengawas Ruangan',
          desc: 'Tampilan live status peserta (Mengerjakan, Terputus, Selesai), pengiriman pesan broadcast, dan reset sesi darurat.',
          icon: <Eye className="w-5 h-5 text-emerald-600" />,
        },
        {
          title: 'Autosave & Concurrency Lock',
          desc: 'Penyimpanan jawaban berkala setiap beberapa detik dengan nomor versi untuk mencegah konflik jaringan.',
          icon: <RotateCw className="w-5 h-5 text-blue-500" />,
        },
      ],
    },
    {
      category: '4. Penilaian, Analitik & Laporan',
      description: 'Pengolahan hasil evaluasi otomatis, scoring essay, dan pencetakan dokumen resmi.',
      items: [
        {
          title: 'Server-Side Scoring Engine',
          desc: 'Penghitungan skor instan dengan pembobotan benar, pengurangan penalti salah, dan batas nilai minimal.',
          icon: <Calculator className="w-5 h-5 text-indigo-500" />,
        },
        {
          title: 'Koreksi Essay Terstruktur',
          desc: 'Antarmuka khusus guru untuk membaca jawaban uraian siswa dan memberikan skor berdasarkan rubrik.',
          icon: <FileSpreadsheet className="w-5 h-5 text-amber-600" />,
        },
        {
          title: 'Analisis Butir Soal Pedagogis',
          desc: 'Perhitungan indeks kesukaran butir soal (mudah, sedang, sukar) dan daya pembeda berdasarkan hasil riil.',
          icon: <BarChart3 className="w-5 h-5 text-primary-600" />,
        },
      ],
    },
  ];

  return (
    <PublicLayout>
      {/* Page Header Banner */}
      <section className="bg-surface border-b border-border py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-3">
          <Badge variant="primary">Katalog Fitur</Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Fitur Lengkap {siteConfig.name}
          </h1>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
            Jelajahi kemampuan menyeluruh sistem kami yang dibangun untuk memberikan keadilan,
            kenyamanan, dan efisiensi dalam setiap tahapan evaluasi sekolah.
          </p>
        </div>
      </section>

      {/* Feature Groups List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {featureGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-4">
            <div className="border-b border-divider pb-2">
              <h2 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
                {group.category}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">{group.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {group.items.map((item, idx) => (
                <Card key={idx} className="p-5 flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="space-y-2.5">
                    <div className="w-9 h-9 rounded-md bg-surface-subtle border border-border flex items-center justify-center">
                      {item.icon}
                    </div>
                    <h3 className="text-sm font-bold text-text-primary">{item.title}</h3>
                    <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {/* CTA Footer */}
        <div className="p-8 rounded-xl bg-surface-subtle border border-border text-center space-y-4 max-w-2xl mx-auto mt-12">
          <h3 className="text-lg font-bold text-text-primary">Ingin Mencoba Pelaksanaan Ujian?</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            Peserta didik dapat langsung memulai pengerjaan menggunakan token ujian yang telah diberikan panitia sekolah.
          </p>
          <Link href="/ujian">
            <Button variant="primary" size="md" leftIcon={<KeyRound className="w-4 h-4" />}>
              Buka Halaman Ujian Siswa
            </Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
