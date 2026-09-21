'use client';

import Link from 'next/link';
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock, RotateCcw, Wrench, Send, DoorOpen } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RecoveryModalState } from './RecoveryModal';

export interface MonitoringParticipant {
  participantId: string;
  studentName: string;
  nisn?: string;
  className?: string;
  roomId?: string;
  roomName?: string;
  roomCode?: string;
  sessionNumber?: number;
  seatNumber?: string;
  token: string;
  status: string;
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
  tabViolationCount: number;
}

interface TableFooterStats {
  total: number;
  inProgress: number;
  submitted: number;
  disconnected: number;
  tabViolationsTotal?: number;
}

interface MonitoringTableProps {
  loading: boolean;
  participants: MonitoringParticipant[];
  selectedIds?: string[];
  onToggleSelect?: (participantId: string) => void;
  onToggleSelectAll?: () => void;
  onSetRecoveryModal: (state: RecoveryModalState) => void;
  stats: TableFooterStats;
}

export function MonitoringTable({
  loading,
  participants,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  onSetRecoveryModal,
  stats,
}: MonitoringTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-16 text-center text-slate-500 text-sm">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>Memuat telemetri realtime pengawas...</span>
        </div>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-16 text-center text-slate-500">
          <ShieldCheck className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <div className="font-bold text-slate-800 text-base">Tidak Ada Peserta Terdeteksi</div>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Tidak ada siswa yang sesuai dengan filter ruang, sesi, status, atau kata kunci pencarian yang dipilih.
          </p>
        </div>
      </div>
    );
  }

  const isAllSelected = participants.length > 0 && selectedIds.length === participants.length;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
              <th className="w-10 px-4 py-3.5 text-center">
                <input
                  type="checkbox"
                  aria-label="Pilih Semua Peserta"
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                />
              </th>
              <th className="px-5 py-3.5">Meja &amp; Ruang</th>
              <th className="px-5 py-3.5">Identitas Peserta</th>
              <th className="px-5 py-3.5">Token Siswa</th>
              <th className="px-5 py-3.5 text-center">Status Sesi</th>
              <th className="px-5 py-3.5">Progres Pengerjaan</th>
              <th className="px-5 py-3.5 text-center">Integritas Layar</th>
              <th className="px-5 py-3.5 text-right">Kendali Cepat Proktor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
            {participants.map((p) => {
              const progressPercent =
                p.totalQuestions > 0 ? Math.round((p.answeredCount / p.totalQuestions) * 100) : 0;
              const isDisconnected = p.status === 'DISCONNECTED';
              const isInProgress = p.status === 'IN_PROGRESS';
              const isSelected = selectedIds.includes(p.participantId);

              return (
                <tr
                  key={p.participantId}
                  className={`hover:bg-slate-50/80 transition ${
                    isSelected
                      ? 'bg-blue-50/60'
                      : isDisconnected
                      ? 'bg-amber-50/40'
                      : p.tabViolationCount > 0
                      ? 'bg-rose-50/20'
                      : ''
                  }`}
                >
                  {/* Row Checkbox */}
                  <td className="w-10 px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${p.studentName}`}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={isSelected}
                      onChange={() => onToggleSelect?.(p.participantId)}
                    />
                  </td>
                  {/* Seat & Room */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-mono font-black text-xs flex items-center justify-center shrink-0">
                        {p.seatNumber || '-'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-xs flex items-center gap-1">
                          <DoorOpen className="w-3 h-3 text-slate-400" />
                          <span>{p.roomName || 'Umum'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          Sesi {p.sessionNumber || 1}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Student Info */}
                  <td className="px-5 py-4">
                    <div className="font-black text-slate-900 text-sm leading-snug">{p.studentName}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      NISN: {p.nisn || '-'} • Rombel: <strong className="text-slate-600">{p.className || '-'}</strong>
                    </div>
                  </td>

                  {/* Token */}
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-xs bg-blue-50 text-blue-700 border border-blue-200/80 px-2.5 py-1 rounded-md">
                      {p.token}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4 text-center whitespace-nowrap">
                    <StatusBadge status={p.status} />
                  </td>

                  {/* Progress */}
                  <td className="px-5 py-4 min-w-[190px]">
                    <div className="flex items-center justify-between text-[11px] mb-1 font-semibold">
                      <span className="text-slate-700">
                        {p.answeredCount} / {p.totalQuestions} Soal
                        {isInProgress && (
                          <span className="text-[10px] text-blue-600 ml-1 font-bold">
                            (No. {p.currentQuestionIndex})
                          </span>
                        )}
                      </span>
                      <span className="text-slate-500">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          p.status === 'SUBMITTED'
                            ? 'bg-emerald-500'
                            : isDisconnected
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </td>

                  {/* Tab Violations */}
                  <td className="px-5 py-4 text-center whitespace-nowrap">
                    {p.tabViolationCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>{p.tabViolationCount}x Pindah Tab</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Bersih</span>
                      </span>
                    )}
                  </td>

                  {/* Quick Proctor Actions */}
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Reset Device / Unbind */}
                      <button
                        type="button"
                        onClick={() => onSetRecoveryModal({ isOpen: true, participant: p, action: 'RESET_DEVICE' })}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs transition flex items-center gap-1"
                        title="Buka Kunci / Unbind Device (Jika PC crash/mati)"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                        <span className="hidden sm:inline">Reset Login</span>
                      </button>

                      {/* Add Time */}
                      <button
                        type="button"
                        onClick={() => onSetRecoveryModal({ isOpen: true, participant: p, action: 'ADD_TIME' })}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 font-bold text-xs transition flex items-center gap-1"
                        title="Tambah Waktu Kompensasi Darurat"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>+Waktu</span>
                      </button>

                      {/* Force Submit (if still in progress or disconnected) */}
                      {p.status !== 'SUBMITTED' && (
                        <button
                          type="button"
                          onClick={() => onSetRecoveryModal({ isOpen: true, participant: p, action: 'FORCE_SUBMIT' })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-700 hover:bg-purple-50 transition"
                          title="Selesaikan Paksa (Force Submit)"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Open Full Recovery Page */}
                      <Link
                        href={`/pengawas/recovery?participantId=${p.participantId}&token=${p.token}&name=${encodeURIComponent(p.studentName)}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="Buka Konsol Recovery Detail"
                      >
                        <Wrench className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-6 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium flex-wrap gap-2">
        <div>
          Menampilkan <strong>{participants.length}</strong> dari <strong>{stats.total}</strong> peserta terdaftar
        </div>
        <div className="flex items-center gap-3 text-slate-600 flex-wrap">
          <span><strong className="text-emerald-700">{stats.inProgress}</strong> Mengerjakan</span>
          <span>•</span>
          <span><strong className="text-teal-700">{stats.submitted}</strong> Selesai</span>
          <span>•</span>
          <span><strong className="text-rose-600">{stats.disconnected}</strong> Terputus</span>
          {stats.tabViolationsTotal !== undefined && stats.tabViolationsTotal > 0 && (
            <>
              <span>•</span>
              <span className="text-rose-600 font-bold">{stats.tabViolationsTotal} Total Pelanggaran Tab</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
