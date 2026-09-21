'use client';

import React, { createContext, useContext, useState, useCallback, useId } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const toastConfig: Record<
  ToastType,
  { bg: string; text: string; icon: React.ReactNode }
> = {
  success: {
    bg: 'bg-emerald-700 text-white',
    text: 'text-white',
    icon: <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />,
  },
  error: {
    bg: 'bg-danger text-white',
    text: 'text-white',
    icon: <XCircle className="w-4 h-4 shrink-0 text-red-200" />,
  },
  warning: {
    bg: 'bg-amber-600 text-white',
    text: 'text-white',
    icon: <AlertTriangle className="w-4 h-4 shrink-0 text-amber-200" />,
  },
  info: {
    bg: 'bg-primary-700 text-white',
    text: 'text-white',
    icon: <Info className="w-4 h-4 shrink-0 text-blue-200" />,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, duration?: number) => showToast(message, 'success', duration),
    [showToast]
  );
  const error = useCallback(
    (message: string, duration?: number) => showToast(message, 'error', duration),
    [showToast]
  );
  const warning = useCallback(
    (message: string, duration?: number) => showToast(message, 'warning', duration),
    [showToast]
  );
  const info = useCallback(
    (message: string, duration?: number) => showToast(message, 'info', duration),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ showToast, success, error, warning, info, removeToast }}
    >
      {children}

      {/* Floating Accessible Toast Container */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => {
          const config = toastConfig[toast.type];
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-elevated border border-white/10 transition-all transform animate-in slide-in-from-bottom-3 duration-200 ${config.bg}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {config.icon}
                <span className="text-xs font-semibold leading-snug truncate">
                  {toast.message}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition"
                aria-label="Tutup pesan"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
