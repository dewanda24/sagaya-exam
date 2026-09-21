'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  showHome = true,
  className = '',
}) => {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-xs text-text-muted ${className}`}
    >
      {showHome && (
        <Link
          href="/"
          className="hover:text-text-primary transition flex items-center gap-1"
          aria-label="Beranda"
        >
          <Home className="w-3.5 h-3.5" />
        </Link>
      )}

      {showHome && items.length > 0 && (
        <ChevronRight className="w-3 h-3 text-slate-400" />
      )}

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;

        return (
          <React.Fragment key={idx}>
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-text-primary transition flex items-center gap-1 truncate max-w-[150px]"
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span
                aria-current={isLast ? 'page' : undefined}
                className={`flex items-center gap-1 truncate max-w-[200px] ${
                  isLast ? 'font-bold text-text-primary' : ''
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </span>
            )}

            {!isLast && <ChevronRight className="w-3 h-3 text-slate-400" />}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
