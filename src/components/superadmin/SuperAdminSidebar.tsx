'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  X,
  LayoutDashboard,
  Building2,
  CalendarCheck,
  CheckCheck,
  History,
  Sliders,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Megaphone,
  Users,
} from 'lucide-react';
import { SessionUser } from '@/lib/core/auth';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  badge?: string | null;
  exact?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface SuperAdminSidebarProps {
  currentUser: SessionUser | null;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function SuperAdminSidebar({
  currentUser,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: SuperAdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, setMobileOpen]);

  const navGroups: NavGroup[] = [
    {
      title: 'DASHBOARD',
      items: [
        {
          href: '/superadmin',
          label: 'Dashboard',
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      title: 'PLATFORM',
      items: [
        {
          href: '/superadmin/schools',
          label: 'Sekolah',
          icon: Building2,
        },
        {
          href: '/superadmin/users',
          label: 'User Platform',
          icon: Users,
        },
        {
          href: '/superadmin/questions',
          label: 'Bank Soal',
          icon: CheckCheck,
        },
        {
          href: '/superadmin/exams',
          label: 'Ujian Platform',
          icon: CalendarCheck,
        },
      ],
    },
    {
      title: 'KEAMANAN & AUDIT',
      items: [
        {
          href: '/superadmin/security',
          label: 'Security Center',
          icon: ShieldAlert,
          exact: true,
        },
        {
          href: '/superadmin/security/sessions',
          label: 'Sesi Aktif',
          icon: ShieldCheck,
        },
        {
          href: '/superadmin/audit',
          label: 'Audit Trail',
          icon: History,
        },
      ],
    },
    {
      title: 'OPERASIONAL & SISTEM',
      items: [
        {
          href: '/superadmin/emergency',
          label: 'Emergency',
          icon: Megaphone,
          badge: 'Live',
        },
        {
          href: '/superadmin/settings',
          label: 'Pengaturan',
          icon: Sliders,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="main-sidebar"
        role="navigation"
        aria-label="Navigasi Menu Superadmin"
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between h-screen max-h-screen bg-surface border-r border-border shadow-subtle transition-all duration-300 overflow-hidden ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-border shrink-0">
          <Link
            href="/superadmin"
            className={`flex items-center gap-2.5 overflow-hidden ${collapsed ? 'justify-center w-full' : ''}`}
          >
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white shadow-subtle shrink-0 font-bold text-sm">
              S
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-text-primary text-xs tracking-tight">
                  SAGAYA EXAM
                </span>
                <span className="text-[10px] text-text-muted font-bold tracking-normal leading-none">
                  Superadmin Platform
                </span>
              </div>
            )}
          </Link>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-slate-100 min-touch-target flex items-center justify-center"
            aria-label="Tutup menu navigasi"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Collapse Button */}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-slate-100 transition"
              title="Perkecil Menu"
              aria-label="Perkecil menu sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsed expand button */}
        {collapsed && (
          <div className="hidden lg:flex justify-center py-2 border-b border-divider shrink-0">
            <button
              onClick={() => setCollapsed(false)}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-slate-100 transition"
              title="Perbesar Menu"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Items List */}
        <div className="flex-1 py-3 px-3 space-y-4 overflow-y-auto">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {!collapsed && (
                <p className="px-2 text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (!item.exact && item.href !== '/superadmin' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-bold border border-primary-200/60 shadow-subtle'
                        : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
                    } ${collapsed ? 'justify-center px-0 py-2.5' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? 'text-primary-600' : 'text-text-muted group-hover:text-text-primary'
                      }`}
                    />
                    {!collapsed && (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer info in sidebar */}
        {!collapsed && (
          <div className="p-3 border-t border-divider shrink-0 text-[10px] text-text-muted flex justify-between items-center">
            <span>Sagaya CBT Engine</span>
            <span className="font-mono">v2.4.0</span>
          </div>
        )}
      </aside>
    </>
  );
}
