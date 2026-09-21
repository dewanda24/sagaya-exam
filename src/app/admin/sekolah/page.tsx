'use client';

import { useState, useEffect, useRef } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  ShieldCheck,
  Check,
  FileText,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Globe,
  Award,
  Sparkles,
  Info,
  Save,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { School } from '@/lib/core/types';

export default function AdminSekolahPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [schoolData, setSchoolData] = useState<School | null>(null);
  const [activeTab, setActiveTab] = useState<'IDENTITAS' | 'PEJABAT' | 'KOP' | 'LISENSI'>('IDENTITAS');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    level: 'SMA' as School['level'],
    address: '',
    phone: '',
    email: '',
    principalName: '',
    principalNip: '',
    logoUrl: '',
    headerTitle1: 'PEMERINTAH DAERAH PROVINSI',
    headerTitle2: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
    settings: {
      accreditation: 'A',
      schoolType: 'NEGERI',
      website: '',
      postalCode: '',
      examChairmanName: '',
      examChairmanNip: '',
    },
  });

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchSchoolProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/schools');
      const json = await res.json();
      if (json.success && json.data.schools && json.data.schools.length > 0) {
        const sc: School = json.data.schools[0];
        setSchoolData(sc);
        const settings = sc.settings || {};
        setFormData({
          code: sc.code || '',
          name: sc.name || '',
          level: sc.level || 'SMA',
          address: sc.address || '',
          phone: sc.phone || '',
          email: sc.email || '',
          principalName: sc.principalName || '',
          principalNip: sc.principalNip || '',
          logoUrl: sc.logoUrl || '',
          headerTitle1: sc.headerTitle1 || 'PEMERINTAH DAERAH PROVINSI',
          headerTitle2: sc.headerTitle2 || 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
          settings: {
            accreditation: settings.accreditation || 'A',
            schoolType: settings.schoolType || 'NEGERI',
            website: settings.website || '',
            postalCode: settings.postalCode || '',
            examChairmanName: settings.examChairmanName || '',
            examChairmanNip: settings.examChairmanNip || '',
          },
        });
      }
    } catch (err) {
      console.error(err);
      showNotification('Gagal memuat data profil sekolah.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchoolProfile();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showNotification('Ukuran berkas logo maksimal 2MB.', 'error');
      return;
    }

    setIsUploadingLogo(true);
    const data = new FormData();
    data.append('file', file);
    data.append('folder', 'logos');

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: data,
      });
      const json = await res.json();
      if (json.success && json.url) {
        setFormData((prev) => ({ ...prev, logoUrl: json.url }));
        showNotification('Logo sekolah berhasil diunggah!');
      } else {
        showNotification(json.error || 'Gagal mengunggah logo.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan saat mengunggah logo.', 'error');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolData?.id) return;
    setSaving(true);

    try {
      const res = await fetch('/api/admin/schools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schoolData.id,
          ...formData,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showNotification('Profil dan identitas resmi sekolah berhasil disimpan!');
        window.dispatchEvent(
          new CustomEvent('sagaya:school-changed', { detail: { schoolId: schoolData.id } })
        );
        fetchSchoolProfile();
      } else {
        showNotification(json.error || 'Gagal menyimpan perubahan.', 'error');
      }
    } catch {
      showNotification('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all animate-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="space-y-6">
        {/* Header Title */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Profil Satuan Pendidikan
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Kelola identitas resmi, pimpinan, logo, dan kop dokumen cetak untuk Kartu Ujian dan Berita Acara (BAPU).
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Simpan Perubahan</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('IDENTITAS')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'IDENTITAS'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>1. Identitas & Kontak</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PEJABAT')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'PEJABAT'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>2. Kepala Sekolah & Panitia</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('KOP')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'KOP'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>3. Logo & Kop Dokumen Cetak</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LISENSI')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'LISENSI'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>4. Lisensi & Kuota</span>
          </button>
        </div>

        {/* Form Body */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center text-slate-500 border border-slate-200">
            Memuat profil sekolah...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* =========================================================
                TAB 1: IDENTITAS & KONTAK
                ========================================================= */}
            {activeTab === 'IDENTITAS' && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-base font-bold text-slate-900">
                    Informasi Satuan Pendidikan
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data pokok lembaga yang digunakan pada seluruh laporan evaluasi hasil ujian.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nama Satuan Pendidikan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Contoh: SMA Negeri 1 Sagaya"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      NPSN (Kode Sekolah) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="Contoh: 20214589"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-mono font-semibold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Jenjang Pendidikan <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.level}
                      onChange={(e) =>
                        setFormData({ ...formData, level: e.target.value as School['level'] })
                      }
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                    >
                      <option value="SD">Sekolah Dasar (SD)</option>
                      <option value="SMP">Sekolah Menengah Pertama (SMP)</option>
                      <option value="SMA">Sekolah Menengah Atas (SMA)</option>
                      <option value="SMK">Sekolah Menengah Kejuruan (SMK)</option>
                      <option value="MADRASAH">Madrasah (MI / MTs / MA)</option>
                      <option value="UMUM">Umum / Lembaga Pelatihan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Status Sekolah
                    </label>
                    <select
                      value={formData.settings.schoolType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: { ...formData.settings, schoolType: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                    >
                      <option value="NEGERI">Negeri</option>
                      <option value="SWASTA">Swasta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Akreditasi Satuan Pendidikan
                    </label>
                    <select
                      value={formData.settings.accreditation}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          settings: { ...formData.settings, accreditation: e.target.value },
                        })
                      }
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                    >
                      <option value="A">Terakreditasi A (Unggul)</option>
                      <option value="B">Terakreditasi B (Baik)</option>
                      <option value="C">Terakreditasi C (Cukup)</option>
                      <option value="BELUM">Belum Terakreditasi</option>
                    </select>
                  </div>
                </div>

                {/* Alamat & Kontak Section */}
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">
                    Alamat Lengkap & Kontak Resmi
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Alamat Jalan / Gedung
                      </label>
                      <textarea
                        rows={2}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Contoh: Jl. Pendidikan No. 45, Desa Mekar Wangi"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Nomor Telepon Sekolah
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="(021) 8765432"
                          className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Email Resmi Sekolah
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="info@sman1sagaya.sch.id"
                          className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Website Sekolah
                      </label>
                      <div className="relative">
                        <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={formData.settings.website}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              settings: { ...formData.settings, website: e.target.value },
                            })
                          }
                          placeholder="https://sman1sagaya.sch.id"
                          className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-medium text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 2: KEPALA SEKOLAH & PANITIA UJIAN
                ========================================================= */}
            {activeTab === 'PEJABAT' && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-base font-bold text-slate-900">
                    Pimpinan & Panitia Pelaksana Ujian
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Nama pejabat ini otomatis tertera pada tanda tangan Berita Acara Pelaksanaan Ujian (BAPU) dan Kartu Peserta.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Kepala Satuan Pendidikan */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      <span>Kepala Satuan Pendidikan</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Nama Lengkap Beserta Gelar
                      </label>
                      <input
                        type="text"
                        value={formData.principalName}
                        onChange={(e) =>
                          setFormData({ ...formData, principalName: e.target.value })
                        }
                        placeholder="Contoh: Drs. H. Ahmad Sudrajat, M.Pd."
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        NIP / NUPTK / NIY
                      </label>
                      <input
                        type="text"
                        value={formData.principalNip}
                        onChange={(e) =>
                          setFormData({ ...formData, principalNip: e.target.value })
                        }
                        placeholder="Contoh: 19680512 199303 1 004"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Ketua Panitia Ujian Sekolah */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <Award className="w-4 h-4 text-indigo-600" />
                      <span>Ketua Panitia Ujian Sekolah</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Nama Ketua Panitia Ujian
                      </label>
                      <input
                        type="text"
                        value={formData.settings.examChairmanName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            settings: {
                              ...formData.settings,
                              examChairmanName: e.target.value,
                            },
                          })
                        }
                        placeholder="Contoh: Siti Rahmawati, S.Pd."
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-indigo-500 font-semibold text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        NIP / NUPTK Ketua Panitia
                      </label>
                      <input
                        type="text"
                        value={formData.settings.examChairmanNip}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            settings: {
                              ...formData.settings,
                              examChairmanNip: e.target.value,
                            },
                          })
                        }
                        placeholder="Contoh: 19820719 200801 2 007"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 3: LOGO & KOP DOKUMEN CETAK DENGAN LIVE PREVIEW
                ========================================================= */}
            {activeTab === 'KOP' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-base font-bold text-slate-900">
                      Konfigurasi Logo & Kop Dokumen Resmi
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Susunan kepala surat (kop) yang dicetak pada kartu ujian peserta, lembar presensi, dan berita acara.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Logo Upload Box */}
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col items-center justify-center text-center">
                      <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 p-2 flex items-center justify-center shadow-xs mb-3">
                        {formData.logoUrl ? (
                          <img
                            src={formData.logoUrl}
                            alt="Logo Sekolah"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-10 h-10 text-slate-300" />
                        )}
                      </div>

                      <input
                        type="file"
                        ref={logoInputRef}
                        accept="image/png,image/jpeg,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />

                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploadingLogo}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition shadow-2xs cursor-pointer"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isUploadingLogo ? 'Mengunggah...' : 'Unggah Logo Baru'}</span>
                      </button>
                      <p className="text-[10px] text-slate-400 mt-2">
                        Format PNG/JPG transparan, maks. 2MB.
                      </p>
                    </div>

                    {/* Kop Header Text Inputs */}
                    <div className="lg:col-span-2 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Kop Baris 1 (Pemerintah Provinsi / Daerah / Yayasan)
                        </label>
                        <input
                          type="text"
                          value={formData.headerTitle1}
                          onChange={(e) =>
                            setFormData({ ...formData, headerTitle1: e.target.value })
                          }
                          placeholder="PEMERINTAH DAERAH PROVINSI JAWA BARAT"
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Kop Baris 2 (Dinas Pendidikan / Cabang Dinas)
                        </label>
                        <input
                          type="text"
                          value={formData.headerTitle2}
                          onChange={(e) =>
                            setFormData({ ...formData, headerTitle2: e.target.value })
                          }
                          placeholder="DINAS PENDIDIKAN DAN KEBUDAYAAN"
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 font-semibold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Nama Lembaga pada Kop (Otomatis dari Nama Satuan Pendidikan)
                        </label>
                        <input
                          type="text"
                          disabled
                          value={formData.name.toUpperCase()}
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-100 border border-slate-200 font-black text-slate-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* LIVE PREVIEW KOP DOKUMEN CETAK */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Pratinjau Langsung (Live Preview) Kop Dokumen Resmi
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      Standard Dokumen A4
                    </span>
                  </div>

                  {/* Simulated Official Paper Header */}
                  <div className="bg-slate-50/50 p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-inner">
                    <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl border border-slate-300/80 shadow-sm">
                      <div className="flex items-center gap-4">
                        {/* Left Logo */}
                        <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                          {formData.logoUrl ? (
                            <img
                              src={formData.logoUrl}
                              alt="Logo Kop"
                              className="w-16 h-16 object-contain"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center text-[9px] font-bold text-slate-400 text-center">
                              LOGO SEKOLAH
                            </div>
                          )}
                        </div>

                        {/* Center Titles */}
                        <div className="flex-1 text-center font-serif leading-tight">
                          <div className="text-xs sm:text-sm font-bold tracking-wide uppercase text-slate-900">
                            {formData.headerTitle1 || 'PEMERINTAH DAERAH PROVINSI'}
                          </div>
                          <div className="text-xs sm:text-sm font-bold tracking-wide uppercase text-slate-900">
                            {formData.headerTitle2 || 'DINAS PENDIDIKAN DAN KEBUDAYAAN'}
                          </div>
                          <div className="text-sm sm:text-base font-black tracking-wider uppercase text-slate-900 mt-0.5">
                            {formData.name || 'SATUAN PENDIDIKAN'}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-slate-600 font-sans mt-1">
                            {formData.address || 'Alamat Belum Diisi'}
                            {formData.phone && ` • Telp: ${formData.phone}`}
                            {formData.email && ` • Email: ${formData.email}`}
                          </div>
                        </div>
                      </div>

                      {/* Official Double Border Line */}
                      <div className="mt-3 border-b-2 border-slate-900" />
                      <div className="mt-0.5 border-b border-slate-900" />

                      {/* Sample Subtitle for Paper */}
                      <div className="mt-4 text-center">
                        <span className="text-[11px] font-black tracking-widest text-slate-800 uppercase px-3 py-1 bg-slate-100 rounded">
                          KARTU PESERTA UJIAN / BERITA ACARA
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 4: LISENSI & KUOTA
                ========================================================= */}
            {activeTab === 'LISENSI' && (
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-base font-bold text-slate-900">
                    Lisensi Platform & Alokasi Kuota
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Informasi hak akses dan kapasitas CBT yang dialokasikan oleh Administrator Platform (Super Admin).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">
                      Kapasitas Kuota Siswa
                    </div>
                    <div className="text-2xl font-black text-slate-900">
                      {schoolData?.quotaStudents || 1000} Siswa
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Jumlah maksimum siswa yang dapat memiliki PIN aktif.
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">
                      Batas Ujian Aktif
                    </div>
                    <div className="text-2xl font-black text-slate-900">
                      {schoolData?.quotaExams || 50} Sesi
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Batas sesi paralel pelaksanaan ujian.
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">
                      Status Lembaga
                    </div>
                    <div className="text-2xl font-black text-emerald-600 flex items-center gap-2">
                      <ShieldCheck className="w-6 h-6" />
                      Aktif
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Terdaftar resmi di server Sagaya Exam.
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50/70 rounded-2xl p-5 border border-blue-200 flex items-start gap-3.5">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 leading-relaxed">
                    <div className="font-bold text-blue-900 mb-1">
                      Memerlukan Penambahan Kuota Siswa atau Perpanjangan Lisensi?
                    </div>
                    Pengaturan kuota peserta dan batas ujian diatur secara terpusat oleh Dinas Pendidikan / Administrator Platform Sagaya Exam. Hubungi helpdesk resmi atau proktor wilayah untuk penambahan kapasitas.
                  </div>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
