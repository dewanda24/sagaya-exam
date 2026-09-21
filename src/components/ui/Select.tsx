'use client';

import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      options,
      placeholder,
      id,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-semibold text-text-secondary tracking-normal flex items-center justify-between"
          >
            <span>{label}</span>
            {props.required && <span className="text-danger text-xs">*</span>}
          </label>
        )}

        <div className="relative flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? `${selectId}-error`
                : helperText
                ? `${selectId}-helper`
                : undefined
            }
            className={`w-full appearance-none text-sm text-text-primary bg-surface border rounded-md transition-all duration-150 outline-none
              min-h-[40px] sm:min-h-[42px] px-3.5 py-2 pr-10 cursor-pointer
              ${
                error
                  ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
                  : 'border-border hover:border-border-hover focus:border-border-focus focus:ring-2 focus:ring-primary-500/15'
              }
              disabled:bg-slate-50 disabled:text-text-muted disabled:border-border disabled:cursor-not-allowed
              ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute right-3 flex items-center pointer-events-none text-text-muted">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {error ? (
          <p id={`${selectId}-error`} className="text-xs font-medium text-danger">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${selectId}-helper`} className="text-xs text-text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
