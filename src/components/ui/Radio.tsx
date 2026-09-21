'use client';

import React, { forwardRef } from 'react';

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  options: RadioOption[];
  label?: string;
  error?: string;
  direction?: 'horizontal' | 'vertical';
  disabled?: boolean;
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  value,
  onChange,
  options,
  label,
  error,
  direction = 'vertical',
  disabled = false,
  className = '',
}) => {
  return (
    <fieldset className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <legend className="text-xs font-semibold text-text-secondary mb-1">
          {label}
        </legend>
      )}

      <div
        className={`flex ${
          direction === 'horizontal' ? 'flex-row flex-wrap gap-4' : 'flex-col gap-2.5'
        }`}
      >
        {options.map((opt) => {
          const isChecked = value === opt.value;
          const isDisabled = disabled || opt.disabled;
          const optId = `${name}-${opt.value}`;

          return (
            <label
              key={opt.value}
              htmlFor={optId}
              className={`inline-flex items-start gap-2.5 cursor-pointer select-none group ${
                isDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                <input
                  type="radio"
                  id={optId}
                  name={name}
                  value={opt.value}
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => onChange?.(opt.value)}
                  className="sr-only peer"
                />
                <div
                  className={`w-4 h-4 rounded-full border transition-all duration-150 flex items-center justify-center
                    ${
                      error
                        ? 'border-danger peer-focus-visible:ring-2 peer-focus-visible:ring-danger/20'
                        : 'border-border-hover peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/20'
                    }
                    ${
                      isChecked
                        ? 'border-primary-600 bg-surface'
                        : 'bg-surface hover:border-border-focus'
                    }
                  `}
                >
                  {isChecked && (
                    <span className="w-2 h-2 rounded-full bg-primary-600 animate-in zoom-in-75 duration-100" />
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-sm font-medium text-text-primary group-hover:text-primary-700 transition-colors">
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="text-xs text-text-muted">{opt.description}</span>
                )}
              </div>
            </label>
          );
        })}
      </div>

      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </fieldset>
  );
};

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  description?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, checked, disabled, id, className = '', ...props }, ref) => {
    const switchId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <label
        htmlFor={switchId}
        className={`inline-flex items-center justify-between gap-3 cursor-pointer select-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${className}`}
      >
        {(label || description) && (
          <div className="flex flex-col pr-2">
            {label && <span className="text-sm font-medium text-text-primary">{label}</span>}
            {description && <span className="text-xs text-text-muted">{description}</span>}
          </div>
        )}

        <div className="relative shrink-0">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            checked={checked}
            disabled={disabled}
            className="sr-only peer"
            {...props}
          />
          <div
            className={`w-10 h-5.5 rounded-full transition-colors duration-200 ease-in-out border border-transparent
              peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/30
              ${checked ? 'bg-primary-600' : 'bg-slate-300'}`}
          />
          <div
            className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-xs transition-transform duration-200 ease-in-out
              ${checked ? 'translate-x-4.5' : 'translate-x-0'}`}
          />
        </div>
      </label>
    );
  }
);

Switch.displayName = 'Switch';
