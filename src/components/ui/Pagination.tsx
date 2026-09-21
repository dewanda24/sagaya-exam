'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  itemName?: string;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 10,
  itemName = 'data',
  className = '',
}) => {
  if (totalPages <= 1 && (!totalItems || totalItems <= pageSize)) {
    if (!totalItems || totalItems === 0) return null;
    return (
      <div
        className={`px-4 py-3 bg-surface-subtle border-t border-border flex items-center justify-between text-xs text-text-muted font-medium ${className}`}
      >
        <div>
          Menampilkan seluruh <strong>{totalItems}</strong> {itemName}
        </div>
        <div className="text-text-muted font-semibold">Halaman 1 dari 1</div>
      </div>
    );
  }

  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = totalItems
    ? Math.min(currentPage * pageSize, totalItems)
    : currentPage * pageSize;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <nav
      role="navigation"
      aria-label="Navigasi Halaman"
      className={`px-4 py-3 bg-surface-subtle border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-secondary font-medium ${className}`}
    >
      <div className="text-text-muted text-center sm:text-left">
        {totalItems !== undefined ? (
          <span>
            Menampilkan <strong>{totalItems === 0 ? 0 : startIdx}</strong>–
            <strong>{endIdx}</strong> dari <strong>{totalItems}</strong> {itemName}
          </span>
        ) : (
          <span>
            Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="inline-flex items-center gap-1 px-3 py-2 sm:px-2.5 sm:py-1.5 min-h-[38px] sm:min-h-[34px] rounded-md border border-border bg-surface text-text-primary font-semibold text-xs shadow-subtle hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Halaman Sebelumnya"
          title="Halaman Sebelumnya"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 py-1 text-text-muted select-none"
                  aria-hidden="true"
                >
                  ...
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => onPageChange(Number(p))}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Halaman ${p}`}
                className={`min-w-[36px] h-9 sm:min-w-[32px] sm:h-8 px-2 rounded-md text-xs font-bold transition flex items-center justify-center ${
                  isCurrent
                    ? 'bg-primary-600 text-white shadow-subtle'
                    : 'bg-surface border border-border text-text-secondary hover:bg-slate-50 hover:text-text-primary'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="inline-flex items-center gap-1 px-3 py-2 sm:px-2.5 sm:py-1.5 min-h-[38px] sm:min-h-[34px] rounded-md border border-border bg-surface text-text-primary font-semibold text-xs shadow-subtle hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Halaman Selanjutnya"
          title="Halaman Selanjutnya"
        >
          <span className="hidden sm:inline">Selanjutnya</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
};
