'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  position?: 'left' | 'right';
  className?: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  children,
  title,
  position = 'left',
  className = '',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLeft = position === 'left';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-surface w-full max-w-xs sm:max-w-sm h-full shadow-elevated flex flex-col transition-transform duration-200 ease-out animate-in ${
          isLeft
            ? 'slide-in-from-left mr-auto'
            : 'slide-in-from-right ml-auto'
        } ${className}`}
      >
        {title && (
          <div className="p-4 sm:p-5 border-b border-divider flex items-center justify-between">
            <h2 className="text-base font-bold text-text-primary">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-100 text-text-muted hover:text-text-primary"
              aria-label="Tutup menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
