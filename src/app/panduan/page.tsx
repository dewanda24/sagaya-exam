'use client';

import React from 'react';
import Link from 'next/link';
import {
  KeyRound,
  GraduationCap,
  Eye,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Laptop,
  ArrowRight,
} from 'lucide-react';
import { PublicLayout } from '@/components/public/PublicLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { siteConfig } from '@/lib/content/publicContent';

export default function GuidePage() {
  const studentSteps = [
    {
      num: 1,
      title: 'Dapatkan Token Ujian Resmi',
      desc: 'Token berupa kode 8 karakter (contoh: A7K9-2M4P) yang dibagikan oleh panitia ujian atau pengawas ruang kelas Anda.',
    },
    {
      num: 2,
      title: 'Buka Halaman Ujian & Masukkan Token',
      desc: 'Akses halaman /ujian di peramban Anda, ketikkan 8 karakter token, atau gunakan tombol "Tempel Token".',
    },
    {
      num: 3,
      title: 'Periksa Informasi Ujian & Konfirmasi Identitas',
      desc: 'Pastikan nama Anda, NISN, nama mata pelajaran, dan alokasi durasi waktu yang tampil di layar sudah benar.',
    },
    {
      num: 4,
      title: 'Baca Petunjuk Pengerjaan & Cek Kesiapan',
      desc: 'Pahami ketentuan ujian, jumlah butir soal, dan pastikan indikator status perangkat menunjukkan bahwa Anda terhubung.',
    },
    {
      num: 5,
      title: 'Mulai Pengerjaan Soal',
      desc: 'Klik tombol "Mulai Ujian". Timer server akan mulai menghitung mundur durasi pengerjaan Anda secara otomatis.',
    },
    {
      num: 6,
      title: 'Pilih & Simpan Jawaban',
      desc: 'Klik opsi jawaban pilihan Anda. Sistem menyimpan setiap jawaban secara real-time ke server tanpa perlu menekan tombol simpan berulang-ulang.',
    },
    {
      num: 7,
      title: 'Periksa Lembar Jawaban & Submit Ujian',
      desc: 'Gunakan panel navigasi nomor soal untuk memeriksa butir soal yang belum terjawab. Jika sudah yakin, klik tombol "Selesaikan Ujian" dan konfirmasi.',
    },
  ];

  const teacherSteps = [
    {
      num: 1,
      title: 'Masuk ke Portal Pendidik',
      desc: 'Gunakan username dan kata sandi yang telah didaftarkan oleh admin sekolah untuk login ke portal.',
    },
    {
      num: 2,
      title: 'Penyusunan Butir Soal',
      desc: 'Buka menu "Bank Soal", klik "Tambah Soal", pilih salah satu dari 6 tipe soal yang tersedia, dan tambahkan rumus KaTeX jika diperlukan.',
    },
    {
      num: 3,
      title: 'Koreksi Soal Uraian (Essay)',
      desc: 'Setelah ujian selesai, buka menu "Koreksi Jawaban" untuk memberikan skor pada butir soal essay siswa berdasarkan rubrik penilaian.',
    },
    {
      num: 4,
      title: 'Telaah Analisis Butir Soal',
      desc: 'Periksa distribusi nilai, indeks kesukaran, dan daya pembeda butir soal pada menu Analitik untuk evaluasi pembelajaran lanjutan.',
    },
  ];

  const proctorSteps = [
    {
      num: 1,
      title: 'Login Akun Pengawas Ruang',
      desc: 'Masuk ke sistem menggunakan kredensial pengawas yang ditugaskan untuk sesi dan ruangan tersebut.',
    },
    {
      num: 2,
      title: 'Pantau Dasbor Ruangan Real-Time',
      desc: 'Lihat daftar peserta, verifikasi siswa yang sudah masuk (Mengerjakan), dan amati siswa yang belum hadir.',
    },
    {
      num: 3,
      title: 'Atasi Gangguan Peserta',
      desc: 'Jika siswa mengalami gangguan perangkat atau browser tertutup, gunakan tombol "Pulihkan Sesi" untuk mengizinkan login kembali pada perangkat yang sama.',
    },
    {
      num: 4,
      title: 'Kirim Pengumuman & Berita Acara',
      desc: 'Gunakan fitur broadcast pesan untuk mengingatkan sisa waktu, dan cetak Berita Acara Ruangan setelah seluruh siswa selesai.',
    },
  ];

  const adminSteps = [
    {
      num: 1,
      title: 'Persiapan Data Master',
      desc: 'Lakukan verifikasi data tahun ajaran aktif, daftar rombongan belajar (kelas), data guru pengampu, dan siswa terdaftar.',
    },
    {
      num: 2,
      title: 'Pembuatan Sesi & Ruang Ujian',
      desc: 'Tentukan tanggal pelaksanaan ujian, alokasi ruang laboratorium, penetapan kapasitas maksimal, dan pengawas bertugas.',
    },
    {
      num: 3,
      title: 'Pencetakan Kartu & Berita Acara',
      desc: 'Cetak kartu peserta ujian yang memuat token unik masing-masing siswa dan formulir daftar hadir ruangan.',
    },
    {
      num: 4,
      title: 'Publikasi Nilai Resmi',
      desc: 'Setelah proses koreksi guru tuntas, tetapkan status hasil ujian ke PUBLISHED agar siswa dapat melihat hasil kelulusan.',
    },
  ];

  return (
    <PublicLayout>
      {/* Page Header */}
      <section className="bg-surface border-b border-border py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-3">
          <Badge variant="primary">Petunjuk Operasional</Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
            Panduan Penggunaan {siteConfig.name}
          </h1>
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-2xl mx-auto">
            Petunjuk alur kerja langkah-demi-langkah bagi peserta didik, dewan guru,
            pengawas ruang ujian, dan administrator sekolah.
          </p>
        </div>
      </section>

      {/* Main Tabs Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <Tabs defaultValue="siswa">
          <TabsList className="w-full justify-start sm:justify-center mb-8">
            <TabsTrigger value="siswa" icon={<KeyRound className="w-3.5 h-3.5" />}>
              Panduan Siswa
            </TabsTrigger>
            <TabsTrigger value="guru" icon={<GraduationCap className="w-3.5 h-3.5" />}>
              Panduan Guru
            </TabsTrigger>
            <TabsTrigger value="pengawas" icon={<Eye className="w-3.5 h-3.5" />}>
              Panduan Pengawas
            </TabsTrigger>
            <TabsTrigger value="admin" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
              Admin Sekolah
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: SISWA */}
          <TabsContent value="siswa" className="space-y-6">
            <Alert variant="info" title="Penting Bagi Peserta Ujian">
              Pastikan Anda menggunakan peramban modern yang stabil (Chrome, Edge, Firefox, atau Safari).
              Jangan menutup jendela peramban selama waktu ujian berlangsung.
            </Alert>

            <div className="space-y-4">
              {studentSteps.map((step) => (
                <Card key={step.num} className="p-4 sm:p-5 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-700 font-black text-sm flex items-center justify-center shrink-0 border border-primary-200">
                    {step.num}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary">
                      {step.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </Card>
              ))}
            </div>

            <div className="text-center pt-4">
              <Link href="/ujian">
                <Button variant="primary" size="md" leftIcon={<KeyRound className="w-4 h-4" />}>
                  Buka Halaman Masuk Ujian
                </Button>
              </Link>
            </div>
          </TabsContent>

          {/* TAB 2: GURU */}
          <TabsContent value="guru" className="space-y-4">
            {teacherSteps.map((step) => (
              <Card key={step.num} className="p-4 sm:p-5 flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-800 font-black text-sm flex items-center justify-center shrink-0 border border-border">
                  {step.num}
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-text-primary">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* TAB 3: PENGAWAS */}
          <TabsContent value="pengawas" className="space-y-4">
            {proctorSteps.map((step) => (
              <Card key={step.num} className="p-4 sm:p-5 flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-800 font-black text-sm flex items-center justify-center shrink-0 border border-emerald-200">
                  {step.num}
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-text-primary">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* TAB 4: ADMIN SEKOLAH */}
          <TabsContent value="admin" className="space-y-4">
            {adminSteps.map((step) => (
              <Card key={step.num} className="p-4 sm:p-5 flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-800 font-black text-sm flex items-center justify-center shrink-0 border border-amber-200">
                  {step.num}
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-text-primary">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </PublicLayout>
  );
}
