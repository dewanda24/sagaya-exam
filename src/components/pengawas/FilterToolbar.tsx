'use client';

import { Search, Calendar, DoorOpen, Layers, Filter } from 'lucide-react';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'Semua' },
  { id: 'IN_PROGRESS', label: 'Mengerjakan' },
  { id: 'SUBMITTED', label: 'Selesai' },
  { id: 'DISCONNECTED', label: 'Terputus' },
  { id: 'NOT_STARTED', label: 'Belum Masuk' },
];

interface FilterToolbarProps {
  searchFilter: string;
  statusFilter: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: string) => void;
  availableExams?: { id: string; title: string; status: string }[];
  selectedExamId?: string;
  onExamChange?: (examId: string) => void;
  rooms?: { id: string; code: string; name: string }[];
  selectedRoomId?: string;
  onRoomChange?: (roomId: string) => void;
  sessions?: number[];
  selectedSession?: string | number;
  onSessionChange?: (session: string | number) => void;
}

export function FilterToolbar({
  searchFilter,
  statusFilter,
  onSearchChange,
  onStatusChange,
  availableExams = [],
  selectedExamId,
  onExamChange,
  rooms = [],
  selectedRoomId = 'ALL',
  onRoomChange,
  sessions = [],
  selectedSession = 'ALL',
  onSessionChange,
}: FilterToolbarProps) {
  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs mb-6 space-y-4">
      {/* Top Row: Selectors (Exam, Lab Room, Session) */}
      <div className="flex items-center gap-3 flex-wrap pb-3 border-b border-slate-100">
        {/* Exam Dropdown */}
        {availableExams.length > 0 && onExamChange && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ujian:</span>
            <select
              value={selectedExamId || ''}
              onChange={(e) => onExamChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              {availableExams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.status})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Room / Lab Dropdown */}
        {onRoomChange && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <DoorOpen className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ruang/Lab:</span>
            <select
              value={selectedRoomId}
              onChange={(e) => onRoomChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Ruangan</option>
              {rooms.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  {rm.code} - {rm.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Session Dropdown */}
        {onSessionChange && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sesi:</span>
            <select
              value={String(selectedSession)}
              onChange={(e) => onSessionChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Sesi</option>
              {sessions.length > 0 ? (
                sessions.map((s) => (
                  <option key={s} value={String(s)}>
                    Sesi {s}
                  </option>
                ))
              ) : (
                <>
                  <option value="1">Sesi 1</option>
                  <option value="2">Sesi 2</option>
                  <option value="3">Sesi 3</option>
                </>
              )}
            </select>
          </div>
        )}
      </div>

      {/* Bottom Row: Search & Status Filter Badges */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama siswa, NISN, rombel, nomor meja, atau token..."
            value={searchFilter}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onStatusChange(st.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === st.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
