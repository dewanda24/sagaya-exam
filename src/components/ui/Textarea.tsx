'use client';

import React, { forwardRef } from 'react';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, error, id, className = '', disabled, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-xs font-semibold text-text-secondary tracking-normal flex items-center justify-between"
          >
            <span>{label}</span>
            {props.required && <span className="text-danger text-xs">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${textareaId}-error`
              : helperText
              ? `${textareaId}-helper`
              : undefined
          }
          className={`w-full text-sm text-text-primary bg-surface border rounded-md transition-all duration-150 outline-none
            p-3 min-h-[96px]
            ${
              error
                ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
                : 'border-border hover:border-border-hover focus:border-border-focus focus:ring-2 focus:ring-primary-500/15'
            }
            disabled:bg-slate-50 disabled:text-text-muted disabled:border-border disabled:cursor-not-allowed
            ${className}`}
          {...props}
        />

        {error ? (
          <p id={`${textareaId}-error`} className="text-xs font-medium text-danger">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${textareaId}-helper`} className="text-xs text-text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
