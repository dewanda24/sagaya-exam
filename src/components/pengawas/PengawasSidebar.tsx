'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  X,
  ShieldCheck,
  LayoutDashboard,
  Calendar,
  Radio,
  AlertTriangle,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { SessionUser } from '@/lib/core/auth';

interface PengawasSidebarProps {
  currentUser: SessionUser | null;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function PengawasSidebar({
  currentUser,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: PengawasSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

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

  const navGroups = [
    {
      title: 'UTAMA',
      items: [
        {
          href: '/pengawas/dashboard',
          aliases: ['/pengawas'],
          label: 'Dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'OPERASIONAL PENGAWASAN',
      items: [
        {
          href: '/pengawas/schedule',
          label: 'Jadwal Ujian',
          icon: Calendar,
        },
        {
          href: '/pengawas/exams',
          label: 'Ujian Aktif & Ruang',
          icon: Radio,
        },
        {
          href: '/pengawas/incidents',
          label: 'Pusat Insiden',
          icon: AlertTriangle,
        },
      ],
    },
    {
      title: 'PENGATURAN',
      items: [
        {
          href: '/pengawas/profile',
          label: 'Profil Pengawas',
          icon: User,
        },
      ],
    },
  ];

  const isItemActive = (item: { href: string; aliases?: string[] }) => {
    const itemPath = item.href.split('?')[0];
    if (pathname === itemPath) return true;
    if (item.aliases && item.aliases.includes(pathname)) return true;
    if (itemPath !== '/pengawas/dashboard' && itemPath !== '/pengawas' && pathname.startsWith(itemPath)) {
      return true;
    }
    return false;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="main-sidebar"
        role="navigation"
        aria-label="Navigasi Menu Pengawas"
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200/90 shadow-subtle transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
          <Link
            href="/pengawas/dashboard"
            className={`flex items-center gap-3 overflow-hidden ${collapsed ? 'justify-center w-full' : ''}`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-600/20 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-black text-base text-slate-900 tracking-tight flex items-center gap-1.5">
                  SAGAYA <span className="text-emerald-700 font-extrabold text-xs px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200/60">PENGAWAS</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 truncate">
                  {currentUser?.schoolName || 'Workspace Pengawas'}
                </span>
              </div>
            )}
          </Link>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 min-touch-target flex items-center justify-center"
            aria-label="Tutup menu navigasi"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Collapse Toggle */}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="hidden lg:flex w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 items-center justify-center transition"
              title="Persempit Sidebar"
              aria-label="Persempit Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Menus (Scrollable) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-5 scrollbar-thin">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!collapsed && (
                <h3 className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {group.title}
                </h3>
              )}
              <div className="space-y-0.5">
                {group.items.map((item, iIdx) => {
                  const active = isItemActive(item);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={iIdx}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 group ${
                        active
                          ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/50'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      } ${collapsed ? 'justify-center' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          active ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100 shrink-0 space-y-1">
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="w-full h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
              title="Perluas Sidebar"
              aria-label="Perluas Sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {!collapsed && (
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 mb-2">
              <div className="text-[11px] font-bold text-slate-900 truncate">
                {currentUser?.fullName || currentUser?.username || 'Petugas Pengawas'}
              </div>
              <div className="text-[10px] text-slate-500 truncate font-mono">
                @{currentUser?.username} • <span className="text-emerald-700 font-semibold">PENGAWAS</span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Keluar dari Akun"
            aria-label="Keluar dari Akun"
          >
            <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
