'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  GraduationCap,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  ChevronLeft,
} from 'lucide-react';
import { useAuth, getDashboardUrlByRole } from '@/lib/hooks/useAuth';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user: currentUser, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/');
    router.refresh();
  };

  const isSubPage = pathname === '/ujian' || pathname === '/kartu';

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-xs no-print">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-15">
          {/* Brand Logo & School Identity */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-sm sm:text-base text-slate-900 leading-tight tracking-tight">
                Sagaya Exam
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 leading-none mt-0.5">
                Sistem Ujian Digital Sekolah
              </div>
            </div>
          </Link>

          {/* Right Area: Clean & Relevant */}
          <div className="flex items-center gap-2">
            {currentUser ? (
              /* If logged-in staff is visiting public page: Show discrete dashboard pill */
              <div className="flex items-center gap-2">
                <Link
                  href={getDashboardUrlByRole(currentUser.role)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition shadow-xs"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kembali ke</span>
                  <span>Dashboard ({currentUser.role})</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                  title="Logout Petugas"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : isSubPage ? (
              /* If student is on subpage (/ujian or /kartu): Show clean back-to-home */
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Beranda</span>
              </Link>
            ) : (
              /* On public home page for students: Clean & distraction-free badge */
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Portal Siswa</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
