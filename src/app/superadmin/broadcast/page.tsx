'use client';

import { useState, useEffect } from 'react';
import {
  Megaphone,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertOctagon,
  Info,
  Clock,
  Building2,
  Users,
  Trash2,
  RefreshCw,
  Eye,
  Radio,
  Send,
  Calendar,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';

interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  priority: 'INFO' | 'WARNING' | 'URGENT';
  targetAudience: 'ALL' | 'ADMIN_ONLY' | 'STUDENT_ONLY' | 'SPECIFIC_SCHOOL';
  targetSchoolId?: string | null;
  targetSchoolName?: string | null;
  targetSchoolCode?: string | null;
  isActive: boolean;
  startAt: string;
  expiresAt?: string | null;
  authorName: string;
  createdAt: string;
}

interface SchoolOption {
  id: string;
  name: string;
  code: string;
}

export default function SuperAdminBroadcastPage() {
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal Create
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'INFO' as 'INFO' | 'WARNING' | 'URGENT',
    targetAudience: 'ALL' as 'ALL' | 'ADMIN_ONLY' | 'STUDENT_ONLY' | 'SPECIFIC_SCHOOL',
    targetSchoolId: '',
    durationHours: 24, // default 24 jam
  });

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBroadcasts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/broadcasts');
      const json = await res.json();
      if (json.success && json.data) {
        setBroadcasts(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch broadcasts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async () => {
    try {
      const res = await fetch('/api/superadmin/schools');
      const json = await res.json();
      if (json.success && json.data) {
        const list = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data?.schools)
          ? json.data.schools
          : [];
        setSchools(list.map((s: any) => ({ id: s.id, name: s.name, code: s.code })));
      }
    } catch (err) {
      console.error('Failed to fetch schools list:', err);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
    fetchSchools();
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.message.trim()) {
      showToast('error', 'Judul dan isi pengumuman wajib diisi.');
      return;
    }

    if (formData.targetAudience === 'SPECIFIC_SCHOOL' && !formData.targetSchoolId) {
      showToast('error', 'Silakan pilih satuan pendidikan target.');
      return;
    }

    // Hitung expires_at
    const expiresAt = new Date(Date.now() + formData.durationHours * 3600 * 1000).toISOString();

    setSubmitting(true);
    try {
      const res = await fetch('/api/superadmin/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          message: formData.message,
          priority: formData.priority,
          targetAudience: formData.targetAudience,
          targetSchoolId: formData.targetAudience === 'SPECIFIC_SCHOOL' ? formData.targetSchoolId : null,
          expiresAt,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreateModal(false);
        setFormData({
          title: '',
          message: '',
          priority: 'INFO',
          targetAudience: 'ALL',
          targetSchoolId: '',
          durationHours: 24,
        });
        showToast('success', 'Siaran pengumuman berhasil dipublikasikan.');
        fetchBroadcasts();
      } else {
        showToast('error', json.error || 'Gagal menerbitkan siaran.');
      }
    } catch {
      showToast('error', 'Terjadi kesalahan sistem saat mengirim siaran.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (b: BroadcastItem) => {
    const nextStatus = !b.isActive;
    try {
      const res = await fetch('/api/superadmin/broadcasts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: b.id,
          isActive: nextStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', `Status pengumuman "${b.title}" berhasil diubah.`);
        fetchBroadcasts();
      } else {
        showToast('error', json.error || 'Gagal mengubah status.');
      }
    } catch {
      showToast('error', 'Gagal menghubungi server.');
    }
  };

  const handleDelete = async (b: BroadcastItem) => {
    if (!window.confirm(`Hapus pengumuman "${b.title}" secara permanen?`)) return;

    try {
      const res = await fetch(`/api/superadmin/broadcasts?id=${b.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast('success', 'Pengumuman berhasil dihapus.');
        fetchBroadcasts();
      } else {
        showToast('error', json.error || 'Gagal menghapus pengumuman.');
      }
    } catch {
      showToast('error', 'Gagal menghapus pengumuman.');
    }
  };

  const filteredBroadcasts = broadcasts.filter((b) => {
    const term = search.toLowerCase();
    const matchSearch = b.title.toLowerCase().includes(term) || b.message.toLowerCase().includes(term);
    const matchPriority = priorityFilter === 'ALL' || b.priority === priorityFilter;
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && b.isActive) ||
      (statusFilter === 'INACTIVE' && !b.isActive);

    return matchSearch && matchPriority && matchStatus;
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            <AlertOctagon className="w-3 h-3" />
            DARURAT
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" />
            PERINGATAN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <Info className="w-3 h-3" />
            INFORMASI
          </span>
        );
    }
  };

  const getAudienceText = (aud: string, schoolName?: string | null) => {
    switch (aud) {
      case 'ADMIN_ONLY':
        return 'Admin Sekolah Saja';
      case 'STUDENT_ONLY':
        return 'Peserta Ujian Saja';
      case 'SPECIFIC_SCHOOL':
        return schoolName ? `Khusus ${schoolName}` : 'Sekolah Tertentu';
      default:
        return 'Semua (Admin & Siswa)';
    }
  };

  return (
    <SuperAdminLayout
      title="Pusat Siaran & Pengumuman Platform"
      subtitle="Kirim pemberitahuan instan, instruksi operasional, atau peringatan darurat ke seluruh sekolah dan peserta"
      actions={
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white text-xs font-semibold shadow-sm shadow-sky-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Siaran Baru</span>
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
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pengumuman..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-sky-500 font-medium"
            >
              <option value="ALL">Semua Prioritas</option>
              <option value="INFO">Informasi (Biasa)</option>
              <option value="WARNING">Peringatan (Sedang)</option>
              <option value="URGENT">Darurat (Tinggi)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-sky-500 font-medium"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif Ditayangkan</option>
              <option value="INACTIVE">Nonaktif / Berhenti</option>
            </select>

            <button
              onClick={fetchBroadcasts}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
              title="Muat Ulang"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Broadcasts List */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Riwayat & Status Siaran ({filteredBroadcasts.length})
              </h3>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Memuat data siaran pengumuman...
            </div>
          ) : filteredBroadcasts.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Belum ada siaran pengumuman yang diterbitkan.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredBroadcasts.map((b) => (
                <div key={b.id} className="p-5 hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {getPriorityBadge(b.priority)}
                      <h4 className="font-bold text-sm text-slate-900 truncate">
                        {b.title}
                      </h4>
                      {b.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                          <XCircle className="w-3.5 h-3.5" />
                          Nonaktif
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                      {b.message}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap pt-1">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        Target: <strong className="text-slate-600">{getAudienceText(b.targetAudience, b.targetSchoolName)}</strong>
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {b.expiresAt ? `Berakhir: ${new Date(b.expiresAt).toLocaleString('id-ID')}` : 'Tanpa batas waktu'}
                      </span>
                      <span>&bull;</span>
                      <span>Oleh: {b.authorName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-end flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(b)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                        b.isActive
                          ? 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {b.isActive ? 'Nonaktifkan' : 'Tayangkan Kembali'}
                    </button>
                    <button
                      onClick={() => handleDelete(b)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Hapus Siaran"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MODAL: CREATE BROADCAST */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-sky-50/70 to-white flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Terbitkan Siaran Baru
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Pesan akan muncul seketika di dashboard penerima
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Judul Pengumuman <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pemeliharaan Server / Perubahan Jadwal Sesi 2"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tingkat Prioritas
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: e.target.value as any })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
                    >
                      <option value="INFO">Informasi Biasa (Biru)</option>
                      <option value="WARNING">Peringatan Penting (Kuning)</option>
                      <option value="URGENT">Darurat / Genting (Merah Berkedip)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Target Penerima
                    </label>
                    <select
                      value={formData.targetAudience}
                      onChange={(e) =>
                        setFormData({ ...formData, targetAudience: e.target.value as any })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
                    >
                      <option value="ALL">Semua (Admin Sekolah & Siswa)</option>
                      <option value="ADMIN_ONLY">Hanya Administrator Sekolah</option>
                      <option value="STUDENT_ONLY">Hanya Peserta Ujian (Siswa)</option>
                      <option value="SPECIFIC_SCHOOL">Satu Satuan Pendidikan Khusus</option>
                    </select>
                  </div>
                </div>

                {formData.targetAudience === 'SPECIFIC_SCHOOL' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pilih Sekolah Target <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.targetSchoolId}
                      onChange={(e) => setFormData({ ...formData, targetSchoolId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
                    >
                      <option value="">-- Pilih Satuan Pendidikan --</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Durasi Penayangan
                  </label>
                  <select
                    value={formData.durationHours}
                    onChange={(e) =>
                      setFormData({ ...formData, durationHours: parseInt(e.target.value) || 24 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
                  >
                    <option value={2}>2 Jam (Instruksi Sesi Singkat)</option>
                    <option value={6}>6 Jam (Hari Pelaksanaan Ujian)</option>
                    <option value={24}>24 Jam (1 Hari Penuh)</option>
                    <option value={72}>3 Hari</option>
                    <option value={168}>1 Minggu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Isi Pesan Siaran <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Tuliskan isi instruksi atau pengumuman secara rinci..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-medium"
                  />
                </div>

                {/* Live Preview */}
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">
                    Pratinjau Banner Penerima (Live Preview)
                  </span>
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                      formData.priority === 'URGENT'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : formData.priority === 'WARNING'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-sky-50 border-sky-200 text-sky-900'
                    }`}
                  >
                    {formData.priority === 'URGENT' ? (
                      <AlertOctagon className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    ) : formData.priority === 'WARNING' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-xs">
                        {formData.title || 'Judul Siaran Pengumuman'}
                      </p>
                      <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                        {formData.message || 'Isi teks pengumuman yang akan dibaca oleh sekolah penerima...'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Menerbitkan...' : 'Terbitkan Sekarang'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
