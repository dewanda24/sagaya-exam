'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GuruLayout from '@/components/guru/GuruLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  FileCheck2,
  ArrowLeft,
  Save,
  Clock,
  Calendar,
  Layers,
  Users,
  AlertCircle,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

export default function GuruExamCreatePage() {
  const router = useRouter();

  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [targetClassIds, setTargetClassIds] = useState<string[]>([]);
  const [passingGrade, setPassingGrade] = useState(75);
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [showScorePolicy, setShowScorePolicy] = useState('AFTER_EXAM');

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      try {
        const [sRes, cRes] = await Promise.all([
          fetch('/api/guru/subjects'),
          fetch('/api/guru/classes'),
        ]);
        const sJson = await sRes.json();
        const cJson = await cRes.json();

        if (sJson.success && sJson.data) {
          setSubjects(sJson.data);
          if (sJson.data.length > 0) setSubjectId(sJson.data[0].id);
        }
        if (cJson.success && cJson.data) {
          setClasses(cJson.data);
        }

        // Set default start time to today 08:00, end time to 7 days later 16:00
        const now = new Date();
        now.setMinutes(0);
        now.setSeconds(0);
        const isoStart = now.toISOString().slice(0, 16);
        const nextWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
        const isoEnd = nextWeek.toISOString().slice(0, 16);
        setStartTime(isoStart);
        setEndTime(isoEnd);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data formulir.');
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  const handleToggleClass = (classId: string) => {
    if (targetClassIds.includes(classId)) {
      setTargetClassIds(targetClassIds.filter((id) => id !== classId));
    } else {
      setTargetClassIds([...targetClassIds, classId]);
    }
  };

  const handleSelectAllClasses = () => {
    if (targetClassIds.length === classes.length) {
      setTargetClassIds([]);
    } else {
      setTargetClassIds(classes.map((c) => c.id));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Judul paket ujian wajib diisi.');
      return;
    }
    if (!subjectId) {
      setError('Pilih mata pelajaran yang diujikan.');
      return;
    }
    if (durationMinutes < 5) {
      setError('Durasi ujian minimal 5 menit.');
      return;
    }
    if (targetClassIds.length === 0) {
      setError('Pilih minimal satu kelas / rombel target peserta ujian.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/guru/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subjectId,
          durationMinutes: Number(durationMinutes),
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          targetClassIds,
          passingGrade: Number(passingGrade),
          randomizeQuestions,
          randomizeOptions,
          showScorePolicy,
        }),
      });

      const json = await res.json();
      if (json.success) {
        router.push(`/guru/exams/${json.data.id}`);
      } else {
        setError(json.error || 'Gagal membuat paket ujian.');
        setSaving(false);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
      setSaving(false);
    }
  };

  return (
    <GuruLayout
      title="Buat Paket Ujian Baru"
      subtitle="Konfigurasi jadwal pelaksanaan, alokasi waktu pengerjaan, dan sasaran rombongan belajar peserta"
      breadcrumbs={[
        { label: 'Dashboard', href: '/guru/dashboard' },
        { label: 'Ujian', href: '/guru/exams' },
        { label: 'Buat Paket Ujian' },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {error && (
          <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 flex items-center gap-2 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-danger-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-6">
          {/* General Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-primary-600" />
                Identitas Asesmen & Mata Pelajaran
              </CardTitle>
              <CardDescription>
                Tentukan nama paket ujian dan mata pelajaran yang diampu
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Judul / Nama Paket Ujian <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Asesmen Tengah Semester Ganjil - Fisika Terapan"
                  className="w-full py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mata Pelajaran <span className="text-danger-500">*</span>
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full py-2.5 px-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-semibold text-slate-800"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Kriteria Ketuntasan Minimal (KKM / Passing Grade)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={passingGrade}
                    onChange={(e) => setPassingGrade(parseInt(e.target.value, 10) || 75)}
                    className="w-full py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule & Duration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-600" />
                Alokasi Waktu & Rentang Akses Pengerjaan
              </CardTitle>
              <CardDescription>
                Atur durasi countdown timer saat siswa mengerjakan dan batas jendela akses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Durasi Ujian (Menit) <span className="text-danger-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="5"
                    max="360"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 90)}
                    className="w-36 py-2 px-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono font-bold"
                  />
                  <span className="text-xs text-slate-500">
                    Siswa memiliki waktu {durationMinutes} menit terhitung sejak menekan tombol Mulai Ujian.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Waktu Mulai Akses (Jadwal Buka) <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full py-2 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Waktu Berakhir Akses (Jadwal Tutup) <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full py-2 px-3 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Target Classes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary-600" />
                  Sasaran Rombongan Belajar Peserta
                </CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllClasses}
                  className="text-xs text-primary-600"
                >
                  {targetClassIds.length === classes.length ? 'Batalkan Semua' : 'Pilih Semua Kelas'}
                </Button>
              </div>
              <CardDescription>
                Pilih rombel siswa yang berhak mengikuti ujian ini dari kelas yang Anda ampu
              </CardDescription>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                  Belum ada rombel yang ditugaskan kepada Anda. Hubungi administrator sekolah.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {classes.map((c) => {
                    const isSelected = targetClassIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'bg-primary-50/80 border-primary-300 text-primary-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleClass(c.id)}
                          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 mt-0.5"
                        />
                        <div className="text-xs leading-relaxed">
                          <div className="font-bold text-slate-900">{c.name}</div>
                          <div className="text-slate-500 mt-0.5">
                            {c.studentCount} Siswa • TA {c.academicYear || '-'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Exam Rules & Policies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary-600" />
                Ketentuan Acak & Pengumuman Skor
              </CardTitle>
              <CardDescription>
                Pengaturan psikometrik pengacakan urutan soal dan visibilitas hasil asesmen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={randomizeQuestions}
                    onChange={(e) => setRandomizeQuestions(e.target.checked)}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 mt-0.5"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">Acak Urutan Soal</span>
                    <span className="text-slate-500">
                      Setiap peserta akan menerima urutan butir soal yang berbeda secara acak.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={randomizeOptions}
                    onChange={(e) => setRandomizeOptions(e.target.checked)}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 mt-0.5"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">Acak Pilihan Opsi Jawaban</span>
                    <span className="text-slate-500">
                      Pilihan opsi A, B, C, D diacak bagi setiap siswa untuk mencegah kecurangan.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kebijakan Penayangan Skor kepada Siswa
                </label>
                <select
                  value={showScorePolicy}
                  onChange={(e) => setShowScorePolicy(e.target.value)}
                  className="w-full max-w-md py-2 px-3 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="AFTER_EXAM">Tampilkan skor segera setelah siswa submit ujian</option>
                  <option value="AFTER_WINDOW_CLOSED">
                    Tampilkan skor hanya setelah seluruh sesi ujian berakhir
                  </option>
                  <option value="NEVER">
                    Jangan tampilkan skor (Hasil dirilis secara privat oleh pengajar)
                  </option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <Link href="/guru/exams">
              <Button variant="outline" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Batal
              </Button>
            </Link>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={saving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Simpan & Lanjutkan ke Pemilihan Soal
            </Button>
          </div>
        </form>
      </div>
    </GuruLayout>
  );
}
