'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', hoverable = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-surface border border-border rounded-lg shadow-sm transition-all duration-150 ${
          hoverable
            ? 'hover:shadow-md hover:border-border-hover transition-transform duration-150'
            : ''
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`p-4 sm:p-6 pb-2 border-b border-divider flex flex-col gap-1 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <h3
      className={`text-base font-bold text-text-primary tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ children, className = '', ...props }) => {
  return (
    <p className={`text-xs text-text-muted leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`p-4 sm:p-6 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`p-4 sm:p-6 pt-3 border-t border-divider flex items-center justify-between ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// StatCard Component for Dashboards
export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  className?: string;
}

const statColorStyles = {
  primary: 'bg-primary-50 text-primary-600 border-primary-100',
  success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  warning: 'bg-amber-50 text-amber-600 border-amber-100',
  danger: 'bg-rose-50 text-rose-600 border-rose-100',
  neutral: 'bg-slate-50 text-slate-600 border-slate-100',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'primary',
  className = '',
}) => {
  return (
    <Card className={`p-5 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-text-muted truncate">
            {title}
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight mt-1 truncate">
            {value}
          </span>
        </div>

        {icon && (
          <div
            className={`w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 ${statColorStyles[color]}`}
          >
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-divider text-xs">
          {trend && (
            <span
              className={`font-bold inline-flex items-center gap-0.5 ${
                trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend.isPositive ? '+' : ''}
              {trend.value}
            </span>
          )}
          {subtitle && <span className="text-text-muted truncate">{subtitle}</span>}
        </div>
      )}
    </Card>
  );
};
