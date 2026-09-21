'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import {
  User as UserIcon,
  ShieldCheck,
  KeyRound,
  LogOut,
  Power,
  Activity,
  ArrowLeft,
  Clock,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  Building2,
} from 'lucide-react';
import { User } from '@/lib/core/types';

export default function SchoolUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SECURITY' | 'ACTIVITY' | 'SESSIONS'>('PROFILE');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sensitive Action Modals
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: 'TOGGLE_STATUS' | 'RESET_PASSWORD' | 'FORCE_LOGOUT';
    title: string;
    description: string;
    confirmLabel: string;
    confirmVariant: 'danger' | 'warning' | 'primary';
  }>({
    isOpen: false,
    action: 'TOGGLE_STATUS',
    title: '',
    description: '',
    confirmLabel: '',
    confirmVariant: 'danger',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUser = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setUser(json.data);
      } else {
        setUser(null);
      }
    } catch {
      showToast('Koneksi server terputus.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchUser();
  }, [userId]);

  const handleExecuteAction = async () => {
    if (!user) return;
    setIsProcessing(true);

    try {
      if (confirmDialog.action === 'TOGGLE_STATUS') {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            action: 'TOGGLE_STATUS',
            isActive: !user.isActive,
          }),
        });
        const json = await res.json();
        if (json.success) {
          showToast(json.message);
          fetchUser();
        } else {
          showToast(json.error || 'Gagal mengubah status akun.', 'error');
        }
      } else if (confirmDialog.action === 'RESET_PASSWORD') {
        const passwordToSend = tempPassword.trim() || undefined;
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            action: 'RESET_PASSWORD',
            newPassword: passwordToSend,
          }),
        });
        const json = await res.json();
        if (json.success) {
          showToast('Kata sandi berhasil direset.');
          if (json.tempPassword) {
            setGeneratedPassword(json.tempPassword);
          }
          fetchUser();
        } else {
          showToast(json.error || 'Gagal mereset kata sandi.', 'error');
        }
      } else if (confirmDialog.action === 'FORCE_LOGOUT') {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            action: 'FORCE_LOGOUT',
          }),
        });
        const json = await res.json();
        if (json.success) {
          showToast('Sesi pengguna berhasil direvoke.');
          fetchUser();
        } else {
          showToast(json.error || 'Gagal revoke sesi pengguna.', 'error');
        }
      }
    } catch {
      showToast('Terjadi kesalahan sistem.', 'error');
    } finally {
      setIsProcessing(false);
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      setTempPassword('');
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Detail Pengguna">
        <div className="p-12 text-center text-slate-400 text-xs">
          Memuat data pengguna...
        </div>
      </AdminLayout>
    );
  }

  if (!user) {
    return (
      <AdminLayout title="Detail Pengguna">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <UserIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">Pengguna Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 mt-1">
            Pengguna tidak terdaftar pada sekolah ini atau akun merupakan pengguna tingkat platform.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push('/admin/users')}
          >
            Kembali ke User Management
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={`Pengguna: ${user.fullName}`}
      subtitle={`Role: ${user.role} • Satuan Pendidikan`}
      breadcrumbs={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'User Management', href: '/admin/users' },
        { label: user.fullName },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => router.push('/admin/users')}
        >
          Kembali
        </Button>
      }
    >
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all animate-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* User Hero Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xl shrink-0">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    {user.fullName}
                  </h1>
                  <Badge variant="primary" size="sm">
                    {user.role}
                  </Badge>
                  <StatusBadge status={user.isActive ? 'ACTIVE' : 'DRAFT'} size="sm" />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Username: <strong className="font-mono text-slate-800">{user.username}</strong>
                  {user.nip && ` • NIP: ${user.nip}`}
                </p>
              </div>
            </div>

            {/* Sensitive Action Triggers */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<KeyRound className="w-4 h-4 text-blue-600" />}
                onClick={() =>
                  setConfirmDialog({
                    isOpen: true,
                    action: 'RESET_PASSWORD',
                    title: 'Reset Kata Sandi Pengguna',
                    description: `Apakah Anda yakin ingin mereset kata sandi akun "${user.fullName}"? Password sementara akan digenerate otomatis atau dapat Anda tentukan.`,
                    confirmLabel: 'Reset Password',
                    confirmVariant: 'primary',
                  })
                }
              >
                Reset Password
              </Button>

              <Button
                variant="outline"
                size="sm"
                leftIcon={<LogOut className="w-4 h-4 text-amber-600" />}
                onClick={() =>
                  setConfirmDialog({
                    isOpen: true,
                    action: 'FORCE_LOGOUT',
                    title: 'Force Logout / Revoke Sesi',
                    description: `Pengguna "${user.fullName}" akan dipaksa keluar dari seluruh perangkat aktif. Sesi login saat ini akan langsung kedaluwarsa.`,
                    confirmLabel: 'Revoke Sesi',
                    confirmVariant: 'warning',
                  })
                }
              >
                Force Logout
              </Button>

              <Button
                variant={user.isActive ? 'danger' : 'outline'}
                size="sm"
                leftIcon={<Power className="w-4 h-4" />}
                onClick={() =>
                  setConfirmDialog({
                    isOpen: true,
                    action: 'TOGGLE_STATUS',
                    title: user.isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun',
                    description: user.isActive
                      ? `Akun "${user.fullName}" akan dinonaktifkan dan tidak dapat login ke sistem sekolah.`
                      : `Akun "${user.fullName}" akan diaktifkan kembali.`,
                    confirmLabel: user.isActive ? 'Nonaktifkan' : 'Aktifkan',
                    confirmVariant: user.isActive ? 'danger' : 'primary',
                  })
                }
              >
                {user.isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
              </Button>
            </div>
          </div>

          {/* Generated Temporary Password Notice */}
          {generatedPassword && (
            <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-amber-800 block">
                  Password Sementara Pengguna Berhasil Dibuat:
                </span>
                <span className="font-mono text-sm font-black text-amber-950 mt-0.5 block">
                  {generatedPassword}
                </span>
                <span className="text-[10px] text-amber-700">
                  Berikan password ini kepada pengguna terkait. Pengguna disarankan segera menggantinya setelah login.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGeneratedPassword(null)}
              >
                Tutup
              </Button>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex items-center gap-1 border-t border-slate-100 mt-6 pt-3 overflow-x-auto">
            {(['PROFILE', 'SECURITY', 'ACTIVITY', 'SESSIONS'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === tab
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab === 'PROFILE' && 'Profile'}
                {tab === 'SECURITY' && 'Security'}
                {tab === 'ACTIVITY' && 'Activity'}
                {tab === 'SESSIONS' && 'Sessions'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'PROFILE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-blue-600" />
                  Identitas Personal Pegawai
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Nama Lengkap</span>
                  <span className="font-bold text-slate-900">{user.fullName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Username</span>
                  <span className="font-mono font-bold text-slate-900">{user.username}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">NIP / Identitas</span>
                  <span className="font-mono text-slate-800">{user.nip || '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">NUPTK</span>
                  <span className="font-mono text-slate-800">{user.nuptk || '—'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Nomor Telepon</span>
                  <span className="font-mono text-slate-800">{user.phone || '—'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  Informasi Satuan Pendidikan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Lembaga Sekolah</span>
                  <span className="font-bold text-slate-900">{user.schoolName || 'Satuan Pendidikan'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Peran Operasional</span>
                  <span className="font-bold text-blue-700">{user.role}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Status Akun</span>
                  <StatusBadge status={user.isActive ? 'ACTIVE' : 'DRAFT'} size="sm" />
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">Terdaftar Sejak</span>
                  <span className="text-slate-700">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID') : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'SECURITY' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Parameter Keamanan &amp; Autentikasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 font-bold block mb-1">Status Kredensial</span>
                  <span className="font-bold text-slate-800 text-sm">Aktif / Terverifikasi</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 font-bold block mb-1">Session Version</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    v{user.sessionVersion || 1}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 font-bold block mb-1">Login Terakhir</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString('id-ID')
                      : 'Belum pernah login'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'ACTIVITY' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                Riwayat Aktivitas Pengguna
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 text-center text-slate-400 text-xs">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Audit Aktivitas Sekolah</p>
              <p className="text-slate-400 mt-0.5">
                Setiap login, pembuatan ujian, dan pembaruan data oleh akun ini dicatat dalam log audit.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'SESSIONS' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Laptop className="w-4 h-4 text-blue-600" />
                Sesi Aktif Pengguna
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Sesi Kerja Aktif</h4>
                    <p className="text-[11px] text-slate-400">
                      Session Version: v{user.sessionVersion || 1} • {user.isActive ? 'Valid' : 'Revoked'}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setConfirmDialog({
                      isOpen: true,
                      action: 'FORCE_LOGOUT',
                      title: 'Revoke Sesi Pengguna',
                      description: `Keluar paksa pengguna "${user.fullName}" dari seluruh sesi aktif?`,
                      confirmLabel: 'Revoke',
                      confirmVariant: 'warning',
                    })
                  }
                >
                  Revoke Sesi
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sensitive Action Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleExecuteAction}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={isProcessing ? 'Memproses...' : confirmDialog.confirmLabel}
        cancelLabel="Batal"
        confirmVariant={confirmDialog.confirmVariant}
        isLoading={isProcessing}
      />
    </AdminLayout>
  );
}
