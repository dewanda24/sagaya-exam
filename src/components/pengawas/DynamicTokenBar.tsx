'use client';

import { useState, useEffect } from 'react';
import { KeyRound, RefreshCw, Copy, Check, Tv, Megaphone, Clock, AlertCircle } from 'lucide-react';

interface DynamicTokenBarProps {
  exam: {
    id: string;
    title: string;
    status: string;
    releaseToken?: string;
    tokenReleasedAt?: string;
    tokenExpiresAt?: string;
    activeBroadcastMessage?: string;
  } | null;
  onReleaseToken: (durationMinutes: number) => Promise<void>;
  onOpenBroadcastModal: () => void;
  onOpenProjectorModal: () => void;
  isReleasing: boolean;
}

export function DynamicTokenBar({
  exam,
  onReleaseToken,
  onOpenBroadcastModal,
  onOpenProjectorModal,
  isReleasing,
}: DynamicTokenBarProps) {
  const [copied, setCopied] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [tokenDuration, setTokenDuration] = useState<number>(15);

  const token = exam?.releaseToken || '------';
  const expiresAt = exam?.tokenExpiresAt ? new Date(exam.tokenExpiresAt).getTime() : 0;

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setRemainingSeconds(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleCopy = () => {
    if (!exam?.releaseToken) return;
    navigator.clipboard.writeText(exam.releaseToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isTokenExpired = remainingSeconds <= 0 && !!exam?.tokenExpiresAt;
  const isTokenActive = remainingSeconds > 0 && !!exam?.releaseToken;

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!exam) return null;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 mb-6 shadow-xl border border-blue-900/50">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left: Token Display Box */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap sm:flex-nowrap">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-blue-400">
            <KeyRound className="w-7 h-7" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-300">
                Token Rilis Sesi Dinamis
              </span>
              {isTokenActive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Aktif (Sisa {formatTimer(remainingSeconds)})
                </span>
              )}
              {isTokenExpired && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <AlertCircle className="w-3 h-3 text-rose-400" />
                  Kedaluwarsa (Rilis Ulang)
                </span>
              )}
            </div>

            {/* Token Letters */}
            <div className="flex items-center gap-3">
              <div className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-amber-300 drop-shadow-md bg-white/10 px-4 py-1.5 rounded-2xl border border-white/10 select-all">
                {token}
              </div>

              <button
                type="button"
                onClick={handleCopy}
                disabled={!exam.releaseToken}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition border border-white/10 flex items-center gap-1.5 text-xs font-bold"
                title="Salin Token Sesi"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-300" />
                    <span className="hidden sm:inline">Salin</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-300 mt-1">
              Umumkan token ini di papan tulis lab atau gunakan Mode Proyektor agar siswa dapat login sesi.
            </p>
          </div>
        </div>

        {/* Right: Quick Proctor Actions */}
        <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-start lg:justify-end border-t border-white/10 pt-4 lg:border-t-0 lg:pt-0">
          <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
            <Clock className="w-3.5 h-3.5 text-blue-300" />
            <span className="text-xs text-blue-200 font-semibold">Masa:</span>
            <select
              value={tokenDuration}
              onChange={(e) => setTokenDuration(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value={15} className="bg-slate-900 text-white">15 Menit</option>
              <option value={30} className="bg-slate-900 text-white">30 Menit</option>
              <option value={60} className="bg-slate-900 text-white">60 Menit</option>
              <option value={120} className="bg-slate-900 text-white">2 Jam</option>
            </select>
          </div>

          <button
            type="button"
            disabled={isReleasing}
            onClick={() => onReleaseToken(tokenDuration)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReleasing ? 'animate-spin' : ''}`} />
            <span>{isReleasing ? 'Merilis...' : 'Rilis Token Baru'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenProjectorModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition border border-blue-400/30 shadow-md shadow-blue-600/20"
            title="Tampilkan Token Layar Penuh di Proyektor Lab"
          >
            <Tv className="w-4 h-4" />
            <span>Mode Proyektor</span>
          </button>

          <button
            type="button"
            onClick={onOpenBroadcastModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition border border-rose-400/30 shadow-md shadow-rose-600/20"
            title="Kirim Pengumuman Kilat ke Layar Siswa"
          >
            <Megaphone className="w-4 h-4" />
            <span>Pesan Kilat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
