import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import '../styles/cbt.css';
import '../styles/card-print.css';
import { ToastProvider } from '@/components/ui/Toast';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sagaya Exam - Sistem Ujian Online Berbasis Token',
  description:
    'Platform Ujian Online Sekolah Berbasis Token Unik. Akses publik, pengerjaan tanpa login akun siswa, auto-save real-time, timer server, dan dashboard pengawas.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className={plusJakartaSans.className}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
