import { ShieldCheck, BatteryCharging, KeyRound, AlertTriangle, RefreshCw, Smartphone, PhoneOff } from 'lucide-react';

const RULES = [
  {
    icon: BatteryCharging,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    title: 'Baterai & Daya HP',
    desc: 'Pastikan baterai HP di atas 80% atau bawa powerbank/charger. Jangan biarkan HP mati saat mengerjakan soal.',
  },
  {
    icon: PhoneOff,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    title: 'Mode Jangan Ganggu',
    desc: 'Aktifkan mode "Do Not Disturb" di HP agar ujian tidak terputus oleh panggilan telepon atau notifikasi medsos.',
  },
  {
    icon: AlertTriangle,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    title: 'Larangan Pindah Aplikasi',
    desc: 'Sistem mencatat otomatis bila Anda keluar browser, membuka tab lain, atau beralih aplikasi.',
  },
  {
    icon: RefreshCw,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    title: 'Pemulihan Sesi (Recovery)',
    desc: 'Jika HP restart atau browser tertutup, jawaban Anda aman di server. Segera lapor Pengawas untuk reset sesi.',
  },
];

export function ExamRules() {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            Tata Tertib &amp; Panduan Ujian di HP
          </h3>
        </div>
        <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
          Prosedur Resmi Siswa
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {RULES.map((rule, idx) => {
          const Icon = rule.icon;
          return (
            <div
              key={rule.title}
              className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/70"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 ${rule.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <span className="text-slate-400 text-[10px]">#{idx + 1}</span>
                  <span>{rule.title}</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px] sm:text-xs">
                  {rule.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
