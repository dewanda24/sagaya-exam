'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  CalendarCheck,
  ShieldAlert,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowRight,
  ShieldCheck,
  Megaphone,
  Laptop,
  Plus,
  FileCheck2,
  History,
  Lock,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

interface DashboardStats {
  metrics: {
    totalSchools: number;
    activeSchools: number;
    suspendedSchools: number;
    archivedSchools: number;
    totalUsers: number;
    totalAdmins: number;
    totalTeachers: number;
    totalProctors: number;
    totalStudents: number;
    activeStudents: number;
    totalExams: number;
    activeExams: number;
    runningExams: number;
    completedExams: number;
    regionalExams: number;
    activeSessions: number;
    failedLogins24h: number;
    lockedUsers: number;
    securityAlerts: number;
  };
  systemHealth: {
    status: string;
    database: string;
    uptime: string;
    timestamp: string;
  };
  recentActivities: Array<{
    id: string;
    action: string;
    severity: string;
    createdAt: string;
    actorName: string;
    actorRole: string;
    schoolName: string;
    details?: any;
  }>;
  activeExams: Array<{
    id: string;
    title: string;
    status: string;
    isRegional: boolean;
    startTime: string;
    endTime: string;
    schoolName: string;
    participantCount: number;
  }>;
}

export default function SuperAdminDashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/dashboard');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
      setLastRefreshed(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Failed to load superadmin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const metrics = data?.metrics;

  return (
    <SuperAdminLayout
      title="Dashboard"
      subtitle="Ringkasan kondisi platform Sagaya Exam"
      breadcrumbs={[{ label: 'Dashboard' }]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            isLoading={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          >
            <span>Segarkan</span>
            {lastRefreshed && (
              <span className="text-[10px] text-text-muted font-normal ml-1">({lastRefreshed})</span>
            )}
          </Button>

          <Link href="/superadmin/emergency">
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Megaphone className="w-3.5 h-3.5" />}
            >
              Emergency Hub
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Grid (Actual Data from Backend) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            title="Total Sekolah"
            value={loading ? '...' : (metrics?.totalSchools ?? 0)}
            subtitle={`${metrics?.activeSchools ?? 0} aktif`}
            icon={<Building2 className="w-5 h-5" />}
            color="primary"
          />

          <StatCard
            title="Sekolah Aktif"
            value={loading ? '...' : (metrics?.activeSchools ?? 0)}
            subtitle={
              metrics?.suspendedSchools
                ? `${metrics.suspendedSchools} ditangguhkan`
                : 'Semua operasional'
            }
            icon={<CheckCircle2 className="w-5 h-5" />}
            color="success"
          />

          <StatCard
            title="Total User Staf"
            value={loading ? '...' : (metrics?.totalUsers ?? 0)}
            subtitle={`${metrics?.totalTeachers ?? 0} guru & pengawas`}
            icon={<Users className="w-5 h-5" />}
            color="neutral"
          />

          <StatCard
            title="Ujian Aktif"
            value={loading ? '...' : (metrics?.activeExams ?? 0)}
            subtitle={`${metrics?.runningExams ?? 0} sedang berlangsung`}
            icon={<CalendarCheck className="w-5 h-5" />}
            color="primary"
          />

          <StatCard
            title="Sesi Aktif"
            value={loading ? '...' : (metrics?.activeSessions ?? 0)}
            subtitle="Sesi staf terikat"
            icon={<Laptop className="w-5 h-5" />}
            color="success"
          />

          <StatCard
            title="Peringatan Keamanan"
            value={loading ? '...' : (metrics?.securityAlerts ?? 0)}
            subtitle={`${metrics?.lockedUsers ?? 0} akun terkunci`}
            icon={<ShieldAlert className="w-5 h-5" />}
            color={metrics?.securityAlerts ? 'danger' : 'neutral'}
          />
        </div>

        {/* Platform Overview & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Platform Overview Card (2 cols) */}
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-divider">
              <div>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary-600" />
                  Ringkasan Ekosistem Platform
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Status distribusi tenant sekolah, staf pengajar, dan beban asesmen aktif
                </p>
              </div>
              <Badge variant="primary" size="sm">
                Database {data?.systemHealth?.database || 'CONNECTED'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              {/* School Distribution */}
              <div className="p-4 rounded-lg bg-surface-subtle border border-divider space-y-2">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                  Satuan Pendidikan
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Aktif</span>
                    <span className="font-bold text-emerald-600">{metrics?.activeSchools ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Ditangguhkan</span>
                    <span className="font-semibold text-amber-600">{metrics?.suspendedSchools ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Diarsipkan</span>
                    <span className="font-semibold text-text-secondary">{metrics?.archivedSchools ?? 0}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <Link
                    href="/superadmin/schools"
                    className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1"
                  >
                    Kelola Sekolah <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* User Distribution */}
              <div className="p-4 rounded-lg bg-surface-subtle border border-divider space-y-2">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                  Staf Pengguna
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Admin Sekolah</span>
                    <span className="font-semibold text-text-primary">{metrics?.totalAdmins ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Guru</span>
                    <span className="font-semibold text-text-primary">{metrics?.totalTeachers ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Pengawas</span>
                    <span className="font-semibold text-text-primary">{metrics?.totalProctors ?? 0}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <Link
                    href="/superadmin/users"
                    className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1"
                  >
                    Manajemen User <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Exam Distribution */}
              <div className="p-4 rounded-lg bg-surface-subtle border border-divider space-y-2">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                  Aktivitas Ujian
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Berlangsung</span>
                    <span className="font-bold text-emerald-600">{metrics?.runningExams ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Ujian Wilayah</span>
                    <span className="font-semibold text-primary-600">{metrics?.regionalExams ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Selesai</span>
                    <span className="font-semibold text-text-secondary">{metrics?.completedExams ?? 0}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <Link
                    href="/superadmin/exams"
                    className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1"
                  >
                    Tata Kelola Ujian <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Actions Card (1 col) */}
          <Card className="p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="pb-3 border-b border-divider">
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary-600" />
                  Aksi Cepat Platform
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Tindakan administratif dan penegakan tata kelola
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <Link
                  href="/superadmin/schools?action=create"
                  className="p-3 rounded-lg border border-border hover:border-primary-300 hover:bg-primary-50/50 transition flex items-center gap-2 font-semibold text-text-primary"
                >
                  <Plus className="w-4 h-4 text-primary-600" />
                  <span>Tambah Sekolah</span>
                </Link>

                <Link
                  href="/superadmin/users?action=create"
                  className="p-3 rounded-lg border border-border hover:border-primary-300 hover:bg-primary-50/50 transition flex items-center gap-2 font-semibold text-text-primary"
                >
                  <Plus className="w-4 h-4 text-primary-600" />
                  <span>Tambah User Staf</span>
                </Link>

                <Link
                  href="/superadmin/questions"
                  className="p-3 rounded-lg border border-border hover:border-primary-300 hover:bg-primary-50/50 transition flex items-center gap-2 font-semibold text-text-primary"
                >
                  <FileCheck2 className="w-4 h-4 text-primary-600" />
                  <span>Kurasi Bank Soal</span>
                </Link>

                <Link
                  href="/superadmin/security/sessions"
                  className="p-3 rounded-lg border border-border hover:border-primary-300 hover:bg-primary-50/50 transition flex items-center gap-2 font-semibold text-text-primary"
                >
                  <Laptop className="w-4 h-4 text-primary-600" />
                  <span>Sesi Aktif</span>
                </Link>

                <Link
                  href="/superadmin/security"
                  className="p-3 rounded-lg border border-border hover:border-primary-300 hover:bg-primary-50/50 transition flex items-center gap-2 font-semibold text-text-primary"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Security Center</span>
                </Link>

                <Link
                  href="/superadmin/audit"
                  className="p-3 rounded-lg border border-border hover:border-primary-300 hover:bg-primary-50/50 transition flex items-center gap-2 font-semibold text-text-primary"
                >
                  <History className="w-4 h-4 text-primary-600" />
                  <span>Audit Trail</span>
                </Link>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-divider">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Uptime Sistem</span>
                <span className="font-semibold text-text-primary">{data?.systemHealth?.uptime || '99.9%'}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Bottom 2-Col Grid: Recent Activity & Security Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Platform Activity */}
          <Card className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-divider">
              <div>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <History className="w-4 h-4 text-primary-600" />
                  Aktivitas Audit Terbaru
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Catatan jejak audit aksi administratif dan perubahan status sistem
                </p>
              </div>
              <Link
                href="/superadmin/audit"
                className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1"
              >
                Selengkapnya <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-divider pt-2">
              {data?.recentActivities && data.recentActivities.length > 0 ? (
                data.recentActivities.slice(0, 5).map((act) => (
                  <div key={act.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-primary">{act.action}</span>
                        <StatusBadge
                          status={act.severity === 'CRITICAL' ? 'failed' : act.severity === 'WARN' ? 'warning' : 'success'}
                          customLabel={act.severity}
                        />
                      </div>
                      <p className="text-text-muted">
                        Oleh <strong className="text-text-secondary">{act.actorName}</strong> ({act.actorRole})
                        {act.schoolName ? ` di ${act.schoolName}` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-muted font-mono shrink-0">
                      {act.createdAt ? new Date(act.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8">
                  <EmptyState
                    title="Belum Ada Aktivitas"
                    description="Belum ada catatan aktivitas audit baru yang tercatat."
                  />
                </div>
              )}
            </div>
          </Card>

          {/* Security Overview */}
          <Card className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-divider">
              <div>
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Ikhtisar Keamanan Platform
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Pemantauan anomali login, akun terkunci, dan integritas sesi
                </p>
              </div>
              <Link
                href="/superadmin/security"
                className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1"
              >
                Security Center <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3 pt-4 text-xs">
              <div className="p-3.5 rounded-lg bg-surface-subtle border border-divider flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-bold text-text-primary block">Percobaan Login Gagal (24 Jam)</span>
                  <span className="text-[11px] text-text-muted">Mendeteksi potensi percobaan tebak kata sandi</span>
                </div>
                <span className={`text-base font-extrabold ${metrics?.failedLogins24h ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {metrics?.failedLogins24h ?? 0}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-subtle border border-divider flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-bold text-text-primary block">Akun Staf Terkunci</span>
                  <span className="text-[11px] text-text-muted">Akun ditangguhkan otomatis akibat brute-force</span>
                </div>
                <span className={`text-base font-extrabold ${metrics?.lockedUsers ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {metrics?.lockedUsers ?? 0}
                </span>
              </div>

              <div className="p-3.5 rounded-lg bg-surface-subtle border border-divider flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-bold text-text-primary block">Sesi Staf Aktif</span>
                  <span className="text-[11px] text-text-muted">Total sesi token otentikasi yang sedang valid</span>
                </div>
                <span className="text-base font-extrabold text-primary-600">
                  {metrics?.activeSessions ?? 0}
                </span>
              </div>

              <div className="pt-2">
                <p className="text-[11px] text-text-muted">
                  Seluruh percobaan login yang gagal dan status akun terkunci diverifikasi langsung oleh PostgreSQL backend security engine.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
