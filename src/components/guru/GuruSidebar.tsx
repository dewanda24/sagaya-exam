'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  X,
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  Layers,
  Users,
  FileQuestion,
  FileEdit,
  CheckCheck,
  Archive,
  Eye,
  Calendar,
  PlusCircle,
  Radio,
  Clock,
  Award,
  CheckCircle2,
  BarChart3,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { SessionUser } from '@/lib/core/auth';

interface GuruSidebarProps {
  currentUser: SessionUser | null;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function GuruSidebar({
  currentUser,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: GuruSidebarProps) {
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
          href: '/guru/dashboard',
          aliases: ['/guru'],
          label: 'Dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'MENGAJAR',
      items: [
        {
          href: '/guru/subjects',
          label: 'Mata Pelajaran',
          icon: BookOpen,
        },
        {
          href: '/guru/classes',
          label: 'Kelas & Siswa',
          icon: Layers,
        },
      ],
    },
    {
      title: 'BANK SOAL',
      items: [
        {
          href: '/guru/question-bank',
          aliases: ['/guru/bank-soal', '/guru/questions'],
          label: 'Semua Soal',
          icon: FileQuestion,
        },
        {
          href: '/guru/question-bank?status=DRAFT',
          label: 'Draft Soal',
          icon: FileEdit,
        },
        {
          href: '/guru/question-bank/review',
          label: 'Review Soal',
          icon: Eye,
        },
        {
          href: '/guru/question-bank?status=PUBLISHED',
          label: 'Soal Terbit',
          icon: CheckCheck,
        },
        {
          href: '/guru/question-bank?status=ARCHIVED',
          label: 'Arsip Soal',
          icon: Archive,
        },
      ],
    },
    {
      title: 'UJIAN',
      items: [
        {
          href: '/guru/exams',
          label: 'Ujian Saya',
          icon: Calendar,
        },
        {
          href: '/guru/exams/new',
          label: 'Buat Ujian',
          icon: PlusCircle,
        },
        {
          href: '/guru/exams/schedule',
          label: 'Jadwal Pelaksanaan',
          icon: Clock,
        },
        {
          href: '/guru/monitoring',
          label: 'Live Monitoring',
          icon: Radio,
        },
      ],
    },
    {
      title: 'PENILAIAN',
      items: [
        {
          href: '/guru/grading',
          label: 'Perlu Dinilai',
          icon: Award,
        },
        {
          href: '/guru/results',
          label: 'Hasil Nilai',
          icon: CheckCircle2,
        },
      ],
    },
    {
      title: 'ANALITIK',
      items: [
        {
          href: '/guru/analytics',
          label: 'Analitik Ujian',
          icon: BarChart3,
        },
      ],
    },
    {
      title: 'PROFIL',
      items: [
        {
          href: '/guru/profile',
          label: 'Pengaturan Profil',
          icon: User,
        },
      ],
    },
  ];

  const isItemActive = (item: { href: string; aliases?: string[] }) => {
    const itemPath = item.href.split('?')[0];
    if (pathname === itemPath) return true;
    if (item.aliases && item.aliases.includes(pathname)) return true;
    if (itemPath !== '/guru/dashboard' && itemPath !== '/guru' && pathname.startsWith(itemPath)) {
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
        aria-label="Navigasi Menu Guru"
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200/90 shadow-subtle transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
          <Link
            href="/guru/dashboard"
            className={`flex items-center gap-3 overflow-hidden ${collapsed ? 'justify-center w-full' : ''}`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/20 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-black text-base text-slate-900 tracking-tight flex items-center gap-1.5">
                  SAGAYA <span className="text-blue-600 font-extrabold text-xs px-1.5 py-0.5 rounded bg-blue-50">GURU</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 truncate">
                  {currentUser?.schoolName || 'Teaching Workspace'}
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
              aria-label="Persempit menu sidebar"
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
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      } ${collapsed ? 'justify-center' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
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
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {!collapsed && (
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 mb-2">
              <div className="text-[11px] font-bold text-slate-900 truncate">
                {currentUser?.fullName || 'Pengajar'}
              </div>
              <div className="text-[10px] text-slate-500 truncate font-mono">
                @{currentUser?.username} • GURU
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Keluar dari Akun"
          >
            <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
            {!collapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
