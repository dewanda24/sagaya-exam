'use client';

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'warning';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-600 text-white shadow-subtle hover:bg-primary-700 active:bg-primary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
  secondary:
    'bg-surface text-text-primary border border-border shadow-subtle hover:bg-surface-subtle hover:border-border-hover active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
  outline:
    'bg-transparent text-primary-600 border border-primary-600 hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
  ghost:
    'bg-transparent text-text-secondary hover:bg-slate-100 hover:text-text-primary active:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-400',
  danger:
    'bg-danger text-white shadow-subtle hover:bg-red-600 active:bg-red-700 focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2',
  success:
    'bg-success text-white shadow-subtle hover:bg-emerald-600 active:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2',
  warning:
    'bg-warning text-white shadow-subtle hover:bg-amber-600 active:bg-amber-700 focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-semibold rounded-md min-h-[36px] gap-1.5',
  md: 'px-4 py-2 text-sm font-semibold rounded-md min-h-[40px] sm:min-h-[44px] gap-2',
  lg: 'px-5 py-2.5 text-base font-semibold rounded-lg min-h-[48px] gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyle =
      'inline-flex items-center justify-center font-sans transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.99] outline-none';
    const variantClass = variantStyles[variant] || variantStyles.primary;
    const sizeClass = sizeStyles[size] || sizeStyles.md;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyle} ${variantClass} ${sizeClass} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: 'w-9 h-9 min-w-[36px] min-h-[36px] text-xs rounded-md',
  md: 'w-10 h-10 min-w-[40px] min-h-[40px] sm:w-11 sm:h-11 sm:min-w-[44px] sm:min-h-[44px] text-sm rounded-md',
  lg: 'w-12 h-12 min-w-[48px] min-h-[48px] text-base rounded-lg',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      className = '',
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      disabled,
      type = 'button',
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const baseStyle =
      'inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.97] outline-none';
    const variantClass = variantStyles[variant] || variantStyles.ghost;
    const sizeClass = iconSizeStyles[size] || iconSizeStyles.md;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={`${baseStyle} ${variantClass} ${sizeClass} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          icon
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
