'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Menu,
  ShieldCheck,
  ShieldAlert,
  Bell,
  Search,
  LogOut,
  User,
  Key,
  Laptop,
  CheckCircle2,
} from 'lucide-react';
import { SessionUser } from '@/lib/core/auth';
import { Breadcrumb, BreadcrumbItem } from '@/components/ui/Breadcrumb';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

interface SuperAdminHeaderProps {
  currentUser: SessionUser | null;
  setMobileOpen: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export default function SuperAdminHeader({
  currentUser,
  setMobileOpen,
  title,
  subtitle,
  breadcrumbs,
  actions,
}: SuperAdminHeaderProps) {
  const router = useRouter();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
          <span className="font-bold text-xs text-text-primary">
            {currentUser?.fullName || currentUser?.username || 'Super Administrator'}
          </span>
          <span className="text-[10px] text-primary-600 font-semibold">
            Superadmin Platform
          </span>
        </div>
      ),
      disabled: true,
      divider: true,
    },
    {
      id: 'security',
      label: 'Keamanan & Kata Sandi',
      icon: <Key className="w-4 h-4 text-text-secondary" />,
      onClick: () => router.push('/account/security'),
    },
    {
      id: 'sessions',
      label: 'Sesi Aktif Platform',
      icon: <Laptop className="w-4 h-4 text-text-secondary" />,
      onClick: () => router.push('/superadmin/security/sessions'),
      divider: true,
    },
    {
      id: 'logout',
      label: 'Keluar dari Akun',
      icon: <LogOut className="w-4 h-4 text-danger" />,
      variant: 'danger',
      onClick: () => setLogoutModalOpen(true),
    },
  ];

  return (
    <header className="h-16 bg-surface/95 backdrop-blur-md border-b border-border sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 no-print shadow-subtle">
      {/* Left: Mobile Toggle & Page Title / Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="lg:hidden min-touch-target rounded-md text-text-secondary hover:bg-slate-100 flex items-center justify-center transition"
          aria-label="Buka Menu Navigasi"
          aria-controls="main-sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <Breadcrumb items={breadcrumbs} showHome={false} className="mb-0.5" />
          ) : null}

          {title ? (
            <h1 className="text-base sm:text-lg font-bold text-text-primary tracking-tight truncate">
              {title}
            </h1>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary">Sagaya Platform</span>
              <Badge variant="primary" size="sm">Superadmin</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions, Security Status & User Menu */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {actions}

        {/* Security shortcut link */}
        <Link
          href="/superadmin/security"
          className="p-2 text-text-muted hover:text-text-primary hover:bg-slate-100 rounded-md transition"
          title="Security Center"
        >
          <ShieldAlert className="w-4 h-4" />
        </Link>

        {/* User Menu Dropdown */}
        <div className="pl-2 border-l border-divider">
          <Dropdown
            align="right"
            trigger={
              <button
                type="button"
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition text-left select-none"
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center border border-primary-200">
                  SA
                </div>
                <div className="hidden xl:flex flex-col text-right">
                  <span className="text-xs font-bold text-text-primary leading-tight">
                    {currentUser?.fullName || currentUser?.username || 'Superadmin'}
                  </span>
                  <span className="text-[10px] text-text-muted leading-tight">
                    Otoritas Platform
                  </span>
                </div>
              </button>
            }
            items={userMenuItems}
          />
        </div>
      </div>

      {/* Confirm Logout Dialog */}
      <ConfirmDialog
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="Keluar dari Akun Superadmin?"
        description="Sesi Anda saat ini akan dihentikan. Anda harus memasukkan kredensial kembali untuk mengakses platform."
        confirmLabel="Ya, Keluar"
        confirmVariant="danger"
        isLoading={loggingOut}
      />
    </header>
  );
}
