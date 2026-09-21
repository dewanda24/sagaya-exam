'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  itemName?: string;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 10,
  itemName = 'data',
  className = '',
}: PaginationProps) {
  if (totalPages <= 1 && (!totalItems || totalItems <= pageSize)) {
    if (!totalItems || totalItems === 0) return null;
    return (
      <div className={`px-4 sm:px-6 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium ${className}`}>
        <div>
          Menampilkan seluruh <strong>{totalItems}</strong> {itemName}
        </div>
        <div className="text-[11px] text-slate-400 font-semibold">Halaman 1 dari 1</div>
      </div>
    );
  }

  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = totalItems ? Math.min(currentPage * pageSize, totalItems) : currentPage * pageSize;

  // Build compact page number list (max 5 buttons visible)
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
    <div
      className={`px-4 sm:px-6 py-3 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-medium ${className}`}
    >
      {/* Left: Summary Count */}
      <div className="text-slate-500 text-center sm:text-left">
        {totalItems !== undefined ? (
          <span>
            Menampilkan <strong>{totalItems === 0 ? 0 : startIdx}</strong>–<strong>{endIdx}</strong> dari{' '}
            <strong>{totalItems}</strong> {itemName}
          </span>
        ) : (
          <span>
            Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong>
          </span>
        )}
      </div>

      {/* Right: Prev, Page Pills, Next */}
      <div className="flex items-center gap-1.5">
        {/* Prev Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
          title="Halaman Sebelumnya"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        {/* Page Number Pills */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-slate-400 select-none">
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
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
          title="Halaman Selanjutnya"
        >
          <span className="hidden sm:inline">Selanjutnya</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
