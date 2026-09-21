'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  KeyRound,
  LogIn,
  ChevronRight,
  LayoutDashboard,
  Shield,
  UserCheck,
} from 'lucide-react';
import { publicNavItems, siteConfig } from '@/lib/content/publicContent';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/hooks/useAuth';

export const PublicHeader: React.FC = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading } = useAuth();

  const getDashboardUrl = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return '/superadmin/dashboard';
      case 'ADMIN':
        return '/admin/dashboard';
      case 'GURU':
        return '/guru/dashboard';
      case 'PENGAWAS':
        return '/pengawas/dashboard';
      default:
        return '/dashboard';
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Superadmin';
      case 'ADMIN':
        return 'Admin Sekolah';
      case 'GURU':
        return 'Guru';
      case 'PENGAWAS':
        return 'Pengawas';
      default:
        return 'Staff';
    }
  };

  const dashboardUrl = user ? getDashboardUrl(user.role) : '/dashboard';

  return (
    <header className="bg-surface/95 backdrop-blur-md border-b border-border sticky top-0 z-40 shadow-subtle no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group select-none">
            <div className="w-9 h-9 rounded-md bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center font-black text-base shadow-subtle group-hover:scale-105 transition-transform shrink-0">
              S
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-text-primary leading-tight">
                {siteConfig.name}
              </span>
              <span className="text-[10px] text-text-muted font-bold tracking-normal leading-tight hidden sm:block">
                Sistem Ujian Digital Terstandarisasi
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {publicNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-bold border border-primary-200/60'
                      : 'text-text-secondary hover:text-text-primary hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right CTAs */}
          <div className="flex items-center gap-2.5">
            <Link href="/ujian">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<KeyRound className="w-3.5 h-3.5" />}
                className="hidden sm:inline-flex"
              >
                Mulai Ujian
              </Button>
            </Link>

            {/* Auth CTA based on server-side authoritative session */}
            {!isLoading && user ? (
              <Link href={dashboardUrl}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<LayoutDashboard className="w-3.5 h-3.5" />}
                >
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<LogIn className="w-3.5 h-3.5" />}
                >
                  Masuk
                </Button>
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-slate-100 md:hidden transition"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      <Drawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        title={siteConfig.name}
        position="right"
      >
        <div className="p-4 flex flex-col justify-between h-full space-y-6">
          <div className="space-y-4">
            {/* Authenticated user greeting card in drawer */}
            {user && (
              <div className="p-3 bg-surface-subtle border border-divider rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary">
                    {user.fullName || user.username}
                  </span>
                  <Badge variant="primary" size="sm">
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {user.schoolName || 'Sagaya Exam Official'}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                Navigasi Halaman
              </p>
              {publicNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-bold'
                        : 'text-text-secondary hover:bg-slate-100 hover:text-text-primary'
                    }`}
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-divider space-y-2.5">
            <Link href="/ujian" onClick={() => setMobileMenuOpen(false)} className="block w-full">
              <Button
                variant="outline"
                size="md"
                leftIcon={<KeyRound className="w-4 h-4" />}
                className="w-full justify-center"
              >
                Mulai Ujian Siswa
              </Button>
            </Link>

            {user ? (
              <Link href={dashboardUrl} onClick={() => setMobileMenuOpen(false)} className="block w-full">
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<LayoutDashboard className="w-4 h-4" />}
                  className="w-full justify-center"
                >
                  Buka Dashboard ({getRoleLabel(user.role)})
                </Button>
              </Link>
            ) : (
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block w-full">
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<LogIn className="w-4 h-4" />}
                  className="w-full justify-center"
                >
                  Masuk ke Portal
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Drawer>
    </header>
  );
};
