'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Key, LogOut, ChevronDown, User, Clock, ShieldCheck, Radio } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SessionUser } from '@/lib/core/auth';
import { Breadcrumb, BreadcrumbItem } from '@/components/ui/Breadcrumb';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';

interface PengawasHeaderProps {
  currentUser: SessionUser | null;
  setMobileOpen: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export default function PengawasHeader({
  currentUser,
  setMobileOpen,
  title,
  subtitle,
  breadcrumbs,
  actions,
}: PengawasHeaderProps) {
  const router = useRouter();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    } finally {
      setLoggingOut(false);
      setLogoutModalOpen(false);
    }
  };

  const userMenuItems: DropdownItem[] = [
    {
      id: 'profile-header',
      label: (
        <div className="flex flex-col py-1">
          <span className="font-bold text-xs text-slate-900">
            {currentUser?.fullName || currentUser?.username || 'Petugas Pengawas'}
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            @{currentUser?.username} &bull;{' '}
            <span className="text-emerald-700 font-bold uppercase">PENGAWAS</span>
          </span>
          {currentUser?.schoolName && (
            <span className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
              {currentUser.schoolName}
            </span>
          )}
        </div>
      ),
      disabled: true,
    },
    {
      id: 'divider-1',
      label: <div className="border-t border-slate-100 my-1" />,
      disabled: true,
    },
    {
      id: 'my-profile',
      label: 'Profil Pengawas',
      icon: <User className="w-4 h-4 text-slate-500" />,
      onClick: () => router.push('/pengawas/profile'),
    },
    {
      id: 'account-security',
      label: 'Keamanan Akun',
      icon: <Key className="w-4 h-4 text-slate-500" />,
      onClick: () => router.push('/account/security'),
    },
    {
      id: 'divider-2',
      label: <div className="border-t border-slate-100 my-1" />,
      disabled: true,
    },
    {
      id: 'logout',
      label: 'Keluar dari Akun',
      icon: <LogOut className="w-4 h-4 text-rose-500" />,
      variant: 'danger',
      onClick: () => setLogoutModalOpen(true),
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        {/* Top bar: Mobile hamburger, Breadcrumb, and User controls */}
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden min-touch-target rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition shrink-0"
              aria-label="Buka Menu Navigasi"
              aria-controls="main-sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Navigation */}
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <div className="hidden sm:block truncate">
                <Breadcrumb items={breadcrumbs} />
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span>Sagaya Exam</span>
                <span>/</span>
                <span className="text-slate-900 font-bold">Ruang Kerja Pengawas</span>
              </div>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Live Clock for Proctoring */}
            {currentTime && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200/80 shadow-2xs"
                title="Waktu Sistem Saat Ini"
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentTime}</span>
              </div>
            )}

            {/* Quick Action: Ujian Aktif */}
            <Link
              href="/pengawas/exams"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition shadow-2xs"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Ujian Aktif</span>
            </Link>

            {/* User Profile Dropdown Menu */}
            <Dropdown
              trigger={
                <button
                  className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition border border-transparent hover:border-slate-200 text-left outline-none"
                  aria-label="Menu Profil Pengawas"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                    {currentUser?.fullName
                      ? currentUser.fullName.charAt(0).toUpperCase()
                      : 'P'}
                  </div>
                  <div className="hidden md:flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                      {currentUser?.fullName || currentUser?.username || 'Pengawas'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                      {currentUser?.schoolName || 'Petugas Pengawas'}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              }
              items={userMenuItems}
              align="right"
            />
          </div>
        </div>

        {/* Optional Sub-header: Page Title, Subtitle, and Action Buttons */}
        {(title || actions) && (
          <div className="px-4 sm:px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4">
            <div>
              {title && (
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
          </div>
        )}
      </header>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="Konfirmasi Keluar Akun"
        description="Apakah Anda yakin ingin mengakhiri sesi kerja Pengawas saat ini? Anda harus memasukkan kredensial kembali untuk masuk."
        confirmLabel={loggingOut ? 'Memproses...' : 'Ya, Keluar'}
        cancelLabel="Batal"
        confirmVariant="danger"
        isLoading={loggingOut}
      />
    </>
  );
}
