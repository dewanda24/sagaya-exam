'use client';

import { useState, useEffect } from 'react';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  UserCheck,
  Building2,
  Mail,
  Phone,
  BookOpen,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  RotateCw,
} from 'lucide-react';

export default function GuruProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guru/profile');
      const json = await res.json();
      if (json.success) {
        setProfile(json.data);
        setPhone(json.data.phone || '');
        setEmail(json.data.email || '');
      } else {
        setMsg({ type: 'error', text: json.error || 'Gagal memuat data profil.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Terjadi kesalahan jaringan.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/guru/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg({ type: 'success', text: 'Data kontak pengajar berhasil disimpan.' });
      } else {
        setMsg({ type: 'error', text: json.error || 'Gagal menyimpan profil.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Gagal menyimpan data.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <GuruLayout
      title="Profil Pengajar"
      subtitle="Identitas penugasan akademik dan pengelolaan data kontak pengajar"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Profil Saya' },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={loadProfile}
          isLoading={loading}
          leftIcon={<RotateCw className="w-3.5 h-3.5" />}
        >
          Segarkan
        </Button>
      }
    >
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {msg && (
          <div
            className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
              msg.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            )}
            <span className="font-medium">{msg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Identity Readonly Card */}
          <Card className="md:col-span-1">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-2xl shadow-inner border border-primary-200">
                {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'G'}
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">
                  {profile?.fullName || (loading ? 'Memuat...' : '-')}
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">@{profile?.username || '-'}</p>
                <div className="mt-2.5">
                  <Badge variant="primary" size="md">
                    Peran: {profile?.role || 'GURU'}
                  </Badge>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs text-left">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Status Akun:</span>
                  <Badge variant="success" size="sm">
                    {profile?.status || 'ACTIVE'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">NIP:</span>
                  <span className="font-mono font-medium text-slate-800">{profile?.nip || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">NUPTK:</span>
                  <span className="font-mono font-medium text-slate-800">{profile?.nuptk || '—'}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-900 leading-relaxed flex gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  NIP, NUPTK, dan Satuan Pendidikan dikelola terpusat oleh Administrator Sekolah.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Form Editable Kontak & Assigned Scope */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary-600" />
                  Informasi Kontak Pengajar
                </CardTitle>
                <CardDescription>
                  Perbarui alamat surat elektronik dan nomor telepon untuk komunikasi kedinasan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Satuan Pendidikan (Sekolah)
                    </label>
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 font-medium">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span>{profile?.school?.name || '-'} ({profile?.school?.code || '-'})</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Email Kedinasan
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama.guru@sekolah.sch.id"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Nomor WhatsApp / Handphone
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="08123456789"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      isLoading={saving}
                      leftIcon={<Save className="w-4 h-4" />}
                    >
                      Simpan Perubahan
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Assigned Subjects Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary-600" />
                  Mata Pelajaran yang Diampu
                </CardTitle>
                <CardDescription>
                  Mata pelajaran resmi yang terdaftar atas penugasan Anda di sekolah ini
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2.5">
                  {profile?.assignedSubjects && profile.assignedSubjects.length > 0 ? (
                    profile.assignedSubjects.map((s: any) => (
                      <div
                        key={s.id}
                        className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 flex items-center gap-2"
                      >
                        <span className="font-semibold">{s.name}</span>
                        <span className="text-slate-400">({s.code})</span>
                        <Badge variant="neutral" size="sm">
                          {s.questionCount} butir
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">Belum ada penugasan mata pelajaran.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </GuruLayout>
  );
}
