import { Clock, CheckCircle2, Smartphone, ShieldCheck } from 'lucide-react';

const PILLARS = [
  {
    icon: Clock,
    iconColor: 'text-blue-600 bg-blue-50 border-blue-100',
    title: 'Server Timer',
    desc: 'Waktu ujian disinkronkan dari server, kebal dari manipulasi jam HP.',
  },
  {
    icon: CheckCircle2,
    iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    title: 'Autosave Real-Time',
    desc: 'Tiap jawaban pilihan ganda & essay tersimpan otomatis ke cloud.',
  },
  {
    icon: Smartphone,
    iconColor: 'text-amber-600 bg-amber-50 border-amber-100',
    title: 'Single-Device Lock',
    desc: 'Token terikat pada 1 HP untuk mencegah kecurangan login ganda.',
  },
  {
    icon: ShieldCheck,
    iconColor: 'text-purple-600 bg-purple-50 border-purple-100',
    title: 'Pemulihan Aman',
    desc: 'Pengawas dapat mereset sesi tanpa menghapus jawaban yang tersimpan.',
  },
];

export function PlatformPillars() {
  return (
    <div className="space-y-3">
      <div className="text-center space-y-1">
        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
          Standar Keamanan Sistem CBT
        </h3>
        <p className="text-[11px] text-slate-500">Sagaya Exam dirancang stabil untuk ribuan koneksi smartphone simultan</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.title}
              className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 text-center space-y-1.5 shadow-2xs"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border mx-auto ${p.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-black text-slate-900">{p.title}</h4>
              <p className="text-[10px] sm:text-[11px] text-slate-500 leading-snug">{p.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
