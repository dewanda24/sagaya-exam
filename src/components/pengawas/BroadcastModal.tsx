'use client';

import { useState } from 'react';
import { X, Megaphone, Send, AlertTriangle } from 'lucide-react';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendBroadcast: (message: string) => Promise<void>;
  isSending: boolean;
}

const TEMPLATES = [
  'Waktu tersisa 10 menit. Mohon periksa kembali semua butir soal!',
  'Waktu ujian kurang 5 menit. Segera selesaikan lembar jawaban Anda!',
  'Dilarang membuka tab atau browser lain. Sistem mencatat seluruh pelanggaran!',
  'Jika layar mengalami masalah koneksi, silakan angkat tangan dan tunggu proktor.',
];

export function BroadcastModal({
  isOpen,
  onClose,
  onSendBroadcast,
  isSending,
}: BroadcastModalProps) {
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSendBroadcast(message.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                Kirim Pengumuman Kilat Siswa
              </h3>
              <p className="text-xs text-slate-500">
                Pesan ini akan langsung muncul sebagai banner peringatan di layar seluruh peserta ujian.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Templates */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Pilihan Pesan Cepat:
          </label>
          <div className="flex flex-col gap-1.5">
            {TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setMessage(tmpl)}
                className="text-left text-xs text-slate-700 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 rounded-xl p-2.5 transition font-medium"
              >
                &ldquo;{tmpl}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Isi Pesan Pengumuman:
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ketik instruksi darurat atau pengingat waktu di sini..."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white transition"
              required
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSending || !message.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-md shadow-rose-600/20 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Mengirim...' : 'Kirim ke Layar Siswa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
