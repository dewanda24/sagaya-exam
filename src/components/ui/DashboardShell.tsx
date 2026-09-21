'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LogOut,
  Building2,
  Layers,
  BookOpen,
  Users,
  Calendar,
  ShieldCheck,
  FileCheck2,
  Edit3,
  BarChart3,
  AlertCircle,
  DoorOpen,
  Printer,
  Sparkles,
  LayoutDashboard,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Drawer } from './Drawer';
import { UserMenu } from './Avatar';
import { SessionUser } from '@/lib/core/auth';
import SchoolSwitcher from '@/components/admin/SchoolSwitcher';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number | null;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface DashboardShellProps {
  children: React.ReactNode;
  currentUser: SessionUser | null;
  navGroups?: NavGroup[];
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  children,
  currentUser,
  navGroups: customNavGroups,
  title,
  subtitle,
  actions,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sagaya_sidebar_collapsed');
    if (saved === 'true') {
      setCollapsed(true);
    }
  }, []);

  const handleToggleCollapse = (val: boolean) => {
    setCollapsed(val);
    localStorage.setItem('sagaya_sidebar_collapsed', String(val));
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  // Infer role & navigation groups if not explicitly provided
  const inferredRole = pathname.startsWith('/superadmin')
    ? 'SUPER_ADMIN'
    : pathname.startsWith('/guru')
    ? 'GURU'
    : pathname.startsWith('/pengawas')
    ? 'PENGAWAS'
    : 'ADMIN';

  const role = currentUser?.role || inferredRole;

  // Build standard role-aware navigation
  const defaultNavGroups: NavGroup[] = React.useMemo(() => {
    if (customNavGroups) return customNavGroups;

    if (role === 'SUPER_ADMIN') {
      return [
        {
          title: 'UTAMA',
          items: [
            { href: '/superadmin/dashboard', label: 'Dashboard Wilayah', icon: LayoutDashboard },
            { href: '/superadmin/schools', label: 'Daftar Sekolah', icon: Building2 },
            { href: '/superadmin/users', label: 'Pengguna Sistem', icon: Users },
          ],
        },
        {
          title: 'UJIAN & BANK SOAL',
          items: [
            { href: '/superadmin/kurasi-soal', label: 'Kurasi Bank Soal', icon: BookOpen },
            { href: '/superadmin/ujian-wilayah', label: 'Monitoring Wilayah', icon: ShieldCheck },
            { href: '/superadmin/analitik', label: 'Analitik & Hasil', icon: BarChart3 },
          ],
        },
        {
          title: 'SISTEM',
          items: [
            { href: '/superadmin/audit-logs', label: 'Log Audit Keamanan', icon: AlertCircle },
            { href: '/superadmin/settings', label: 'Pengaturan Global', icon: Settings },
          ],
        },
      ];
    }

    if (role === 'GURU') {
      return [
        {
          title: 'UTAMA',
          items: [
            { href: '/guru/dashboard', label: 'Dashboard Guru', icon: LayoutDashboard },
            { href: '/guru/bank-soal', label: 'Bank Soal Saya', icon: BookOpen },
          ],
        },
        {
          title: 'EVALUASI & NILAI',
          items: [
            { href: '/guru/koreksi-essay', label: 'Koreksi Jawaban', icon: Edit3 },
            { href: '/guru/nilai', label: 'Rekapitulasi Nilai', icon: FileCheck2 },
            { href: '/guru/analisis-soal', label: 'Analisis Butir Soal', icon: BarChart3 },
          ],
        },
      ];
    }

    if (role === 'PENGAWAS') {
      return [
        {
          title: 'OPERASIONAL RUANG',
          items: [
            { href: '/pengawas/dashboard', label: 'Kendali Pengawas', icon: LayoutDashboard },
            { href: '/pengawas/schedule', label: 'Jadwal Pengawasan', icon: Calendar },
            { href: '/pengawas/recovery', label: 'Pusat Pemulihan', icon: ShieldCheck },
          ],
        },
      ];
    }

    // Default: School Admin
    return [
      {
        title: 'UTAMA',
        items: [
          { href: '/admin/dashboard', label: 'Dashboard Admin', icon: LayoutDashboard },
        ],
      },
      {
        title: 'DATA AKADEMIK',
        items: [
          { href: '/admin/siswa', label: 'Siswa & Kelas', icon: Users },
          { href: '/admin/guru', label: 'Data Guru', icon: GraduationCap },
          { href: '/admin/mapel', label: 'Mata Pelajaran', icon: BookOpen },
          { href: '/admin/ruang-sesi', label: 'Ruang & Sesi', icon: DoorOpen },
        ],
      },
      {
        title: 'UJIAN & EVALUASI',
        items: [
          { href: '/admin/ujian', label: 'Jadwal Ujian', icon: Calendar },
          { href: '/admin/nilai', label: 'Hasil & Nilai', icon: FileCheck2 },
          { href: '/admin/cetak-kartu', label: 'Cetak Kartu Ujian', icon: Printer },
          { href: '/admin/berita-acara', label: 'Berita Acara', icon: Layers },
        ],
      },
      {
        title: 'PENGATURAN',
        items: [
          { href: '/admin/audit-logs', label: 'Log Audit', icon: AlertCircle },
          { href: '/admin/pengaturan', label: 'Pengaturan Sekolah', icon: Settings },
        ],
      },
    ];
  }, [role, customNavGroups]);

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full bg-surface border-r border-border select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-divider">
        <Link
          href="/"
          className={`flex items-center gap-2.5 font-extrabold text-text-primary tracking-tight transition ${
            collapsed && !isMobile ? 'justify-center w-full' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-primary-600 to-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-subtle">
            S
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-black text-text-primary">SAGAYA EXAM</span>
              <span className="text-[10px] text-primary-600 font-bold uppercase tracking-wider">
                {role === 'SUPER_ADMIN'
                  ? 'Super Admin'
                  : role === 'GURU'
                  ? 'Portal Pendidik'
                  : role === 'PENGAWAS'
                  ? 'Pengawas Ruang'
                  : 'Admin Sekolah'}
              </span>
            </div>
          )}
        </Link>

        {!isMobile && (
          <button
            type="button"
            onClick={() => handleToggleCollapse(!collapsed)}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-slate-100 transition hidden lg:flex"
            aria-label={collapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {defaultNavGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {(!collapsed || isMobile) && (
              <div className="px-3 text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                {group.title}
              </div>
            )}

            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/admin/dashboard' &&
                  item.href !== '/guru/dashboard' &&
                  item.href !== '/superadmin/dashboard' &&
                  item.href !== '/pengawas/dashboard' &&
                  pathname.startsWith(item.href));

              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => isMobile && setMobileOpen(false)}
                  title={collapsed && !isMobile ? item.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold transition-colors duration-150 outline-none
                    ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-bold shadow-2xs border border-primary-200/50'
                        : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary border border-transparent'
                    }
                    ${collapsed && !isMobile ? 'justify-center px-0' : ''}`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-primary-600' : 'text-text-muted'
                    }`}
                  />
                  {(!collapsed || isMobile) && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {(!collapsed || isMobile) && item.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-100 text-primary-800">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-divider">
        <button
          type="button"
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold text-danger hover:bg-danger-bg transition-colors ${
            collapsed && !isMobile ? 'justify-center px-0' : ''
          }`}
          title={collapsed && !isMobile ? 'Keluar' : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {(!collapsed || isMobile) && <span>Keluar Sistem</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex text-text-primary">
      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden lg:block fixed inset-y-0 left-0 z-30 transition-all duration-200 ${
          collapsed ? 'w-18' : 'w-64'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Navigation Drawer */}
      <Drawer
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        position="left"
        className="max-w-[280px]"
      >
        <SidebarContent isMobile />
      </Drawer>

      {/* Main Layout Canvas */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          collapsed ? 'lg:pl-18' : 'lg:pl-64'
        }`}
      >
        {/* Topbar */}
        <header className="h-16 bg-surface/90 backdrop-blur-md border-b border-border sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-subtle no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-md text-text-secondary hover:bg-slate-100 transition"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-text-primary truncate">
                {title || 'Portal Sagaya Exam'}
              </h1>
              {subtitle && (
                <p className="text-xs text-text-muted truncate hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>

            {/* SuperAdmin School Context Switcher */}
            {role === 'SUPER_ADMIN' && <SchoolSwitcher />}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {actions}

            {currentUser && (
              <UserMenu
                user={currentUser}
                onLogout={handleLogout}
              />
            )}
          </div>
        </header>

        {/* Workspace Content Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-150">
          {children}
        </main>
      </div>
    </div>
  );
};
