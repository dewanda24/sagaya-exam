'use client';

import React, { forwardRef } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

export interface DatePickerProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
  error?: string;
  showTime?: boolean;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      label,
      helperText,
      error,
      showTime = false,
      id,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-text-secondary tracking-normal flex items-center justify-between"
          >
            <span>{label}</span>
            {props.required && <span className="text-danger text-xs">*</span>}
          </label>
        )}

        <div className="relative flex items-center w-full">
          <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
            <CalendarIcon className="w-4 h-4" />
          </div>

          <input
            ref={ref}
            id={inputId}
            type={showTime ? 'datetime-local' : 'date'}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                ? `${inputId}-helper`
                : undefined
            }
            className={`w-full text-sm text-text-primary bg-surface border rounded-md transition-all duration-150 outline-none
              min-h-[40px] sm:min-h-[42px] pl-10 pr-3.5 py-2
              ${
                error
                  ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
                  : 'border-border hover:border-border-hover focus:border-border-focus focus:ring-2 focus:ring-primary-500/15'
              }
              disabled:bg-slate-50 disabled:text-text-muted disabled:border-border disabled:cursor-not-allowed
              ${className}`}
            {...props}
          />
        </div>

        {error ? (
          <p id={`${inputId}-error`} className="text-xs font-medium text-danger">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${inputId}-helper`} className="text-xs text-text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';
