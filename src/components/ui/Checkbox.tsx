'use client';

import React, { forwardRef } from 'react';
import { Check, Minus } from 'lucide-react';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
  error?: string;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      error,
      indeterminate = false,
      id,
      className = '',
      disabled,
      checked,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={checkboxId}
          className={`inline-flex items-start gap-2.5 cursor-pointer select-none group ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          } ${className}`}
        >
          <div className="relative flex items-center justify-center mt-0.5 shrink-0">
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              disabled={disabled}
              checked={checked}
              aria-invalid={!!error}
              className="sr-only peer"
              {...props}
            />
            <div
              className={`w-4 h-4 rounded-xs border transition-all duration-150 flex items-center justify-center
                ${
                  error
                    ? 'border-danger peer-focus-visible:ring-2 peer-focus-visible:ring-danger/20'
                    : 'border-border-hover peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/20'
                }
                ${
                  checked || indeterminate
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'bg-surface hover:border-border-focus'
                }
              `}
            >
              {indeterminate ? (
                <Minus className="w-3 h-3 stroke-[3]" />
              ) : checked ? (
                <Check className="w-3 h-3 stroke-[3]" />
              ) : null}
            </div>
          </div>

          {(label || description) && (
            <div className="flex flex-col">
              {label && (
                <span className="text-sm font-medium text-text-primary group-hover:text-primary-700 transition-colors">
                  {label}
                </span>
              )}
              {description && (
                <span className="text-xs text-text-muted">{description}</span>
              )}
            </div>
          )}
        </label>

        {error && <p className="text-xs font-medium text-danger pl-6.5">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
