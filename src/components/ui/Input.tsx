'use client';

import React, { forwardRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      isLoading,
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
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled || isLoading}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                ? `${inputId}-helper`
                : undefined
            }
            className={`w-full text-sm text-text-primary bg-surface border rounded-md transition-all duration-150 outline-none
              min-h-[40px] sm:min-h-[42px] px-3.5 py-2
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon || isLoading ? 'pr-10' : ''}
              ${
                error
                  ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
                  : 'border-border hover:border-border-hover focus:border-border-focus focus:ring-2 focus:ring-primary-500/15'
              }
              disabled:bg-slate-50 disabled:text-text-muted disabled:border-border disabled:cursor-not-allowed
              ${className}`}
            {...props}
          />

          {isLoading ? (
            <div className="absolute right-3 flex items-center pointer-events-none text-primary-500">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            rightIcon && (
              <div className="absolute right-3 flex items-center text-text-muted">
                {rightIcon}
              </div>
            )
          )}
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

Input.displayName = 'Input';

export interface SearchInputProps
  extends Omit<InputProps, 'leftIcon' | 'rightIcon'> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onClear, onChange, placeholder = 'Cari data...', ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        leftIcon={<Search className="w-4 h-4" />}
        rightIcon={
          value && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded hover:bg-slate-100 text-text-muted hover:text-text-primary transition"
              aria-label="Bersihkan pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : undefined
        }
        {...props}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';
