'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ChevronDown,
  Check,
  Plus,
  Search,
  Sparkles,
  ShieldCheck,
  Globe2,
} from 'lucide-react';

interface SchoolItem {
  id: string;
  code: string;
  name: string;
  level: string;
  logoUrl?: string;
  stats?: {
    totalStudents: number;
    totalExams: number;
  };
}

export default function SchoolSwitcher() {
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<string>('ALL');
  const [userRole, setUserRole] = useState<string>('ADMIN');
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchActiveSchool = async () => {
    try {
      const res = await fetch('/api/admin/active-school');
      const json = await res.json();
      if (json.success) {
        setActiveSchoolId(json.data.activeSchoolId || 'ALL');
        setUserRole(json.data.userRole || 'ADMIN');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSchools = async () => {
    try {
      const res = await fetch('/api/admin/schools');
      const json = await res.json();
      if (json.success && json.data) {
        const list = Array.isArray(json.data.schools)
          ? json.data.schools
          : Array.isArray(json.data)
          ? json.data
          : [];
        setSchools(list);
      } else {
        setSchools([]);
      }
    } catch (err) {
      console.error(err);
      setSchools([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSchool();
    fetchSchools();

    const handleSchoolChanged = () => {
      fetchActiveSchool();
      fetchSchools();
    };
    window.addEventListener('sagaya:school-changed', handleSchoolChanged);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('sagaya:school-changed', handleSchoolChanged);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectSchool = async (schoolId: string) => {
    try {
      await fetch('/api/admin/active-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: schoolId === 'ALL' ? null : schoolId }),
      });
      setActiveSchoolId(schoolId);
      setIsOpen(false);
      router.refresh();
      window.dispatchEvent(new CustomEvent('sagaya:school-changed', { detail: { schoolId } }));
    } catch (err) {
      console.error(err);
    }
  };

  const currentSchool =
    schools.find((s) => s.id === activeSchoolId) || (schools.length > 0 ? schools[0] : null);
  const filteredSchools = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  if (userRole !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Super Admin Switcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-2xs text-left group"
      >
        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
          {activeSchoolId === 'ALL' ? (
            <Globe2 className="w-4 h-4" />
          ) : currentSchool?.logoUrl ? (
            <img src={currentSchool.logoUrl} alt="Logo" className="w-6 h-6 object-contain rounded" />
          ) : (
            <Building2 className="w-4 h-4" />
          )}
        </div>
        <div className="hidden sm:block text-left max-w-[180px] md:max-w-[220px] truncate">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs text-slate-900 truncate">
              {activeSchoolId === 'ALL' ? 'Semua Sekolah (Global)' : currentSchool?.name || 'Pilih Sekolah'}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
              SuperAdmin
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium truncate">
            {activeSchoolId === 'ALL'
              ? `${schools.length} Lembaga Terdaftar`
              : `${currentSchool?.code} • ${currentSchool?.level || 'SMA'}`}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Dropdown for Super Admin */}
      {isOpen && userRole === 'SUPER_ADMIN' && (
        <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 pt-1 pb-2 border-b border-slate-100">
            <div className="text-xs font-bold text-slate-900 mb-1">Pilih Konteks Sekolah</div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari sekolah / NPSN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {/* Global All Schools Option */}
            <button
              type="button"
              onClick={() => handleSelectSchool('ALL')}
              className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 transition ${
                activeSchoolId === 'ALL' ? 'bg-indigo-50/70 text-indigo-900' : 'text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Globe2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-bold text-xs">Semua Sekolah (Global)</div>
                  <div className="text-[10px] text-slate-500">Lihat data gabungan seluruh sistem</div>
                </div>
              </div>
              {activeSchoolId === 'ALL' && <Check className="w-4 h-4 text-indigo-600" />}
            </button>

            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Daftar Satuan Pendidikan ({filteredSchools.length})
            </div>

            {filteredSchools.map((school) => {
              const isSelected = activeSchoolId === school.id;
              return (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => handleSelectSchool(school.id)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 transition ${
                    isSelected ? 'bg-indigo-50/70 text-indigo-900' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 font-bold text-[10px]">
                      {school.logoUrl ? (
                        <img src={school.logoUrl} alt="" className="w-5 h-5 object-contain" />
                      ) : (
                        school.level
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs truncate">{school.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                        <span>{school.code}</span>
                        <span>•</span>
                        <span>{school.stats?.totalStudents || 0} Siswa</span>
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          <div className="p-2 border-t border-slate-100 mt-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push('/admin/sekolah');
              }}
              className="w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Kelola & Daftarkan Sekolah</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
