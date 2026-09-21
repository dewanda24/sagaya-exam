'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Shield,
  Key,
  Laptop,
  History,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  RefreshCw,
  LogOut,
  Building2,
  Calendar,
  Clock,
  ArrowLeft,
  XCircle,
  Copy,
  Check,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';

interface UserDetailData {
  user: {
    id: string;
    username: string;
    fullName: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'GURU' | 'PENGAWAS';
    schoolId?: string;
    schoolName?: string;
    schoolCode?: string;
    isActive: boolean;
    nip?: string;
    sessionVersion: number;
    mustChangePassword: boolean;
    failedLoginAttempts: number;
    lockedUntil?: string;
    lastLoginAt?: string;
    createdAt: string;
    updatedAt: string;
  };
  sessions: Array<{
    id: string;
    deviceName: string;
    browser: string;
    ipAddress: string;
    sessionVersion: number;
    createdAt: string;
    lastActivityAt: string;
    expiresAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    severity: string;
    createdAt: string;
    ipAddress?: string;
    userAgent?: string;
    details?: any;
  }>;
}

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const resolvedParams = use(params);
  const userId = resolvedParams.userId;
  const router = useRouter();

  const [data, setData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  // Action Modals
  const [confirmAction, setConfirmAction] = useState<{
    action: 'RESET_PASSWORD' | 'FORCE_LOGOUT' | 'DISABLE' | 'ENABLE' | 'UNLOCK' | null;
    title: string;
    description: string;
    variant: 'primary' | 'danger';
  }>({ action: null, title: '', description: '', variant: 'primary' });
  const [actionReason, setActionReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadUser = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/superadmin/users/${userId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal memuat profil pengguna.');
      }
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, [userId]);

  const handleExecuteAction = async () => {
    if (!confirmAction.action) return;

    setSubmittingAction(true);
    try {
      let res: Response;
      if (confirmAction.action === 'RESET_PASSWORD') {
        res = await fetch('/api/superadmin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'RESET_PASSWORD',
            userId,
            reason: actionReason || 'Permintaan reset password oleh Superadmin',
          }),
        });
      } else if (confirmAction.action === 'FORCE_LOGOUT') {
        res = await fetch('/api/superadmin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'FORCE_LOGOUT',
            userId,
            reason: actionReason || 'Pencabutan sesi paksa oleh Superadmin',
          }),
        });
      } else if (confirmAction.action === 'DISABLE') {
        res = await fetch('/api/superadmin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'DISABLE',
            userId,
            reason: actionReason || 'Penonaktifan akun oleh Superadmin',
          }),
        });
      } else if (confirmAction.action === 'ENABLE') {
        res = await fetch('/api/superadmin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ENABLE',
            userId,
          }),
        });
      } else {
        throw new Error('Aksi tidak didukung.');
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal mengeksekusi aksi.');

      if (confirmAction.action === 'RESET_PASSWORD' && json.tempPassword) {
        setTempPasswordResult(json.tempPassword);
      }

      setConfirmAction({ action: null, title: '', description: '', variant: 'primary' });
      setActionReason('');
      loadUser();
    } catch (err: any) {
      alert(err.message || 'Gagal memproses aksi.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Superadmin';
      case 'ADMIN':
        return 'Admin Sekolah';
      case 'GURU':
        return 'Guru Pengajar';
      case 'PENGAWAS':
        return 'Pengawas Ruang';
      default:
        return role || '-';
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout
        title="Detail Pengguna"
        breadcrumbs={[
          { label: 'Users', href: '/superadmin/users' },
          { label: 'Memuat...' },
        ]}
      >
        <div className="py-20 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
          <span>Memuat data profil pengguna platform...</span>
        </div>
      </SuperAdminLayout>
    );
  }

  if (error || !data) {
    return (
      <SuperAdminLayout
        title="Detail Pengguna"
        breadcrumbs={[
          { label: 'Users', href: '/superadmin/users' },
          { label: 'Error' },
        ]}
      >
        <div className="max-w-md mx-auto py-12">
          <Card className="p-6 text-center space-y-4">
            <XCircle className="w-10 h-10 text-danger mx-auto" />
            <h2 className="text-base font-bold text-text-primary">Pengguna Tidak Ditemukan</h2>
            <p className="text-xs text-text-muted">{error}</p>
            <Link href="/superadmin/users">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Kembali ke Daftar User
              </Button>
            </Link>
          </Card>
        </div>
      </SuperAdminLayout>
    );
  }

  const { user, sessions, auditLogs } = data;

  return (
    <SuperAdminLayout
      title={user.fullName}
      subtitle={`Detail identitas platform & profil keamanan (${user.username})`}
      breadcrumbs={[
        { label: 'Users', href: '/superadmin/users' },
        { label: user.username },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUser}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Segarkan
          </Button>

          {user.isActive ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() =>
                setConfirmAction({
                  action: 'DISABLE',
                  title: `Nonaktifkan Akun ${user.username}?`,
                  description:
                    'Pengguna ini tidak akan dapat login lagi ke platform sampai akun diaktifkan kembali.',
                  variant: 'danger',
                })
              }
            >
              Nonaktifkan Akun
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                setConfirmAction({
                  action: 'ENABLE',
                  title: `Aktifkan Kembali Akun ${user.username}?`,
                  description: 'Pengguna ini akan diizinkan kembali untuk login ke portal sistem.',
                  variant: 'primary',
                })
              }
            >
              Aktifkan Akun
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Temporary Password Result Alert */}
        {tempPasswordResult && (
          <Alert variant="warning" onClose={() => setTempPasswordResult(null)}>
            <div className="space-y-1">
              <p className="font-bold">Kata Sandi Sementara Berhasil Dibuat:</p>
              <div className="flex items-center gap-3">
                <code className="px-2.5 py-1 bg-surface rounded text-xs font-mono font-bold text-text-primary border border-border">
                  {tempPasswordResult}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPasswordResult);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-xs font-semibold text-primary-600 hover:underline inline-flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                Berikan kata sandi ini kepada pengguna terkait. Pengguna diwajibkan mengganti kata sandi pada login pertama.
              </p>
            </div>
          </Alert>
        )}

        {/* User Identity Header Card */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-lg border border-primary-100 shrink-0">
                {user.fullName.substring(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-text-primary">{user.fullName}</h1>
                  <Badge variant="primary" size="sm">
                    {getRoleLabel(user.role)}
                  </Badge>
                  <StatusBadge
                    status={user.isActive ? 'success' : 'failed'}
                    customLabel={user.isActive ? 'Aktif' : 'Nonaktif'}
                  />
                </div>
                <p className="text-xs text-text-muted">
                  Username: <strong className="text-text-secondary font-mono">{user.username}</strong>
                  {user.nip ? ` • NIP: ${user.nip}` : ''}
                  {user.schoolName ? ` • Satuan: ${user.schoolName}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setConfirmAction({
                    action: 'RESET_PASSWORD',
                    title: `Reset Kata Sandi ${user.username}?`,
                    description:
                      'Sistem akan menghasilkan kata sandi sementara yang aman dan mencabut semua sesi aktif akun ini.',
                    variant: 'primary',
                  })
                }
                leftIcon={<Key className="w-3.5 h-3.5" />}
              >
                Reset Kata Sandi
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setConfirmAction({
                    action: 'FORCE_LOGOUT',
                    title: `Cabut Semua Sesi Aktif ${user.username}?`,
                    description:
                      'Pengguna akan otomatis dikeluarkan (force logout) dari seluruh perangkat yang sedang login.',
                    variant: 'danger',
                  })
                }
                leftIcon={<LogOut className="w-3.5 h-3.5 text-danger" />}
              >
                Force Logout
              </Button>
            </div>
          </div>
        </Card>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-subtle border border-border rounded-lg overflow-x-auto">
          {[
            { id: 'profile', label: 'Profil Pengguna' },
            { id: 'security', label: `Keamanan (${sessions.length} Sesi)` },
            { id: 'sessions', label: 'Daftar Sesi Aktif' },
            { id: 'audit', label: `Jejak Audit (${auditLogs.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition shrink-0 ${
                activeTab === t.id
                  ? 'bg-surface text-primary-700 font-bold shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Profile */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-divider">
                Informasi Personal & Akun
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Nama Lengkap</span>
                  <span className="font-semibold text-text-primary">{user.fullName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Username</span>
                  <span className="font-mono font-bold text-text-primary">{user.username}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">NIP / Identitas</span>
                  <span className="font-mono text-text-secondary">{user.nip || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Peran Otoritas (Role)</span>
                  <span className="font-bold text-primary-700">{user.role}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Status Akun</span>
                  <span className={user.isActive ? 'text-emerald-600 font-bold' : 'text-danger font-bold'}>
                    {user.isActive ? 'Aktif (Dapat Login)' : 'Dinonaktifkan'}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-divider">
                Institusi & Riwayat Akun
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Satuan Pendidikan</span>
                  <span className="font-semibold text-text-primary">{user.schoolName || 'Platform Level'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Kode Sekolah</span>
                  <span className="font-mono text-text-secondary">{user.schoolCode || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Terdaftar Sejak</span>
                  <span className="text-text-secondary">
                    {new Date(user.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Pembaruan Terakhir</span>
                  <span className="text-text-secondary">
                    {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString('id-ID') : '-'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Login Terakhir</span>
                  <span className="font-mono text-text-secondary">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('id-ID') : 'Belum pernah'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 2: Security */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-divider flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-600" />
                Parameter Keamanan Akun
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Versi Sesi (session_version)</span>
                  <span className="font-mono font-bold text-text-primary">v{user.sessionVersion}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Wajib Ganti Password</span>
                  <span className={user.mustChangePassword ? 'text-amber-600 font-bold' : 'text-emerald-600 font-semibold'}>
                    {user.mustChangePassword ? 'Ya (Pending)' : 'Tidak'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-divider">
                  <span className="text-text-muted">Percobaan Gagal Berturut-turut</span>
                  <span className="font-bold text-text-primary">{user.failedLoginAttempts}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Status Penguncian</span>
                  <span className={user.lockedUntil ? 'text-rose-600 font-bold' : 'text-emerald-600 font-semibold'}>
                    {user.lockedUntil ? `Terkunci hingga ${new Date(user.lockedUntil).toLocaleTimeString('id-ID')}` : 'Tidak Terkunci'}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider pb-2 border-b border-divider flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary-600" />
                  Tindakan Keamanan Cepat
                </h3>
                <p className="text-xs text-text-muted mt-2 leading-relaxed">
                  Tindakan di bawah ini akan segera diterapkan ke backend database dan mencabut otorisasi token sesi yang ada.
                </p>
              </div>

              <div className="space-y-2.5 pt-4">
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs"
                  onClick={() =>
                    setConfirmAction({
                      action: 'RESET_PASSWORD',
                      title: `Reset Password ${user.username}`,
                      description: 'Hasilkan kata sandi sementara baru dan cabut seluruh sesi aktif.',
                      variant: 'primary',
                    })
                  }
                  leftIcon={<Key className="w-4 h-4 text-primary-600" />}
                >
                  Reset Kata Sandi Akun
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start text-xs text-danger hover:bg-danger/10"
                  onClick={() =>
                    setConfirmAction({
                      action: 'FORCE_LOGOUT',
                      title: `Revokasi Seluruh Sesi ${user.username}`,
                      description: 'Inkrementasi session_version dan paksa keluar dari semua browser.',
                      variant: 'danger',
                    })
                  }
                  leftIcon={<LogOut className="w-4 h-4 text-danger" />}
                >
                  Cabut Seluruh Sesi Aktif
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 3: Sessions */}
        {activeTab === 'sessions' && (
          <Card className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-divider">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Daftar Sesi Perangkat Aktif</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Sesi login aktif yang memegang token otentikasi valid
                </p>
              </div>
              <Badge variant="primary" size="sm">{sessions.length} Sesi Terdaftar</Badge>
            </div>

            <div className="divide-y divide-divider pt-2">
              {sessions.length > 0 ? (
                sessions.map((sess) => (
                  <div key={sess.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-surface-subtle border border-divider flex items-center justify-center text-text-muted shrink-0">
                        <Laptop className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="font-bold text-text-primary block">{sess.deviceName}</span>
                        <p className="text-text-muted text-[11px]">
                          Browser: {sess.browser} • IP: <span className="font-mono">{sess.ipAddress}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-[11px] space-y-0.5">
                      <span className="text-text-muted block">
                        Aktif: {new Date(sess.lastActivityAt).toLocaleTimeString('id-ID')}
                      </span>
                      <span className="text-emerald-600 font-semibold block">Valid (v{sess.sessionVersion})</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10">
                  <EmptyState
                    title="Tidak Ada Sesi Aktif"
                    description="Pengguna ini saat ini tidak memiliki sesi perangkat aktif di platform."
                  />
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Tab 4: Audit */}
        {activeTab === 'audit' && (
          <Card className="p-6">
            <div className="pb-4 border-b border-divider">
              <h3 className="text-sm font-bold text-text-primary">Jejak Audit Terkait Pengguna</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Aksi login, perubahan kata sandi, revokasi sesi, dan pembaruan profil yang tercatat di database
              </p>
            </div>

            <div className="divide-y divide-divider pt-2">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <div key={log.id} className="py-3.5 flex items-start justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-primary">{log.action}</span>
                        <StatusBadge
                          status={log.severity === 'CRITICAL' ? 'failed' : log.severity === 'WARN' ? 'warning' : 'success'}
                          customLabel={log.severity}
                        />
                      </div>
                      {log.details && (
                        <p className="text-text-muted text-[11px] font-mono">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-text-muted shrink-0 font-mono">
                      {new Date(log.createdAt).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-10">
                  <EmptyState
                    title="Belum Ada Log Audit"
                    description="Belum ada catatan aktivitas audit khusus untuk pengguna ini."
                  />
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Confirmation Dialog for Sensitive Actions */}
      <ConfirmDialog
        isOpen={!!confirmAction.action}
        onClose={() => setConfirmAction({ action: null, title: '', description: '', variant: 'primary' })}
        onConfirm={handleExecuteAction}
        title={confirmAction.title}
        description={confirmAction.description}
        confirmLabel="Ya, Lanjutkan"
        confirmVariant={confirmAction.variant}
        isLoading={submittingAction}
      />
    </SuperAdminLayout>
  );
}
