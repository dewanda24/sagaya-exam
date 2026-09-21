'use client';

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
} from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const alertConfig: Record<
  AlertVariant,
  { bg: string; border: string; text: string; icon: React.ReactNode }
> = {
  info: {
    bg: 'bg-info-bg',
    border: 'border-info-border',
    text: 'text-info-text',
    icon: <Info className="w-5 h-5 text-info-text shrink-0" />,
  },
  success: {
    bg: 'bg-success-bg',
    border: 'border-success-border',
    text: 'text-success-text',
    icon: <CheckCircle2 className="w-5 h-5 text-success-text shrink-0" />,
  },
  warning: {
    bg: 'bg-warning-bg',
    border: 'border-warning-border',
    text: 'text-warning-text',
    icon: <AlertTriangle className="w-5 h-5 text-warning-text shrink-0" />,
  },
  danger: {
    bg: 'bg-danger-bg',
    border: 'border-danger-border',
    text: 'text-danger-text',
    icon: <XCircle className="w-5 h-5 text-danger-text shrink-0" />,
  },
};

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  icon,
  onClose,
  className = '',
}) => {
  const config = alertConfig[variant];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 sm:p-4 rounded-lg border transition-all ${config.bg} ${config.border} ${className}`}
    >
      <div className="mt-0.5">{icon || config.icon}</div>

      <div className="flex-1 min-w-0">
        {title && (
          <h3 className={`text-sm font-bold tracking-tight mb-0.5 ${config.text}`}>
            {title}
          </h3>
        )}
        <div className={`text-xs sm:text-sm leading-relaxed ${config.text}`}>
          {children}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={`p-1 rounded-md transition hover:bg-black/5 ${config.text}`}
          aria-label="Tutup notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
