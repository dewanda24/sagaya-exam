'use client';

import { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  Clock,
  HardDrive,
  Bell,
  Wrench,
  ToggleLeft,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import SuperAdminLayout from '@/components/superadmin/SuperAdminLayout';

export default function SuperAdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'exam' | 'storage' | 'notification' | 'maintenance' | 'featureFlags'>('general');
  const [settings, setSettings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/settings');
      const json = await res.json();
      if (json.success && json.data) {
        setSettings(json.data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveCategory = async (category: string, values: any) => {
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const res = await fetch('/api/superadmin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, values }),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Gagal menyimpan pengaturan.');
      }

      setSettings(json.data);
      setSuccessMessage(`Pengaturan kategori ${category} berhasil disimpan.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  };

  const navTabs = [
    { id: 'general', label: 'Umum & Wilayah', icon: Sliders },
    { id: 'security', label: 'Keamanan & Sesi', icon: Shield },
    { id: 'exam', label: 'Integritas Ujian', icon: Clock },
    { id: 'storage', label: 'Penyimpanan Media', icon: HardDrive },
    { id: 'notification', label: 'Pemberitahuan', icon: Bell },
    { id: 'maintenance', label: 'Pemeliharaan', icon: Wrench },
    { id: 'featureFlags', label: 'Feature Flags', icon: ToggleLeft },
  ];

  return (
    <SuperAdminLayout
      title="Pengaturan Sistem Platform"
      subtitle="Konfigurasi parameter operasional wilayah, ambang batas keamanan, dan kebijakan CBT"
    >
      <div className="space-y-5">
        {/* Category Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSuccessMessage('');
                  setErrorMessage('');
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback Alerts */}
        {successMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Box */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
          {loading || !settings ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
              Memuat data konfigurasi sistem...
            </div>
          ) : (
            <div>
              {/* Tab 1: General */}
              {activeTab === 'general' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveCategory('general', settings.general);
                  }}
                  className="space-y-4 max-w-xl text-xs"
                >
                  <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                    Konfigurasi Umum & Identitas Penyelenggara
                  </h3>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Platform</label>
                    <input
                      type="text"
                      value={settings.general.platformName || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          general: { ...settings.general, platformName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Instansi Pembina / Dinas</label>
                    <input
                      type="text"
                      value={settings.general.agencyName || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          general: { ...settings.general, agencyName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Email Dukungan Teknis</label>
                    <input
                      type="email"
                      value={settings.general.contactEmail || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          general: { ...settings.general, contactEmail: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Mode Operasional Wilayah</label>
                    <select
                      value={settings.general.operationalMode || 'NORMAL'}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          general: { ...settings.general, operationalMode: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="NORMAL">Normal (Ujian Mandiri Sekolah Bebas)</option>
                      <option value="PEKAN_UJIAN_WILAYAH">Pekan Ujian Wilayah (Prioritas Asesmen Serentak)</option>
                      <option value="MAINTENANCE">Mode Pemeliharaan (Akses Dibatasi)</option>
                    </select>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Tab 2: Security */}
              {activeTab === 'security' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveCategory('security', settings.security);
                  }}
                  className="space-y-4 max-w-xl text-xs"
                >
                  <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                    Parameter Keamanan & Masa Aktif Sesi
                  </h3>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Masa Berlaku Sesi Staf (Jam)</label>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={settings.security.sessionExpiryHours || 12}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          security: { ...settings.security, sessionExpiryHours: parseInt(e.target.value, 10) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Batas Maksimal Percobaan Login Gagal</label>
                    <input
                      type="number"
                      min={3}
                      max={20}
                      value={settings.security.maxLoginAttempts || 5}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          security: { ...settings.security, maxLoginAttempts: parseInt(e.target.value, 10) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Durasi Kunci Sementara IP (Menit)</label>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={settings.security.lockoutDurationMinutes || 15}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          security: { ...settings.security, lockoutDurationMinutes: parseInt(e.target.value, 10) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Tab 3: Exam Integrity */}
              {activeTab === 'exam' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveCategory('exam', settings.exam);
                  }}
                  className="space-y-4 max-w-xl text-xs"
                >
                  <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                    Kebijakan Integritas & Pengerjaan Ujian
                  </h3>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Interval Heartbeat Peserta (Detik)</label>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={settings.exam.heartbeatIntervalSeconds || 15}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          exam: { ...settings.exam, heartbeatIntervalSeconds: parseInt(e.target.value, 10) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Interval Auto-Save Jawaban (Detik)</label>
                    <input
                      type="number"
                      min={5}
                      max={60}
                      value={settings.exam.autosaveIntervalSeconds || 10}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          exam: { ...settings.exam, autosaveIntervalSeconds: parseInt(e.target.value, 10) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Maksimal Pelanggaran Pindah Tab (Kunci Otomatis)</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={settings.exam.maxTabViolationCount || 3}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          exam: { ...settings.exam, maxTabViolationCount: parseInt(e.target.value, 10) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Standar Nilai KKM / KKTP Default</label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={100}
                      value={settings.exam.defaultPassingGrade || 75}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          exam: { ...settings.exam, defaultPassingGrade: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Tab 4: Storage */}
              {activeTab === 'storage' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveCategory('storage', settings.storage);
                  }}
                  className="space-y-4 max-w-xl text-xs"
                >
                  <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                    Kebijakan Penyimpanan & Batas Upload Media
                  </h3>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Maksimal Ukuran Upload per Berkas (MB)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={settings.storage.maxUploadSizeMb || 10}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          storage: { ...settings.storage, maxUploadSizeMb: parseInt(e.target.value, 10) },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Tab 5: Feature Flags */}
              {activeTab === 'featureFlags' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveCategory('featureFlags', settings.featureFlags);
                  }}
                  className="space-y-4 max-w-xl text-xs"
                >
                  <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                    Aktivasi Fitur Platform (Feature Flags)
                  </h3>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <div>
                        <span className="font-bold text-slate-800 block">Bank Soal Global</span>
                        <span className="text-[11px] text-slate-500">Izinkan kurasi dan distribusi naskah soal tingkat wilayah.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.featureFlags?.enableGlobalQuestionBank ?? true}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            featureFlags: { ...settings.featureFlags, enableGlobalQuestionBank: e.target.checked },
                          })
                        }
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <div>
                        <span className="font-bold text-slate-800 block">Ujian Serentak Wilayah</span>
                        <span className="text-[11px] text-slate-500">Aktifkan modul penyelenggaraan asesmen lintas satuan pendidikan.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.featureFlags?.enableRegionalExams ?? true}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            featureFlags: { ...settings.featureFlags, enableRegionalExams: e.target.checked },
                          })
                        }
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                      />
                    </label>
                  </div>

                  <div className="pt-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-xs disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Menyimpan...' : 'Simpan Feature Flags'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
