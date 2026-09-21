'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface DropdownItem {
  id?: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="cursor-pointer inline-flex"
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          className={`absolute z-50 mt-1.5 w-48 rounded-md bg-surface border border-border shadow-elevated py-1 animate-in fade-in zoom-in-95 duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <div key={idx} className="my-1 border-t border-divider" />;
            }

            return (
              <button
                key={item.id || idx}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick?.();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-left transition-colors
                  ${
                    item.variant === 'danger'
                      ? 'text-danger hover:bg-danger-bg'
                      : 'text-text-primary hover:bg-surface-subtle'
                  }
                  disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-50 px-2 py-1 text-[11px] font-semibold text-white bg-slate-900 rounded shadow-sm whitespace-nowrap pointer-events-none animate-in fade-in duration-100 ${
            position === 'top'
              ? 'bottom-full left-1/2 -translate-x-1/2 mb-1.5'
              : 'top-full left-1/2 -translate-x-1/2 mt-1.5'
          }`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
