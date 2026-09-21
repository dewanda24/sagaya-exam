'use client';

import React from 'react';
import { Breadcrumb, BreadcrumbItem } from './Breadcrumb';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  badge,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col gap-3 pb-5 mb-6 border-b border-divider ${className}`}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} className="mb-0.5" />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight truncate">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-divider gap-2 ${className}`}
    >
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
  );
};
