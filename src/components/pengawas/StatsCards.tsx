interface ExamStats {
  total: number;
  notStarted: number;
  inProgress: number;
  submitted: number;
  disconnected: number;
  expired: number;
}

interface StatsCardsProps {
  stats: ExamStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 mb-8">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 border-l-blue-600">
        <div className="text-[11px] font-semibold text-slate-500">Total Peserta</div>
        <div className="text-2xl font-black text-slate-900 mt-0.5">{stats.total}</div>
        <div className="text-[10px] text-slate-400 mt-1">Siswa Terdaftar</div>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 border-l-emerald-500">
        <div className="text-[11px] font-semibold text-emerald-600">Sedang Mengerjakan</div>
        <div className="text-2xl font-black text-emerald-600 mt-0.5">{stats.inProgress}</div>
        <div className="text-[10px] text-emerald-500/80 mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Koneksi Aktif
        </div>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 border-l-teal-600">
        <div className="text-[11px] font-semibold text-teal-700">Selesai / Terkirim</div>
        <div className="text-2xl font-black text-teal-700 mt-0.5">{stats.submitted}</div>
        <div className="text-[10px] text-teal-600/80 mt-1">Jawaban Tersimpan</div>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 border-l-rose-500">
        <div className="text-[11px] font-semibold text-rose-600">Terputus / Gangguan</div>
        <div className="text-2xl font-black text-rose-600 mt-0.5">{stats.disconnected}</div>
        <div className="text-[10px] text-rose-500/80 mt-1">Perlu Reset Login</div>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs border-l-4 border-l-slate-400">
        <div className="text-[11px] font-semibold text-slate-500">Belum Masuk</div>
        <div className="text-2xl font-black text-slate-700 mt-0.5">{stats.notStarted}</div>
        <div className="text-[10px] text-slate-400 mt-1">Belum Input Token</div>
      </div>
    </div>
  );
}
