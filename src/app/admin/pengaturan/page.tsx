'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import {
  Sliders,
  Building2,
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Info,
} from 'lucide-react';

interface SchoolSettings {
  displayName: string;
  logoUrl?: string;
  timezone: string;
  studentNumberFormat: string;
  defaultDurationMinutes: number;
  defaultShowScorePolicy: string;
  headerTitle1: string;
  headerTitle2: string;
  examRulesNotice: string;
  enableTabViolationWarning: boolean;
}

export default function AdminPengaturanPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState<SchoolSettings>({
    displayName: '',
    logoUrl: '',
    timezone: 'Asia/Jakarta (WIB)',
    studentNumberFormat: 'NISN / NIS',
    defaultDurationMinutes: 90,
    defaultShowScorePolicy: 'AFTER_ALL_DONE',
    headerTitle1: '',
    headerTitle2: '',
    examRulesNotice: 'Dilarang membuka tab lain atau meninggalkan halaman ujian.',
    enableTabViolationWarning: true,
  });

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.data) {
        setFormData({
          displayName: data.data.displayName || '',
          logoUrl: data.data.logoUrl || '',
          timezone: data.data.timezone || 'Asia/Jakarta (WIB)',
          studentNumberFormat: data.data.studentNumberFormat || 'NISN / NIS',
          defaultDurationMinutes: data.data.defaultDurationMinutes || 90,
          defaultShowScorePolicy: data.data.defaultShowScorePolicy || 'AFTER_ALL_DONE',
          headerTitle1: data.data.headerTitle1 || '',
          headerTitle2: data.data.headerTitle2 || '',
          examRulesNotice: data.data.examRulesNotice || 'Dilarang membuka tab lain atau meninggalkan halaman ujian.',
          enableTabViolationWarning: data.data.enableTabViolationWarning !== false,
        });
      } else {
        showNotification(data.error || 'Gagal memuat pengaturan sekolah.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Gagal menghubungi server pengaturan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        showNotification('Pengaturan operasional sekolah berhasil diperbarui!');
        setShowConfirmModal(false);
      } else {
        showNotification(data.error || 'Gagal memperbarui pengaturan.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Terjadi kesalahan koneksi saat menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const breadcrumbs = [
    { label: 'Admin', href: '/admin/dashboard' },
    { label: 'Sistem' },
    { label: 'Pengaturan Sekolah' },
  ];

  return (
    <AdminLayout breadcrumbs={breadcrumbs}>
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

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Pengaturan Operasional Satuan Pendidikan
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Konfigurasi standar penyelenggaraan ujian, kop berita acara resmi, dan kebijakan integritas sekolah.
          </p>
        </div>

        <Button
          onClick={() => setShowConfirmModal(true)}
          disabled={saving || loading}
          leftIcon={<Save className="w-4 h-4" />}
        >
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </Button>
      </div>

      {/* Isolation Notice Banner */}
      <div className="mb-6 p-4 rounded-2xl bg-sky-50 border border-sky-100 flex items-start gap-3">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-800 leading-relaxed">
          <span className="font-bold">Ruang Lingkup Admin Sekolah:</span> Pengaturan di halaman ini hanya berdampak pada satuan pendidikan Anda. Konfigurasi keamanan global, arsitektur database, dan lisensi platform dikelola oleh Super Administrator.
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">Memuat pengaturan sekolah...</div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Kop Surat & Identitas Resmi */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-violet-600" />
                <CardTitle>Identitas & Kop Resmi Dokumen</CardTitle>
              </div>
              <CardDescription>
                Teks kop surat ini dicetak otomatis pada Berita Acara, Daftar Hadir, dan Kartu Peserta Ujian.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama Tampilan Sekolah
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Contoh: SMAN 1 SAGAYA"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Zona Waktu Penyelenggaraan
                  </label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white"
                  >
                    <option value="Asia/Jakarta (WIB)">Asia/Jakarta (WIB — UTC+7)</option>
                    <option value="Asia/Makassar (WITA)">Asia/Makassar (WITA — UTC+8)</option>
                    <option value="Asia/Jayapura (WIT)">Asia/Jayapura (WIT — UTC+9)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kop Dokumen Baris 1 (Instansi Pembina)
                  </label>
                  <input
                    type="text"
                    value={formData.headerTitle1}
                    onChange={(e) => setFormData({ ...formData, headerTitle1: e.target.value })}
                    placeholder="Contoh: PEMERINTAH PROVINSI JAWA BARAT"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kop Dokumen Baris 2 (Dinas / Cabang Dinas)
                  </label>
                  <input
                    type="text"
                    value={formData.headerTitle2}
                    onChange={(e) => setFormData({ ...formData, headerTitle2: e.target.value })}
                    placeholder="Contoh: DINAS PENDIDIKAN WILAYAH IV"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Kebijakan Standar Pelaksanaan Ujian */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-emerald-600" />
                <CardTitle>Standar & Kebijakan Ujian</CardTitle>
              </div>
              <CardDescription>
                Nilai baku yang diterapkan secara default ketika membuat jadwal atau paket ujian baru.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Durasi Baku Ujian (Menit)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={formData.defaultDurationMinutes}
                    onChange={(e) => setFormData({ ...formData, defaultDurationMinutes: parseInt(e.target.value, 10) || 90 })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Dapat disesuaikan per masing-masing mata pelajaran ujian.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kebijakan Tampil Nilai ke Siswa
                  </label>
                  <select
                    value={formData.defaultShowScorePolicy}
                    onChange={(e) => setFormData({ ...formData, defaultShowScorePolicy: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white"
                  >
                    <option value="AFTER_ALL_DONE">Setelah Seluruh Peserta Selesai (Rekomendasi)</option>
                    <option value="IMMEDIATELY">Langsung Muncul Setelah Siswa Selesai</option>
                    <option value="NEVER">Jangan Tampilkan ke Siswa (Hanya Guru & Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Format Identitas Siswa Baku
                  </label>
                  <input
                    type="text"
                    value={formData.studentNumberFormat}
                    onChange={(e) => setFormData({ ...formData, studentNumberFormat: e.target.value })}
                    placeholder="NISN / NIS"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="enableTabViolation"
                    checked={formData.enableTabViolationWarning}
                    onChange={(e) => setFormData({ ...formData, enableTabViolationWarning: e.target.checked })}
                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
                  />
                  <label htmlFor="enableTabViolation" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Aktifkan peringatan integritas saat siswa berpindah tab / jendela
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Tata Tertib Siswa */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-amber-600" />
                <CardTitle>Tata Tertib Peserta Ujian</CardTitle>
              </div>
              <CardDescription>
                Pemberitahuan resmi ini ditampilkan pada layar siswa sebelum menekan tombol Mulai Ujian.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                rows={4}
                value={formData.examRulesNotice}
                onChange={(e) => setFormData({ ...formData, examRulesNotice: e.target.value })}
                placeholder="Tuliskan petunjuk dan tata tertib ujian di sini..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:bg-white leading-relaxed"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmModal}
        title="Simpan Pengaturan Sekolah?"
        description="Perubahan pengaturan operasional ini akan langsung berlaku pada seluruh pelaksanaan ujian dan dokumen di satuan pendidikan Anda."
        confirmLabel="Simpan Sekarang"
        cancelLabel="Batal"
        confirmVariant="primary"
        onConfirm={handleSave}
        onClose={() => setShowConfirmModal(false)}
      />
    </AdminLayout>
  );
}
