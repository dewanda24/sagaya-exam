'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Key,
  Trash2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Search,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';
import Pagination from '@/components/common/Pagination';

interface TeamMember {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  isCurrentUser: boolean;
  createdAt: string;
}

interface NewCredential {
  fullName: string;
  username: string;
  tempPassword: string;
}

export default function SuperAdminTeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modal Add
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
  });

  // Modal One-Time Credential
  const [credentialModal, setCredentialModal] = useState<NewCredential | null>(null);
  const [copied, setCopied] = useState(false);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/team');
      const json = await res.json();
      if (json.success && json.data) {
        setTeam(json.data);
      }
    } catch (err) {
      console.error('Failed to load team:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.username.trim()) {
      showToast('error', 'Nama lengkap dan username staf wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/superadmin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();

      if (json.success) {
        setShowAddModal(false);
        setFormData({ fullName: '', username: '' });
        if (json.credential) {
          setCredentialModal({
            fullName: formData.fullName,
            username: json.credential.username,
            tempPassword: json.credential.tempPassword,
          });
        }
        showToast('success', json.message);
        fetchTeam();
      } else {
        showToast('error', json.error || 'Gagal menambahkan personel.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan sistem saat membuat akun.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (member: TeamMember) => {
    if (!window.confirm(`Reset kata sandi untuk personel "${member.fullName}"?`)) return;

    try {
      const res = await fetch('/api/superadmin/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          action: 'RESET_PASSWORD',
        }),
      });
      const json = await res.json();

      if (json.success && json.credential) {
        setCredentialModal({
          fullName: member.fullName,
          username: json.credential.username,
          tempPassword: json.credential.tempPassword,
        });
        showToast('success', json.message);
      } else {
        showToast('error', json.error || 'Gagal mereset kata sandi.');
      }
    } catch {
      showToast('error', 'Gagal memproses reset kata sandi.');
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    if (member.isCurrentUser) {
      showToast('error', 'Anda tidak dapat menonaktifkan akun Anda sendiri.');
      return;
    }

    try {
      const res = await fetch('/api/superadmin/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          isActive: !member.isActive,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', `Status "${member.fullName}" berhasil diperbarui.`);
        fetchTeam();
      } else {
        showToast('error', json.error || 'Gagal mengubah status.');
      }
    } catch {
      showToast('error', 'Gagal menghubungi server.');
    }
  };

  const handleDelete = async (member: TeamMember) => {
    if (member.isCurrentUser) {
      showToast('error', 'Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }

    if (!window.confirm(`Hapus akun personel Super Admin "${member.fullName}" (${member.username}) secara permanen?`)) return;

    try {
      const res = await fetch(`/api/superadmin/team?id=${member.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', json.message);
        fetchTeam();
      } else {
        showToast('error', json.error || 'Gagal menghapus personel.');
      }
    } catch {
      showToast('error', 'Gagal menghubungi server.');
    }
  };

  const copyCredentials = () => {
    if (!credentialModal) return;
    const text = `KREDENSIAL TIM MASTER (SAGAYA EXAM)\nNama: ${credentialModal.fullName}\nUsername: ${credentialModal.username}\nPassword Sementara: ${credentialModal.tempPassword}\n\nCatatan: Harap segera login dan ganti kata sandi demi keamanan.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const filteredTeam = team.filter(
    (m) =>
      m.fullName.toLowerCase().includes(search.toLowerCase()) ||
      m.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SuperAdminLayout
      title="Manajemen Tim Master Platform"
      subtitle="Kelola co-admin, staf pemantau teknis, dan personel pengelola platform Sagaya Exam"
      actions={
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white text-xs font-semibold shadow-sm shadow-sky-600/20 transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Personel Tim</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Toast */}
        {toastMessage && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm transition-all animate-in fade-in duration-200 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="opacity-70 hover:opacity-100 font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau username personel..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
            />
          </div>

          <button
            onClick={fetchTeam}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Team Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Daftar Personel Super Admin ({filteredTeam.length})
              </h3>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Memuat data personel tim...
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Tidak ada personel yang sesuai pencarian.
            </div>
          ) : (
            <div>
              <div className="w-full">
                <table className="w-full text-left border-collapse text-xs table-fixed">
                  <thead>
                    <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 border-b border-slate-200/80">
                      <th className="py-3 px-4 sm:px-6 w-[32%]">Nama & Akun Personel</th>
                      <th className="py-3 px-3 w-[24%]">Wewenang Role</th>
                      <th className="py-3 px-3 w-[14%]">Status Akses</th>
                      <th className="py-3 px-3 w-[16%]">Terdaftar Sejak</th>
                      <th className="py-3 px-4 sm:px-6 text-right w-[14%]">Aksi Kelola</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeam
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {m.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-slate-900 text-xs truncate">
                                    {m.fullName}
                                  </p>
                                  {m.isCurrentUser && (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-100 text-sky-700 border border-sky-200 shrink-0">
                                      Akun Anda
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 font-mono truncate">
                                  @{m.username}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 truncate max-w-full">
                              <ShieldCheck className="w-3 h-3 shrink-0" />
                              <span className="truncate">SUPER ADMIN</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            {m.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                                <XCircle className="w-3.5 h-3.5 shrink-0" />
                                Nonaktif
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-slate-500 font-medium text-xs">
                            {new Date(m.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Reset Password Button */}
                              <button
                                onClick={() => handleResetPassword(m)}
                                className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition"
                                title="Reset Kata Sandi"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Status Button */}
                              {!m.isCurrentUser && (
                                <button
                                  onClick={() => handleToggleActive(m)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                                    m.isActive
                                      ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                      : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  {m.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                </button>
                              )}

                              {/* Delete Button */}
                              {!m.isCurrentUser && (
                                <button
                                  onClick={() => handleDelete(m)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                  title="Hapus Personel"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Component */}
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredTeam.length / pageSize) || 1}
                totalItems={filteredTeam.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                itemName="personel"
              />
            </div>
          )}
        </div>

        {/* MODAL: ADD TEAM MEMBER */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50/70 to-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Tambah Personel Tim Master
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Kata sandi sementara akan dibuat secara otomatis
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap Personel <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ahmad Hidayat, S.Kom."
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Username Login <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: ahmad.support"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Hanya huruf kecil, angka, titik, atau garis hubung.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan & Buat Akun'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ONE-TIME CREDENTIAL DISPLAY */}
        {credentialModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-3">
                  <Key className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-bold">
                  Kredensial Personel Diterbitkan
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Untuk {credentialModal.fullName}
                </p>
              </div>

              <div className="p-5 space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Hanya Ditampilkan Sekali!</span>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      Kata sandi sementara ini tidak akan dapat dilihat kembali setelah jendela ini ditutup demi keamanan sistem platform.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 font-mono">
                  <div>
                    <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">
                      Username Login
                    </span>
                    <p className="text-sm font-bold text-slate-800 select-all mt-0.5">
                      {credentialModal.username}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider block">
                      Password Sementara
                    </span>
                    <p className="text-base font-black text-sky-700 select-all tracking-wider mt-0.5">
                      {credentialModal.tempPassword}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={copyCredentials}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-sm"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Kredensial Berhasil Disalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin Kredensial Sekarang</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setCredentialModal(null)}
                    className="w-full py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Saya Sudah Menyalin &bull; Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
