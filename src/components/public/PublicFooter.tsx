'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Mail, HelpCircle, ExternalLink } from 'lucide-react';
import { siteConfig, publicNavItems } from '@/lib/content/publicContent';

export const PublicFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-surface border-t border-border mt-auto no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Col */}
          <div className="md:col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-subtle">
                S
              </div>
              <span className="font-extrabold text-lg tracking-tight text-text-primary">
                {siteConfig.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-md">
              {siteConfig.description}
            </p>
            <div className="flex items-center gap-2 text-xs text-text-muted mt-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Sistem Ujian Terisolasi & Terverifikasi Multi-Tenant</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Tautan Navigasi
            </p>
            <ul className="space-y-2 text-xs text-text-secondary">
              {publicNavItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="hover:text-primary-600 transition-colors inline-flex items-center gap-1"
                  >
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Assistance & Access */}
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Pusat Akses
            </p>
            <ul className="space-y-2 text-xs text-text-secondary">
              <li>
                <Link
                  href="/ujian"
                  className="hover:text-primary-600 transition-colors inline-flex items-center gap-1 font-semibold text-primary-600"
                >
                  <span>Portal Token Siswa</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-primary-600 transition-colors"
                >
                  <span>Masuk Guru & Pengawas</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/status"
                  className="hover:text-primary-600 transition-colors"
                >
                  <span>Status Infrastruktur Ujian</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/kontak"
                  className="hover:text-primary-600 transition-colors"
                >
                  <span>Pusat Bantuan & Laporan</span>
                </Link>
              </li>
            </ul>

            <div className="p-3 rounded-md bg-surface-subtle border border-border text-[11px] text-text-muted mt-2">
              <p className="font-semibold text-text-secondary">Butuh Bantuan Teknis?</p>
              <p className="mt-0.5 leading-relaxed">{siteConfig.supportNote}</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-divider flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <p>© {currentYear} {siteConfig.name}. Seluruh hak cipta dilindungi.</p>
          <div className="flex items-center gap-4 text-xs">
            <span>Sistem CBT Berstandar Akademik</span>
            <span className="text-slate-300">•</span>
            <Link href="/status" className="hover:text-text-primary transition">
              Status Sistem
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
