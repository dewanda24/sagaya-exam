'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Clock, Check, Send, AlertTriangle, X } from 'lucide-react';

export interface RecoveryModalState {
  isOpen: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  participant?: any;
  action?: 'RESET_DEVICE' | 'ADD_TIME' | 'FORCE_SUBMIT';
  isLoading?: boolean;
}

interface RecoveryModalProps {
  modal: RecoveryModalState;
  onClose: () => void;
  onConfirm: (action: 'RESET_DEVICE' | 'ADD_TIME' | 'FORCE_SUBMIT', participant: any, extraMins?: number) => void;
}

export function RecoveryModal({ modal, onClose, onConfirm }: RecoveryModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState(10);

  useEffect(() => {
    if (modal.isOpen) {
      setSelectedMinutes(10);
    }
  }, [modal.isOpen]);

  if (!modal.isOpen || !modal.participant) return null;

  const action = modal.action || 'RESET_DEVICE';
  const isReset = action === 'RESET_DEVICE';
  const isAddTime = action === 'ADD_TIME';
  const isForceSubmit = action === 'FORCE_SUBMIT';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                isReset
                  ? 'bg-rose-50 text-rose-600 border-rose-100'
                  : isAddTime
                  ? 'bg-amber-50 text-amber-600 border-amber-100'
                  : 'bg-purple-50 text-purple-600 border-purple-100'
              }`}
            >
              {isReset && <RotateCcw className="w-6 h-6" />}
              {isAddTime && <Clock className="w-6 h-6" />}
              {isForceSubmit && <Send className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                {isReset && 'Reset Login / Buka Kunci Perangkat'}
                {isAddTime && 'Tambah Waktu Kompensasi'}
                {isForceSubmit && 'Selesaikan Sesi Siswa Secara Paksa'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {isReset && 'Buka ikatan device siswa saat komputer crash atau mati lampu. Jawaban yang telah dikerjakan tetap tersimpan aman.'}
                {isAddTime && 'Perpanjang durasi sisa waktu ujian siswa untuk kompensasi kendala teknis atau gangguan koneksi lab.'}
                {isForceSubmit && 'Kumpulkan lembar jawaban siswa dan hitung skor akhir otomatis sekarang juga.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student Context Card */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 mb-5 text-xs text-slate-700">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400">Nama Siswa:</span>
            <span className="font-bold text-slate-900">{modal.participant.studentName}</span>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400">Rombel / Kelas:</span>
            <span className="font-semibold text-slate-800">{modal.participant.className || '-'}</span>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400">Ruang / Meja:</span>
            <span className="font-semibold text-blue-700">
              {modal.participant.roomName || '-'} (Meja {modal.participant.seatNumber || '-'})
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Token Masuk Siswa:</span>
            <span className="font-mono font-bold text-blue-700">{modal.participant.token}</span>
          </div>
        </div>

        {/* Extra Minutes Selector for ADD_TIME */}
        {isAddTime && (
          <div className="mb-5">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              Pilih Tambahan Waktu:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setSelectedMinutes(mins)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-black transition border ${
                    selectedMinutes === mins
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  +{mins} Menit
                </button>
              ))}
            </div>
          </div>
        )}

        {isForceSubmit && (
          <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Tindakan ini tidak dapat dibatalkan. Sesi siswa akan segera berakhir dan skor langsung dikunci.
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={modal.isLoading}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={modal.isLoading}
            onClick={() => onConfirm(action, modal.participant, selectedMinutes)}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition flex items-center gap-2 ${
              isReset
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                : isAddTime
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                : 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
            }`}
          >
            {modal.isLoading ? (
              <span>Menerapkan...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>
                  {isReset && 'Reset Login Siswa'}
                  {isAddTime && `Tambah +${selectedMinutes} Menit`}
                  {isForceSubmit && 'Kumpulkan Paksa'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
