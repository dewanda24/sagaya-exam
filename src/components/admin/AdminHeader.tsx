import React, { useState } from 'react';
import { Menu, Key, LogOut, ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import SchoolSwitcher from './SchoolSwitcher';
import { SessionUser } from '@/lib/core/auth';
import { Breadcrumb, BreadcrumbItem } from '@/components/ui/Breadcrumb';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';

interface AdminHeaderProps {
  currentUser: SessionUser | null;
  setMobileOpen: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export default function AdminHeader({
  currentUser,
  setMobileOpen,
  title,
  subtitle,
  breadcrumbs,
  actions,
}: AdminHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const inferredRole = pathname.startsWith('/guru')
    ? 'GURU'
    : pathname.startsWith('/pengawas')
    ? 'PENGAWAS'
    : 'ADMIN';
  const role = currentUser?.role || inferredRole;

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
            {currentUser?.fullName || currentUser?.username || 'Admin Sekolah'}
          </span>
          <span className="text-[10px] text-blue-600 font-semibold truncate max-w-[180px]">
            {currentUser?.schoolName || 'Sagaya Exam'}
          </span>
        </div>
      ),
      disabled: true,
      divider: true,
    },
    {
      id: 'security',
      label: 'Keamanan Akun',
      icon: <Key className="w-4 h-4 text-slate-500" />,
      onClick: () => router.push('/account/security'),
      divider: true,
    },
    {
      id: 'logout',
      label: 'Keluar dari Akun',
      icon: <LogOut className="w-4 h-4 text-rose-600" />,
      variant: 'danger',
      onClick: () => setLogoutModalOpen(true),
    },
  ];

  // Derive default title based on path if not provided
  const displayTitle =
    title ||
    (pathname.startsWith('/admin/dashboard')
      ? 'Dashboard'
      : pathname.startsWith('/admin/school')
      ? 'Profil Sekolah'
      : pathname.startsWith('/admin/academic-years')
      ? 'Tahun Ajaran'
      : pathname.startsWith('/admin/semesters')
      ? 'Semester'
      : pathname.startsWith('/admin/classes')
      ? 'Manajemen Kelas'
      : pathname.startsWith('/admin/subjects')
      ? 'Mata Pelajaran'
      : pathname.startsWith('/admin/users')
      ? 'User Management'
      : pathname.startsWith('/admin/students')
      ? 'Manajemen Siswa'
      : pathname.startsWith('/admin/teachers')
      ? 'Data Guru'
      : pathname.startsWith('/admin/proctors')
      ? 'Data Pengawas'
      : pathname.startsWith('/admin/question-bank')
      ? 'Bank Soal Sekolah'
      : pathname.startsWith('/admin/exams/schedule')
      ? 'Jadwal Ujian'
      : pathname.startsWith('/admin/exams')
      ? 'Manajemen Ujian'
      : pathname.startsWith('/admin/exam-rooms')
      ? 'Ruang Ujian'
      : pathname.startsWith('/admin/monitoring')
      ? 'Monitoring Ujian'
      : pathname.startsWith('/admin/results')
      ? 'Hasil Ujian'
      : pathname.startsWith('/admin/analytics')
      ? 'Analitik Sekolah'
      : pathname.startsWith('/admin/reports')
      ? 'Laporan'
      : pathname.startsWith('/admin/audit')
      ? 'Audit Aktivitas'
      : pathname.startsWith('/admin/settings')
      ? 'Pengaturan Sekolah'
      : 'Portal Administrasi');

  return (
    <>
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 no-print shadow-2xs">
        {/* Left side: Mobile Hamburger + Breadcrumb or Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 min-touch-target flex items-center justify-center transition"
            aria-label="Buka Menu Navigasi"
            aria-controls="main-sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <div className="mb-0.5">
                <Breadcrumb items={breadcrumbs} />
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                {displayTitle}
              </h1>
              {subtitle && (
                <span className="text-xs text-slate-400 font-medium truncate hidden md:inline">
                  — {subtitle}
                </span>
              )}
            </div>
          </div>

          {/* Multi-School Context Switcher (Only visible for Super Admin) */}
          {role === 'SUPER_ADMIN' && <SchoolSwitcher />}
        </div>

        {/* Right side: Page-Specific Actions + Active User Profile Pill with Dropdown */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {actions || null}

          {currentUser && (
            <Dropdown
              items={userMenuItems}
              align="right"
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-2.5 pl-3 border-l border-slate-200 py-1 hover:opacity-90 transition cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="text-left leading-tight hidden md:block">
                    <div className="text-xs font-black text-slate-800 truncate max-w-[140px]">
                      {currentUser.fullName || currentUser.username}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold tracking-wider">
                      {currentUser.role === 'GURU'
                        ? 'Tenaga Pendidik'
                        : currentUser.role === 'ADMIN'
                        ? 'Admin Sekolah'
                        : currentUser.role === 'PENGAWAS'
                        ? 'Pengawas Ruang'
                        : 'Super Admin'}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                </button>
              }
            />
          )}
        </div>
      </header>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="Konfirmasi Keluar Akun"
        description="Apakah Anda yakin ingin mengakhiri sesi kerja Admin Sekolah saat ini? Anda harus memasukkan kredensial kembali untuk masuk."
        confirmLabel={loggingOut ? 'Memproses...' : 'Ya, Keluar'}
        cancelLabel="Batal"
        confirmVariant="danger"
        isLoading={loggingOut}
      />
    </>
  );
}
