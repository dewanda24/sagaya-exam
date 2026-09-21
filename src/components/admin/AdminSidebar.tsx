'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  X,
  GraduationCap,
  LayoutDashboard,
  Building2,
  Layers,
  BookOpen,
  UserCheck,
  Users,
  Calendar,
  Printer,
  ShieldCheck,
  Award,
  FileCheck2,
  Edit3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  RotateCcw,
  DoorOpen,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { SessionUser } from '@/lib/core/auth';

interface AdminSidebarProps {
  currentUser: SessionUser | null;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function AdminSidebar({
  currentUser,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const inferredRole = pathname.startsWith('/guru')
    ? 'GURU'
    : pathname.startsWith('/pengawas')
    ? 'PENGAWAS'
    : 'ADMIN';
  const role = currentUser?.role || inferredRole;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isSchoolAdmin = role === 'ADMIN';
  const isTeacher = role === 'GURU';
  const isProctor = role === 'PENGAWAS';

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

  // Build role-specific navigation groups
  let navGroups: {
    title: string;
    items: {
      href: string;
      label: string;
      icon: any;
      badge: string | null;
    }[];
  }[] = [];

  if (isTeacher) {
    navGroups = [
      {
        title: 'UTAMA',
        items: [
          {
            href: '/guru/dashboard',
            label: 'Dashboard Guru',
            icon: LayoutDashboard,
            badge: null,
          },
          {
            href: '/guru/profile',
            label: 'Profil Saya',
            icon: UserCheck,
            badge: null,
          },
        ],
      },
      {
        title: 'AKADEMIK SAYA',
        items: [
          {
            href: '/guru/classes',
            label: 'Kelas Saya',
            icon: GraduationCap,
            badge: null,
          },
          {
            href: '/guru/subjects',
            label: 'Mata Pelajaran',
            icon: BookOpen,
            badge: null,
          },
        ],
      },
      {
        title: 'BANK SOAL & UJIAN',
        items: [
          {
            href: '/guru/questions',
            label: 'Bank Soal',
            icon: Layers,
            badge: null,
          },
          {
            href: '/guru/exams',
            label: 'Manajemen Ujian',
            icon: FileCheck2,
            badge: null,
          },
          {
            href: '/guru/monitoring',
            label: 'Monitoring Live',
            icon: ShieldCheck,
            badge: 'Live',
          },
        ],
      },
      {
        title: 'PENILAIAN & ANALITIK',
        items: [
          {
            href: '/guru/grading',
            label: 'Koreksi & Penilaian',
            icon: Edit3,
            badge: 'Essay',
          },
          {
            href: '/guru/results',
            label: 'Hasil Ujian Siswa',
            icon: Award,
            badge: null,
          },
          {
            href: '/guru/analytics',
            label: 'Analitik Butir Soal',
            icon: BarChart3,
            badge: null,
          },
        ],
      },
    ];
  } else if (isProctor) {
    navGroups = [
      {
        title: 'PENGAWASAN UTAMA',
        items: [
          {
            href: '/pengawas/dashboard',
            label: 'Dasbor Pengawas',
            icon: LayoutDashboard,
            badge: null,
          },
          {
            href: '/pengawas/schedule',
            label: 'Jadwal Pengawasan',
            icon: Calendar,
            badge: null,
          },
          {
            href: '/pengawas/exams',
            label: 'Ujian & Monitoring',
            icon: ShieldCheck,
            badge: 'Live',
          },
        ],
      },
      {
        title: 'OPERASIONAL RUANG',
        items: [
          {
            href: '/pengawas/incidents',
            label: 'Laporan Insiden',
            icon: AlertCircle,
            badge: null,
          },
          {
            href: '/pengawas/recovery',
            label: 'Pusat Recovery Sesi',
            icon: RotateCcw,
            badge: 'Darurat',
          },
          {
            href: '/admin/berita-acara',
            label: 'Presensi & BAPU Ruang',
            icon: FileCheck2,
            badge: 'BAPU',
          },
        ],
      },
    ];
  } else {
    navGroups = [
      {
        title: 'UTAMA',
        items: [
          {
            href: '/admin/dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            badge: null,
          },
        ],
      },
      {
        title: 'SEKOLAH',
        items: [
          {
            href: '/admin/school',
            label: 'Profil Sekolah',
            icon: Building2,
            badge: null,
          },
          {
            href: '/admin/academic-years',
            label: 'Tahun Ajaran',
            icon: Calendar,
            badge: null,
          },
          {
            href: '/admin/semesters',
            label: 'Semester',
            icon: Calendar,
            badge: null,
          },
          {
            href: '/admin/classes',
            label: 'Kelas',
            icon: Layers,
            badge: null,
          },
          {
            href: '/admin/subjects',
            label: 'Mata Pelajaran',
            icon: BookOpen,
            badge: null,
          },
        ],
      },
      {
        title: 'PENGGUNA',
        items: [
          {
            href: '/admin/users',
            label: 'User Management',
            icon: ShieldCheck,
            badge: null,
          },
          {
            href: '/admin/students',
            label: 'Siswa',
            icon: Users,
            badge: null,
          },
          {
            href: '/admin/teachers',
            label: 'Guru',
            icon: UserCheck,
            badge: null,
          },
          {
            href: '/admin/proctors',
            label: 'Pengawas',
            icon: UserCheck,
            badge: null,
          },
        ],
      },
      {
        title: 'UJIAN',
        items: [
          {
            href: '/admin/question-bank',
            label: 'Bank Soal',
            icon: BookOpen,
            badge: null,
          },
          {
            href: '/admin/exams',
            label: 'Ujian',
            icon: FileCheck2,
            badge: null,
          },
          {
            href: '/admin/exams/schedule',
            label: 'Jadwal',
            icon: Calendar,
            badge: null,
          },
          {
            href: '/admin/exam-rooms',
            label: 'Ruang Ujian',
            icon: DoorOpen,
            badge: null,
          },
          {
            href: '/admin/proctors/assignments',
            label: 'Penugasan Pengawas',
            icon: ShieldCheck,
            badge: null,
          },
        ],
      },
      {
        title: 'MONITORING',
        items: [
          {
            href: '/admin/monitoring',
            label: 'Ujian Berlangsung',
            icon: ShieldCheck,
            badge: 'Live',
          },
        ],
      },
      {
        title: 'HASIL & LAPORAN',
        items: [
          {
            href: '/admin/results',
            label: 'Hasil Ujian',
            icon: Award,
            badge: null,
          },
          {
            href: '/admin/analytics',
            label: 'Analitik',
            icon: BarChart3,
            badge: null,
          },
          {
            href: '/admin/reports',
            label: 'Laporan',
            icon: FileCheck2,
            badge: null,
          },
        ],
      },
      {
        title: 'SISTEM',
        items: [
          {
            href: '/admin/audit',
            label: 'Audit',
            icon: AlertCircle,
            badge: null,
          },
          {
            href: '/admin/settings',
            label: 'Pengaturan',
            icon: Edit3,
            badge: null,
          },
        ],
      },
    ];
  }

  const getRoleStyle = () => {
    switch (role) {
      case 'GURU':
        return {
          label: 'GURU',
          desc: 'Tenaga Pendidik',
          pillBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          iconGradient: 'from-emerald-500 to-teal-500',
          activeClass: 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/70 shadow-2xs',
          activeIcon: 'text-emerald-600',
        };
      case 'PENGAWAS':
        return {
          label: 'PENGAWAS',
          desc: 'Pengawas Ruang',
          pillBg: 'bg-amber-50 text-amber-700 border-amber-200',
          iconGradient: 'from-amber-500 to-orange-500',
          activeClass: 'bg-amber-50 text-amber-700 font-bold border border-amber-200/70 shadow-2xs',
          activeIcon: 'text-amber-600',
        };
      case 'SUPER_ADMIN':
        return {
          label: 'SUPER',
          desc: 'Platform Master',
          pillBg: 'bg-sky-50 text-sky-700 border-sky-200',
          iconGradient: 'from-sky-500 to-cyan-500',
          activeClass: 'bg-sky-50 text-sky-700 font-bold border border-sky-200/70 shadow-2xs',
          activeIcon: 'text-sky-600',
        };
      default:
        return {
          label: 'ADMIN',
          desc: 'Admin Sekolah',
          pillBg: 'bg-blue-50 text-blue-700 border-blue-200',
          iconGradient: 'from-blue-600 to-indigo-600',
          activeClass: 'bg-blue-50 text-blue-700 font-bold border border-blue-200/70 shadow-2xs',
          activeIcon: 'text-blue-600',
        };
    }
  };

  const style = getRoleStyle();

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container: Exact Match with Super Admin Aesthetic */}
      <aside
        id="main-sidebar"
        role="navigation"
        aria-label="Navigasi Menu Utama"
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between h-screen max-h-screen bg-white border-r border-slate-200/90 shadow-sm transition-all duration-300 overflow-hidden ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header (Compact h-14) */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50/70 via-white to-white shrink-0">
          <Link
            href={isTeacher ? '/guru/dashboard' : isProctor ? '/pengawas' : isSuperAdmin ? '/superadmin/dashboard' : '/admin/dashboard'}
            className={`flex items-center gap-2.5 overflow-hidden ${collapsed ? 'justify-center w-full' : ''}`}
          >
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${style.iconGradient} flex items-center justify-center text-white shadow-xs shrink-0`}>
              <GraduationCap className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-800 text-xs tracking-tight flex items-center gap-1">
                  SAGAYA EXAM
                  <Sparkles className="w-3 h-3 text-amber-500 fill-amber-400" />
                </span>
                <div className="flex items-center gap-1">
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${style.pillBg}`}>
                    {style.label}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium truncate">
                    {style.desc}
                  </span>
                </div>
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

          {/* Desktop Collapse Button */}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Perkecil Menu"
              aria-label="Perkecil menu sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Collapsed expand button */}
        {collapsed && (
          <div className="hidden lg:flex justify-center py-1 border-b border-slate-100 shrink-0">
            <button
              onClick={() => setCollapsed(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Perbesar Menu"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Items List: Clean & Scrollbar-Free */}
        <div className="flex-1 py-2 px-2.5 space-y-2.5 overflow-y-auto no-scrollbar">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-0.5">
              {!collapsed && (
                <p className="px-2 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin/dashboard' &&
                    item.href !== '/superadmin/dashboard' &&
                    item.href !== '/guru/dashboard' &&
                    pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? style.activeClass
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    } ${collapsed ? 'justify-center px-0 py-2' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive ? style.activeIcon : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    {!collapsed && (
                      <span className="flex-1 truncate text-xs">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                        item.badge === 'Live'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.badge === 'Darurat'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Quick link to Student Portal */}
          <div className="pt-2 border-t border-slate-100">
            {!collapsed && (
              <p className="px-2 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">
                PORTAL SISWA
              </p>
            )}
            <Link
              href="/ujian"
              target="_blank"
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition ${
                collapsed ? 'justify-center px-0 py-2' : ''
              }`}
              title={collapsed ? 'Buka Portal Ujian Siswa' : undefined}
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              {!collapsed && (
                <div className="flex items-center justify-between flex-1">
                  <span>Masuk Ujian Siswa</span>
                  <span className="text-[10px] text-slate-400">Tab Baru</span>
                </div>
              )}
            </Link>
          </div>
        </div>

        {/* Bottom Profile Row & Logout: Ultra-Compact & Elegant */}
        <div className="p-2 border-t border-slate-100 bg-slate-50/70 shrink-0">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${style.iconGradient} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs`}>
                  {currentUser?.fullName?.charAt(0) || 'A'}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">
                    {currentUser?.fullName || 'Pengguna'}
                  </p>
                  <p className="text-[9px] text-slate-400 truncate leading-tight">
                    {currentUser?.schoolName || 'Sagaya Exam'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                title="Keluar"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
