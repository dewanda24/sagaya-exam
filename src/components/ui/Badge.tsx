'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  WifiOff,
  AlertTriangle,
  XCircle,
  FileEdit,
  Eye,
  Send,
  Lock,
  Archive,
  PlayCircle,
  CheckCheck,
  RotateCw,
  Ban,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

export type BadgeVariant =
  | 'primary'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  pulse?: boolean;
}

const badgeVariantStyles: Record<BadgeVariant, string> = {
  primary: 'bg-primary-50 text-primary-700 border-primary-200',
  neutral: 'bg-surface-subtle text-text-secondary border-border',
  success: 'bg-success-bg text-success-text border-success-border',
  warning: 'bg-warning-bg text-warning-text border-warning-border',
  danger: 'bg-danger-bg text-danger-text border-danger-border',
  info: 'bg-info-bg text-info-text border-info-border',
};

const badgeSizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  pulse = false,
  className = '',
  ...props
}) => {
  return (
    <span
      className={`inline-flex items-center font-bold tracking-normal rounded-full border border-solid select-none
        ${badgeVariantStyles[variant]}
        ${badgeSizeStyles[size]}
        ${className}`}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {icon}
      <span>{children}</span>
    </span>
  );
};

// Comprehensive Status Type across Users, Exams, Sessions, Grading, and Async Jobs
export type SagayaStatus =
  // User Accounts
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'LOCKED'
  // Exam Lifecycle & Question Statuses
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'ARCHIVED'
  // Session Lifecycle
  | 'SCHEDULED'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED'
  // Student Exam Participation
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'DISCONNECTED'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'BLOCKED'
  // Grading & Results
  | 'PENDING'
  | 'PARTIALLY_GRADED'
  | 'GRADED'
  | 'REVIEWED'
  | 'VOID'
  // Async Jobs / Export
  | 'QUEUED'
  | 'PROCESSING'
  | 'FAILED';

export interface StatusBadgeProps {
  status: SagayaStatus | string;
  size?: BadgeSize;
  className?: string;
  customLabel?: string;
}

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
  icon: React.ReactNode;
  pulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
  customLabel,
}) => {
  const normalizedStatus = String(status || '').toUpperCase().trim();

  const statusMap: Record<string, StatusConfig> = {
    // User Accounts
    ACTIVE: {
      label: 'Aktif',
      variant: 'success',
      icon: <CheckCircle2 className="w-3 h-3 text-success-solid" />,
    },
    INACTIVE: {
      label: 'Nonaktif',
      variant: 'neutral',
      icon: <XCircle className="w-3 h-3 text-slate-400" />,
    },
    SUSPENDED: {
      label: 'Ditangguhkan',
      variant: 'warning',
      icon: <AlertTriangle className="w-3 h-3 text-warning-solid" />,
    },
    LOCKED: {
      label: 'Terkunci',
      variant: 'danger',
      icon: <Lock className="w-3 h-3 text-danger-solid" />,
    },

    // Exam & Question Lifecycle
    DRAFT: {
      label: 'Draf',
      variant: 'neutral',
      icon: <FileEdit className="w-3 h-3 text-slate-500" />,
    },
    SUBMITTED: {
      label: 'Diajukan',
      variant: 'info',
      icon: <Send className="w-3 h-3 text-info-solid" />,
    },
    REVIEW: {
      label: 'Dalam Review',
      variant: 'warning',
      icon: <Eye className="w-3 h-3 text-warning-solid" />,
    },
    APPROVED: {
      label: 'Disetujui',
      variant: 'success',
      icon: <CheckCircle2 className="w-3 h-3 text-success-solid" />,
    },
    PUBLISHED: {
      label: 'Dipublikasikan',
      variant: 'primary',
      icon: <CheckCheck className="w-3 h-3 text-primary-600" />,
    },
    ARCHIVED: {
      label: 'Diarsipkan',
      variant: 'neutral',
      icon: <Archive className="w-3 h-3 text-slate-400" />,
    },

    // Session Lifecycle
    SCHEDULED: {
      label: 'Terjadwal',
      variant: 'info',
      icon: <Clock className="w-3 h-3 text-info-solid" />,
    },
    ONGOING: {
      label: 'Berlangsung',
      variant: 'success',
      icon: <PlayCircle className="w-3 h-3 text-success-solid" />,
      pulse: true,
    },
    COMPLETED: {
      label: 'Selesai',
      variant: 'neutral',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" />,
    },
    CANCELLED: {
      label: 'Dibatalkan',
      variant: 'danger',
      icon: <Ban className="w-3 h-3 text-danger-solid" />,
    },

    // Student Exam Session States
    NOT_STARTED: {
      label: 'Belum Mulai',
      variant: 'neutral',
      icon: <Clock className="w-3 h-3 text-slate-400" />,
    },
    IN_PROGRESS: {
      label: 'Mengerjakan',
      variant: 'primary',
      icon: <span className="w-1.5 h-1.5 rounded-full bg-primary-600 animate-pulse" />,
      pulse: true,
    },
    DISCONNECTED: {
      label: 'Terputus',
      variant: 'danger',
      icon: <WifiOff className="w-3 h-3 text-danger-solid" />,
    },
    EXPIRED: {
      label: 'Waktu Habis',
      variant: 'warning',
      icon: <Clock className="w-3 h-3 text-warning-solid" />,
    },
    TERMINATED: {
      label: 'Dihentikan',
      variant: 'danger',
      icon: <ShieldAlert className="w-3 h-3 text-danger-solid" />,
    },
    BLOCKED: {
      label: 'Diblokir',
      variant: 'danger',
      icon: <Ban className="w-3 h-3 text-danger-solid" />,
    },

    // Grading & Results
    PENDING: {
      label: 'Menunggu Penilaian',
      variant: 'warning',
      icon: <Clock className="w-3 h-3 text-warning-solid" />,
    },
    PARTIALLY_GRADED: {
      label: 'Sebagian Dinilai',
      variant: 'warning',
      icon: <RotateCw className="w-3 h-3 text-warning-solid" />,
    },
    GRADED: {
      label: 'Sudah Dinilai',
      variant: 'success',
      icon: <CheckCircle2 className="w-3 h-3 text-success-solid" />,
    },
    REVIEWED: {
      label: 'Selesai Direview',
      variant: 'info',
      icon: <CheckCheck className="w-3 h-3 text-info-solid" />,
    },
    VOID: {
      label: 'Dibatalkan / Void',
      variant: 'danger',
      icon: <XCircle className="w-3 h-3 text-danger-solid" />,
    },

    // Async Job & Export Queue
    QUEUED: {
      label: 'Dalam Antrean',
      variant: 'neutral',
      icon: <Clock className="w-3 h-3 text-slate-400" />,
    },
    PROCESSING: {
      label: 'Sedang Diproses',
      variant: 'info',
      icon: <Loader2 className="w-3 h-3 animate-spin text-info-solid" />,
    },
    FAILED: {
      label: 'Gagal',
      variant: 'danger',
      icon: <XCircle className="w-3 h-3 text-danger-solid" />,
    },
  };

  const config = statusMap[normalizedStatus] || {
    label: normalizedStatus || 'Tidak Diketahui',
    variant: 'neutral',
    icon: <AlertTriangle className="w-3 h-3 text-slate-400" />,
  };

  return (
    <Badge
      variant={config.variant}
      size={size}
      icon={config.icon}
      pulse={config.pulse}
      className={className}
    >
      {customLabel || config.label}
    </Badge>
  );
};
