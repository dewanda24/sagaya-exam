'use client';

import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

export function Toast({ message, type }: ToastProps) {
  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold transition-all animate-in slide-in-from-top-3 ${
        type === 'success'
          ? 'bg-emerald-600 text-white shadow-emerald-600/30'
          : 'bg-rose-600 text-white shadow-rose-600/30'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5" />
      ) : (
        <AlertTriangle className="w-5 h-5" />
      )}
      <span>{message}</span>
    </div>
  );
}
