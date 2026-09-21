'use client';

import { useState, useEffect } from 'react';
import PengawasLayout from '@/components/pengawas/PengawasLayout';
import Link from 'next/link';
import {
  User,
  ShieldCheck,
  Building,
  Key,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export default function PengawasProfilePage() {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const [authRes, dashRes] = await Promise.all([
          fetch('/api/auth/session'),
          fetch('/api/proctor/dashboard'),
        ]);

        const authJson = await authRes.json();
        if (authJson.authenticated && authJson.user) {
          setSessionUser(authJson.user);
        }

        const dashJson = await dashRes.json();
        if (dashJson.success) {
          setStats(dashJson.data?.stats);
        }
      } catch (err) {
        console.error('Gagal memuat profil pengawas:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  return (
    <PengawasLayout
      title="Profil Pengawas"
      subtitle="Informasi akun staf pengawas dan ringkasan tugas pengawasan operasional."
      breadcrumbs={[
        { label: 'Dasbor', href: '/pengawas/dashboard' },
        { label: 'Profil Pengawas' },
      ]}
    >
      <div className="max-w-4xl space-y-6">
        {loading ? (
          <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        ) : (
          <>
            {/* Identity Card */}
            <Card className="p-6 bg-white border-slate-200 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-black text-2xl shadow-sm">
                    {sessionUser?.name ? sessionUser.name.charAt(0).toUpperCase() : 'P'}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-slate-900">
                        {sessionUser?.name || sessionUser?.username || 'Petugas Pengawas'}
                      </h2>
                      <Badge variant="success" size="sm">
                        PENGAWAS
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-slate-500">
                      ID Pengguna: @{sessionUser?.username || '-'}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium pt-0.5">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span>{sessionUser?.schoolName || 'Satuan Pendidikan Terdaftar'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                  <Link href="/account/security">
                    <Button variant="outline" size="sm" leftIcon={<Key className="w-3.5 h-3.5" />}>
                      Ganti Sandi
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Detail Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Peran & Kewenangan
                  </span>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Pengawas Ujian (Proctor Operational)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Berwenang memverifikasi kesiapan ruang, mencatat presensi, dan memantau ujian aktif.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Satuan Pendidikan (Tenant)
                  </span>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Building className="w-4 h-4 text-blue-600" />
                    <span>{sessionUser?.schoolName || 'Sekolah'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">
                    ID Sekolah: {sessionUser?.schoolId || '-'}
                  </p>
                </div>
              </div>
            </Card>

            {/* Assignment Summary Card */}
            <Card className="p-6 bg-white border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Ringkasan Tugas Pengawasan
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/70 space-y-1">
                  <span className="text-xs font-semibold text-emerald-800">Ruang Ditugaskan</span>
                  <div className="text-2xl font-black text-emerald-900">
                    {stats?.assignedRoomsCount ?? 0}
                  </div>
                  <span className="text-[11px] text-emerald-700">Ruang ujian aktif</span>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/70 space-y-1">
                  <span className="text-xs font-semibold text-blue-800">Sesi Hari Ini</span>
                  <div className="text-2xl font-black text-blue-900">
                    {stats?.todaySchedulesCount ?? 0}
                  </div>
                  <span className="text-[11px] text-blue-700">Jadwal pengawasan</span>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/70 space-y-1">
                  <span className="text-xs font-semibold text-indigo-800">Total Siswa Terdaftar</span>
                  <div className="text-2xl font-black text-indigo-900">
                    {stats?.totalParticipants ?? 0}
                  </div>
                  <span className="text-[11px] text-indigo-700">Peserta ruang tugas</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Link href="/pengawas/schedule">
                  <Button variant="primary" size="sm" rightIcon={<Calendar className="w-3.5 h-3.5" />}>
                    Buka Jadwal Pengawasan
                  </Button>
                </Link>
              </div>
            </Card>
          </>
        )}
      </div>
    </PengawasLayout>
  );
}
