'use client';

import React, { useState, useEffect } from 'react';
import SuperAdminSidebar from './SuperAdminSidebar';
import SuperAdminHeader from './SuperAdminHeader';
import { SessionUser } from '@/lib/core/auth';
import { BreadcrumbItem } from '@/components/ui/Breadcrumb';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export default function SuperAdminLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
  actions,
}: SuperAdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('sagaya_superadmin_sidebar_collapsed');
    if (saved === 'true') {
      setCollapsed(true);
    }

    // Fetch current user session
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
    localStorage.setItem('sagaya_superadmin_sidebar_collapsed', String(val));
  };

  return (
    <div className="min-h-screen bg-surface-ground flex">
      {/* Accessible Skip Link for Keyboard Users */}
      <a href="#main-content" className="skip-to-content">
        Lewati ke konten utama
      </a>

      {/* Super Admin Dedicated Sidebar */}
      <SuperAdminSidebar
        currentUser={currentUser}
        collapsed={collapsed}
        setCollapsed={handleToggleCollapse}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Workspace Offset by Sidebar */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Top Header */}
        <SuperAdminHeader
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
          className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-150 outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
