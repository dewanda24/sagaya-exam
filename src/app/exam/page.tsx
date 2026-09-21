'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, KeyRound, ArrowRight, AlertCircle, Laptop, Sparkles, CheckCircle2 } from 'lucide-react';
import { formatTokenInput, isValidTokenFormat } from '@/lib/school/token-generator';

function ExamEntranceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') || '';

  const [token, setToken] = useState(formatTokenInput(initialToken));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    // Generate or retrieve stable device identifier
    let storedId = localStorage.getItem('sagaya_exam_device_id');
    if (!storedId) {
      storedId = 'dev-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
      localStorage.setItem('sagaya_exam_device_id', storedId);
    }
    setDeviceId(storedId);
  }, []);

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTokenInput(e.target.value);
    setToken(formatted);
    if (error) setError(null);
  };

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Silakan masukkan token ujian Anda.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const activeDeviceId = deviceId || 'web-client-' + Math.random().toString(36).substring(2, 9);
      const res = await fetch('/api/exam/authenticate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': activeDeviceId,
        },
        body: JSON.stringify({
          token,
          deviceId: activeDeviceId,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error || 'Autentikasi ujian gagal. Periksa kembali token Anda.');
      } else {
        // Successful authentication: navigate to exam lobby
        router.push('/exam/lobby');
      }
    } catch (err: any) {
      setError('Gagal menghubungi server ujian. Periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden text-slate-100 font-sans">
      {/* Dynamic Background Accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="w-full max-w-md relative z-10">
        {/* Sagaya Exam Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-blue-600 shadow-xl shadow-indigo-500/25 mb-4 border border-white/20">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200">
            SAGAYA EXAM
          </h1>
          <p className="text-sm text-indigo-200/70 mt-1 font-medium">
            Portal Ujian Siswa Berbasis Token Aman
          </p>
        </div>

        {/* Entry Card */}
        <div className="bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8">
          <form onSubmit={handleAuthenticate} className="space-y-5">
            <div>
              <label htmlFor="token-input" className="block text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-2">
                Kode Ujian / Token Peserta
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <input
                  id="token-input"
                  type="text"
                  maxLength={9}
                  placeholder="XXXX-XXXX"
                  value={token}
                  onChange={handleTokenChange}
                  autoComplete="off"
                  autoFocus
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-800/80 border border-indigo-500/30 rounded-xl text-center text-xl sm:text-2xl font-mono font-bold tracking-widest text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all shadow-inner"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                Masukkan 8 karakter kode token yang tertera pada kartu ujian Anda.
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-red-950/60 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-200 text-sm">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-500 via-blue-600 to-indigo-600 hover:from-indigo-400 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi Token...</span>
                </>
              ) : (
                <>
                  <span>Masuk Ujian</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Banner */}
          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Laptop className="w-4 h-4 text-indigo-400" />
              <span>Device Bound</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Anti-IDOR Protected</span>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-slate-500 mt-6">
          Sagaya Exam Engine &bull; Sistem Terenkripsi Multitenant &copy; 2026
        </p>
      </div>
    </div>
  );
}

export default function ExamEntrancePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Memuat sistem ujian...</div>}>
      <ExamEntranceContent />
    </Suspense>
  );
}
