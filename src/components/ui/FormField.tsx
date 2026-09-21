'use client';

import React from 'react';

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  error,
  helperText,
  htmlFor,
  children,
  className = '',
}) => {
  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-semibold text-text-secondary tracking-normal flex items-center justify-between"
        >
          <span>{label}</span>
          {required && <span className="text-danger text-xs">*</span>}
        </label>
      )}

      {children}

      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
          aria-live="assertive"
          className="text-xs font-medium text-danger"
        >
          {error}
        </p>
      ) : helperText ? (
        <p
          id={htmlFor ? `${htmlFor}-helper` : undefined}
          className="text-xs text-text-muted"
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
};

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  className = '',
  actions,
}) => {
  return (
    <div
      className={`bg-surface border border-border rounded-lg p-5 sm:p-6 shadow-subtle ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-divider gap-2">
        <div>
          <h2 className="text-base font-bold text-text-primary tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      <div className="space-y-4">{children}</div>
    </div>
  );
};

export interface FormActionsProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right' | 'between';
  className?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({
  children,
  align = 'right',
  className = '',
}) => {
  const alignStyles = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={`flex items-center gap-3 pt-4 border-t border-divider ${alignStyles[align]} ${className}`}
    >
      {children}
    </div>
  );
};
