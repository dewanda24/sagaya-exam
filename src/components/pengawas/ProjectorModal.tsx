'use client';

import { useState, useEffect } from 'react';
import { X, Tv, Clock, ShieldCheck, Maximize2 } from 'lucide-react';

interface ProjectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: {
    title: string;
    releaseToken?: string;
    tokenExpiresAt?: string;
  } | null;
  activeRoomName?: string;
  activeSessionNumber?: string | number;
}

export function ProjectorModal({
  isOpen,
  onClose,
  exam,
  activeRoomName = 'Semua Lab',
  activeSessionNumber = 'Semua Sesi',
}: ProjectorModalProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const expiresAt = exam?.tokenExpiresAt ? new Date(exam.tokenExpiresAt).getTime() : 0;

  useEffect(() => {
    if (!isOpen || !expiresAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setRemainingSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen, expiresAt]);

  if (!isOpen || !exam) return null;

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const tokenChars = (exam.releaseToken || '------').split('');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-between p-6 sm:p-12 animate-in fade-in duration-200">
      {/* Top Bar: Exam Info & Close Button */}
      <div className="w-full flex items-center justify-between max-w-6xl mx-auto border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/30">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-blue-400 font-extrabold">
              TAMPILAN PROYEKTOR RUANG UJIAN
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {exam.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-400 font-medium">Lokasi &amp; Sesi</div>
            <div className="text-sm font-bold text-slate-200">
              {activeRoomName} • Sesi {activeSessionNumber}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Tutup Mode Proyektor (ESC)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Center: Gigantic Token Display */}
      <div className="flex flex-col items-center justify-center my-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-black uppercase tracking-widest mb-6">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          TOKEN MASUK SESI UJIAN HARI INI
        </div>

        {/* Big Letters */}
        <div className="flex items-center gap-3 sm:gap-6 my-4">
          {tokenChars.map((char, idx) => (
            <div
              key={idx}
              className="w-16 h-24 sm:w-28 sm:h-40 rounded-3xl bg-slate-900 border-2 border-amber-400/80 text-amber-300 font-mono text-4xl sm:text-8xl font-black flex items-center justify-center shadow-2xl shadow-amber-500/10 drop-shadow-md select-all"
            >
              {char}
            </div>
          ))}
        </div>

        {/* Timer Bar */}
        <div className="mt-8 flex items-center gap-2.5 text-slate-300 text-sm sm:text-base font-semibold bg-slate-900/80 px-6 py-2.5 rounded-2xl border border-slate-800">
          <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
          <span>Masa Aktif Token:</span>
          <span className="font-mono font-black text-amber-400 text-lg">
            {formatTimer(remainingSeconds)}
          </span>
        </div>

        <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-6 leading-relaxed">
          Silakan masukkan token di atas pada halaman masuk ujian siswa di perangkat masing-masing sebelum batas waktu berakhir.
        </p>
      </div>

      {/* Footer Instructions */}
      <div className="w-full text-center text-xs text-slate-500 border-t border-slate-900 pt-6">
        Sagaya Exam CBT Engine • Dikelola oleh Pengawas &amp; Proktor Ruang
      </div>
    </div>
  );
}
