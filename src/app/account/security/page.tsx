'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  KeyRound,
  Laptop,
  Smartphone,
  Globe,
  Clock,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  RefreshCw,
  Server,
} from 'lucide-react';
import { DashboardShell } from '@/components/ui/DashboardShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/Modal';
import { SessionUser } from '@/lib/core/auth';

interface UserSession {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ipAddress: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export default function AccountSecurityPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // Active sessions state
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionActionLoading, setSessionActionLoading] = useState<string | null>(null);
  const [sessionMsg, setSessionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Confirm dialog state for revoking all sessions
  const [confirmRevokeAllOpen, setConfirmRevokeAllOpen] = useState(false);
  const [confirmRevokeSingleId, setConfirmRevokeSingleId] = useState<string | null>(null);

  useEffect(() => {
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
        }
      })
      .catch(console.error);

    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/auth/sessions');
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch {
      // Failed to load sessions
    } finally {
      setSessionsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwdError('Konfirmasi kata sandi tidak cocok dengan kata sandi baru.');
      return;
    }

    setPwdLoading(true);
    setPwdError(null);
    setPwdSuccess(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setPwdError(json.error || 'Gagal mengubah kata sandi.');
      } else {
        setPwdSuccess('Kata sandi berhasil diubah. Seluruh sesi lain telah dicabut demi keamanan.');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        fetchSessions();
      }
    } catch {
      setPwdError('Terjadi kesalahan jaringan.');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleRevokeSingle = async (sessionId: string) => {
    setSessionActionLoading(sessionId);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_session', sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        setSessionMsg({ type: 'success', text: 'Sesi perangkat berhasil dicabut.' });
        fetchSessions();
      } else {
        setSessionMsg({ type: 'error', text: data.error || 'Gagal mencabut sesi.' });
      }
    } catch {
      setSessionMsg({ type: 'error', text: 'Terjadi kendala jaringan.' });
    } finally {
      setSessionActionLoading(null);
      setConfirmRevokeSingleId(null);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setSessionActionLoading('all');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_all_sessions' }),
      });
      const data = await res.json();
      if (data.success) {
        setSessionMsg({ type: 'success', text: 'Seluruh sesi lain berhasil dicabut.' });
        fetchSessions();
      } else {
        setSessionMsg({ type: 'error', text: data.error || 'Gagal mencabut sesi lain.' });
      }
    } catch {
      setSessionMsg({ type: 'error', text: 'Terjadi kendala jaringan.' });
    } finally {
      setSessionActionLoading(null);
      setConfirmRevokeAllOpen(false);
    }
  };

  return (
    <DashboardShell currentUser={currentUser} title="Pengaturan Keamanan Akun">
      <div className="space-y-8 max-w-4xl">
        <PageHeader
          title="Keamanan & Sesi Akun"
          subtitle="Kelola kata sandi akun pendidik Anda dan pantau seluruh perangkat yang sedang aktif."
        />

        {/* SECTION 1: CHANGE PASSWORD */}
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-2.5 pb-4 mb-6 border-b border-divider">
            <div className="w-8 h-8 rounded-md bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-200">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Ubah Kata Sandi</h2>
              <p className="text-xs text-text-muted">Perbarui kata sandi secara berkala untuk menjaga integritas akses.</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-lg">
            {pwdSuccess && <Alert variant="success">{pwdSuccess}</Alert>}
            {pwdError && <Alert variant="danger">{pwdError}</Alert>}

            {/* Old Password */}
            <div className="space-y-1.5">
              <label htmlFor="oldPassword" className="text-xs font-semibold text-text-secondary">
                Kata Sandi Saat Ini
              </label>
              <div className="relative flex items-center">
                <input
                  id="oldPassword"
                  type={showOld ? 'text' : 'password'}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full text-sm text-text-primary bg-surface border border-border rounded-md min-h-[40px] px-3.5 pr-10 py-2 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-500/15"
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute right-3 p-1 text-text-muted hover:text-text-primary"
                  aria-label={showOld ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label htmlFor="newPassword" className="text-xs font-semibold text-text-secondary">
                Kata Sandi Baru (Minimal 8 Karakter)
              </label>
              <div className="relative flex items-center">
                <input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-sm text-text-primary bg-surface border border-border rounded-md min-h-[40px] px-3.5 pr-10 py-2 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-500/15"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 p-1 text-text-muted hover:text-text-primary"
                  aria-label={showNew ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-semibold text-text-secondary">
                Konfirmasi Kata Sandi Baru
              </label>
              <input
                id="confirmPassword"
                type={showNew ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-sm text-text-primary bg-surface border border-border rounded-md min-h-[40px] px-3.5 py-2 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-500/15"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={pwdLoading}
                disabled={!oldPassword || !newPassword || !confirmPassword}
              >
                Simpan Kata Sandi
              </Button>
            </div>
          </form>
        </Card>

        {/* SECTION 2: ACTIVE SESSIONS */}
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-divider gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary">Sesi Login Aktif</h2>
                <p className="text-xs text-text-muted">Daftar perangkat yang saat ini terhubung dengan akun Anda.</p>
              </div>
            </div>

            {sessions.length > 1 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmRevokeAllOpen(true)}
                isLoading={sessionActionLoading === 'all'}
              >
                Cabut Semua Sesi Lain
              </Button>
            )}
          </div>

          {sessionMsg && (
            <Alert
              variant={sessionMsg.type === 'success' ? 'success' : 'danger'}
              onClose={() => setSessionMsg(null)}
              className="mb-4"
            >
              {sessionMsg.text}
            </Alert>
          )}

          {sessionsLoading ? (
            <div className="py-8 text-center text-xs text-text-muted">Memuat daftar sesi aktif...</div>
          ) : sessions.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">Tidak ada data sesi aktif.</div>
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((sess) => (
                <div key={sess.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-surface-subtle border border-border flex items-center justify-center shrink-0 mt-0.5">
                      {sess.deviceName?.toLowerCase().includes('mobile') ? (
                        <Smartphone className="w-4 h-4 text-text-muted" />
                      ) : (
                        <Laptop className="w-4 h-4 text-text-muted" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text-primary">
                          {sess.browser || 'Web Browser'} • {sess.os || 'Desktop OS'}
                        </span>
                        {sess.isCurrent && (
                          <Badge variant="success" size="sm">
                            Sesi Ini (Aktif)
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        Alamat IP: {sess.ipAddress || 'Internal'} • Terakhir aktif:{' '}
                        {new Date(sess.lastActivityAt).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {!sess.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmRevokeSingleId(sess.id)}
                      isLoading={sessionActionLoading === sess.id}
                      className="text-danger hover:bg-danger-bg text-xs"
                    >
                      Cabut Sesi
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={confirmRevokeAllOpen}
        onClose={() => setConfirmRevokeAllOpen(false)}
        onConfirm={handleRevokeOtherSessions}
        title="Cabut Seluruh Sesi Lain?"
        description="Seluruh perangkat lain yang sedang login menggunakan akun ini akan otomatis dikeluarkan (logout paksa)."
        confirmLabel="Ya, Cabut Seluruh Sesi"
        confirmVariant="danger"
        isLoading={sessionActionLoading === 'all'}
      />

      <ConfirmDialog
        isOpen={!!confirmRevokeSingleId}
        onClose={() => setConfirmRevokeSingleId(null)}
        onConfirm={() => {
          if (confirmRevokeSingleId) {
            handleRevokeSingle(confirmRevokeSingleId);
          }
        }}
        title="Cabut Sesi Perangkat Ini?"
        description="Perangkat ini tidak akan dapat mengakses sistem lagi sampai Anda melakukan login ulang."
        confirmLabel="Cabut Sesi"
        confirmVariant="danger"
        isLoading={!!sessionActionLoading}
      />
    </DashboardShell>
  );
}
