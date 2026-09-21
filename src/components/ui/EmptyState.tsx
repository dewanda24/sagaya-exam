'use client';

import React from 'react';
import { FileQuestion, AlertCircle, RefreshCw, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <FileQuestion className="w-8 h-8 text-text-muted" />,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center border-2 border-dashed border-border rounded-lg bg-surface/50 ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-surface-subtle flex items-center justify-center mb-4 border border-border">
        {icon}
      </div>
      <h3 className="text-base font-bold text-text-primary tracking-tight">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-text-muted max-w-sm mt-1 mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Terjadi Kesalahan',
  message = 'Tidak dapat memuat data. Silakan coba beberapa saat lagi.',
  onRetry,
  onBack,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-lg border border-danger-border bg-danger-bg/40 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-danger-bg flex items-center justify-center mb-4 border border-danger-border text-danger">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-text-primary tracking-tight">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-text-secondary max-w-sm mt-1 mb-6 leading-relaxed">
        {message}
      </p>
      <div className="flex items-center gap-3">
        {onBack && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Kembali
          </Button>
        )}
        {onRetry && (
          <Button
            variant="primary"
            size="sm"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Coba Lagi
          </Button>
        )}
      </div>
    </div>
  );
};

export interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Memuat data...',
  size = 'md',
  className = '',
}) => {
  const spinnerSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center text-text-muted gap-3 ${className}`}
    >
      <Loader2 className={`animate-spin text-primary-600 ${spinnerSizes[size]}`} />
      <span className="text-xs font-semibold">{message}</span>
    </div>
  );
};
