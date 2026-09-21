'use client';

import React, { useEffect, useRef } from 'react';
import { X, AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
}

const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEsc = true,
  className = '',
  title,
  subtitle,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEsc) {
        onClose();
        return;
      }

      // Focus trap for accessibility
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus into modal
    const focusTimer = setTimeout(() => {
      if (modalRef.current) {
        const firstInput = modalRef.current.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), button:not([disabled])'
        );
        if (firstInput) {
          firstInput.focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previous active element
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={`bg-surface border border-border rounded-xl shadow-elevated w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] ${modalSizes[size]} ${className}`}
      >
        {title && <ModalHeader title={title} subtitle={subtitle} onClose={onClose} />}
        {title ? <div className="p-5 sm:p-6 overflow-y-auto flex-1">{children}</div> : children}
      </div>
    </div>
  );
};

export const ModalHeader: React.FC<{
  title: string;
  subtitle?: string;
  onClose?: () => void;
  className?: string;
}> = ({ title, subtitle, onClose, className = '' }) => {
  return (
    <div
      className={`p-5 sm:p-6 pb-4 border-b border-divider flex items-start justify-between gap-4 ${className}`}
    >
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-bold text-text-primary tracking-tight truncate">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-slate-100 transition shrink-0"
          aria-label="Tutup dialog"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const ModalBody: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`p-5 sm:p-6 overflow-y-auto flex-1 ${className}`}>
      {children}
    </div>
  );
};

export const ModalFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div
      className={`p-4 sm:p-6 pt-4 border-t border-divider bg-surface-subtle flex items-center justify-end gap-3 shrink-0 ${className}`}
    >
      {children}
    </div>
  );
};

// ConfirmDialog for destructive / high-stakes operations
export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  targetName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  targetName,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  confirmVariant = 'danger',
  isLoading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" closeOnBackdrop={!isLoading}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 border ${
              confirmVariant === 'danger'
                ? 'bg-rose-50 text-rose-600 border-rose-100'
                : confirmVariant === 'warning'
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : 'bg-blue-50 text-blue-600 border-blue-100'
            }`}
          >
            {confirmVariant === 'danger' ? (
              <Trash2 className="w-5 h-5" />
            ) : confirmVariant === 'warning' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <ShieldAlert className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-text-primary leading-tight">
              {title}
            </h3>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {targetName && (
          <div className="mt-4 p-3 bg-surface-subtle border border-border rounded-md text-xs font-semibold text-text-primary flex items-center gap-2">
            <span className="text-text-muted">Target:</span>
            <span className="font-bold text-danger truncate">{targetName}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-divider">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>

          <Button
            variant={confirmVariant}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
