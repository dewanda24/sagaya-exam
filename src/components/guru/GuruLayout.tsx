'use client';

import { useState, useEffect } from 'react';
import GuruSidebar from './GuruSidebar';
import GuruHeader from './GuruHeader';
import { SessionUser } from '@/lib/core/auth';
import { BreadcrumbItem } from '@/components/ui/Breadcrumb';

interface GuruLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export default function GuruLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
  actions,
}: GuruLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    // Load persisted sidebar state
    const saved = localStorage.getItem('sagaya_guru_sidebar_collapsed');
    if (saved === 'true') {
      setCollapsed(true);
    }

    // Fetch session user
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser({
            id: data.user.id,
            username: data.user.username,
            fullName: data.user.name || data.user.fullName,
            role: data.user.role,
            schoolId: data.user.schoolId,
            schoolName: data.user.schoolName,
          });
        } else {
          setCurrentUser(null);
        }
      })
      .catch(console.error);
  }, []);

  const handleToggleCollapse = (val: boolean) => {
    setCollapsed(val);
    localStorage.setItem('sagaya_guru_sidebar_collapsed', String(val));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Accessible Skip Link for Keyboard Users */}
      <a href="#main-content" className="skip-to-content">
        Lewati ke konten utama
      </a>

      {/* Fixed Sidebar */}
      <GuruSidebar
        currentUser={currentUser}
        collapsed={collapsed}
        setCollapsed={handleToggleCollapse}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Workspace Area (Offset by sidebar width) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Top Header */}
        <GuruHeader
          currentUser={currentUser}
          setMobileOpen={setMobileOpen}
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          actions={actions}
        />

        {/* Content Canvas */}
        <main
          id="main-content"
          tabIndex={-1}
          role="main"
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200 outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
