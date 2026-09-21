'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Wrench,
  RotateCcw,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  User,
  AlertTriangle,
  Check,
  Info,
} from 'lucide-react';

function RecoveryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialParticipantId = searchParams.get('participantId') || '';

  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState(initialParticipantId);
  const [loading, setLoading] = useState(false);
  const [confirmForceSubmit, setConfirmForceSubmit] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    async function loadParticipants() {
      try {
        const res = await fetch('/api/proctor/monitoring');
        const json = await res.json();
        if (json.success && json.data) {
          const list = json.data.participants || [];
          setParticipants(list);
          if (!selectedId && list.length > 0) {
            setSelectedId(list[0].participantId);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadParticipants();
  }, [selectedId]);

  const handleAction = async (action: 'RESET_DEVICE' | 'ADD_TIME' | 'FORCE_SUBMIT', extraMins = 10) => {
    if (!selectedId) {
      showToast('Silakan pilih peserta terlebih dahulu.', 'error');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/proctor/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          participantId: selectedId,
          extraMinutes: extraMins,
          additionalMinutes: extraMins,
        }),
      });

      const json = await res.json();

      if (json.success) {
        showToast(json.message || 'Tindakan recovery berhasil dieksekusi.');
        setConfirmForceSubmit(false);
      } else {
        showToast(json.error || 'Aksi gagal dilakukan.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedParticipant = participants.find((p) => p.participantId === selectedId);

  return (
    <AdminLayout>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all animate-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Wrench className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Pusat Recovery & Pemulihan Sesi
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Penanganan kendala teknis darurat: ganti perangkat (device reset), kompensasi waktu, dan force submit.
          </p>
        </div>

        <Link
          href="/pengawas"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Monitoring Live</span>
        </Link>
      </div>

      <div className="max-w-4xl">
        {/* Info Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3.5 text-xs text-blue-900 leading-relaxed">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold block mb-0.5">Panduan Pengawas Ruang:</strong>
            Fitur recovery ini langsung berinteraksi dengan engine sesi CBT Sagaya. Jawaban siswa yang sudah tersimpan di server <strong>aman dan tidak akan hilang</strong> saat sesi di-reset atau dipindahkan ke komputer lain.
          </div>
        </div>

        {/* Card 1: Participant Selector */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs mb-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Pilih Peserta yang Mengalami Kendala:
          </label>

          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-4 py-2.5 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
          >
            {participants.map((p) => (
              <option key={p.participantId} value={p.participantId}>
                {p.studentName} ({p.nisn || '-'} - {p.className || 'Umum'}) • Token: {p.token} • Status: {p.status}
              </option>
            ))}
          </select>

          {selectedParticipant && (
            <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Nama Peserta</span>
                <strong className="text-slate-900 font-bold">{selectedParticipant.studentName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Token Ujian</span>
                <strong className="font-mono text-blue-600 font-bold">{selectedParticipant.token}</strong>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Status Saat Ini</span>
                <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800">
                  {selectedParticipant.status}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Jawaban Tersimpan</span>
                <strong className="text-slate-900 font-bold">
                  {selectedParticipant.answeredCount} / {selectedParticipant.totalQuestions} Soal
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Action 1: Reset Sesi (Device Binding Unlock) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs mb-6 border-l-4 border-l-blue-600">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-slate-900">
                  1. Reset Sesi (Bebaskan Kunci Perangkat)
                </h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                Gunakan saat komputer/laptop siswa rusak, mati mendadak, atau pindah ke komputer cadangan lab. Menghapus ikatan perangkat (<em>device binding</em>) sehingga siswa bisa login ulang menggunakan token yang sama <strong>tanpa kehilangan progres jawaban</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleAction('RESET_DEVICE')}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Kunci Perangkat</span>
            </button>
          </div>
        </div>

        {/* Action 2: Add Compensation Time */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs mb-6 border-l-4 border-l-amber-500">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-slate-900">
                  2. Tambah Waktu Kompensasi Khusus
                </h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                Tambahkan durasi waktu ujian khusus bagi peserta ini jika mengalami gangguan teknis jaringan, pergantian komputer, atau keterlambatan berizin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => handleAction('ADD_TIME', 5)}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition disabled:opacity-50"
            >
              +5 Menit
            </button>
            <button
              type="button"
              onClick={() => handleAction('ADD_TIME', 10)}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition disabled:opacity-50"
            >
              +10 Menit (Standar)
            </button>
            <button
              type="button"
              onClick={() => handleAction('ADD_TIME', 15)}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition disabled:opacity-50"
            >
              +15 Menit
            </button>
            <button
              type="button"
              onClick={() => handleAction('ADD_TIME', 30)}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition disabled:opacity-50"
            >
              +30 Menit (Maks)
            </button>
          </div>
        </div>

        {/* Action 3: Force Submit */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs mb-6 border-l-4 border-l-rose-500">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-slate-900">
                  3. Paksa Selesai (Force Submit)
                </h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                Selesaikan sesi ujian peserta secara sepihak dan hitung nilai akhir jika siswa meninggalkan ruang ujian tanpa mengklik selesai atau waktu ruangan sudah habis.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setConfirmForceSubmit(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Paksa Selesai (Force Submit)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Force Submit */}
      {confirmForceSubmit && selectedParticipant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">
                  Konfirmasi Force Submit
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Apakah Anda yakin ingin menyelesaikan sesi ujian peserta ini secara paksa? Jawaban yang sudah tersimpan akan segera dikunci dan dinilai.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-6 text-xs text-slate-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400">Nama Siswa:</span>
                <span className="font-bold text-slate-900">{selectedParticipant.studentName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Token Ujian:</span>
                <span className="font-mono font-bold text-blue-700">{selectedParticipant.token}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmForceSubmit(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleAction('FORCE_SUBMIT')}
                className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition flex items-center gap-2"
              >
                {loading ? 'Memproses...' : 'Ya, Paksa Selesai'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default function RecoveryPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500 text-sm">Memuat Konsol Recovery...</div>}>
      <RecoveryContent />
    </Suspense>
  );
}
