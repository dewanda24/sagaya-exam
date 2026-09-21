'use client';

import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './Table';
import { Pagination } from './Pagination';
import { EmptyState, ErrorState } from './EmptyState';
import { TableSkeleton } from './Skeleton';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  cell?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  mobilePriority?: 'always' | 'desktop-only' | 'hidden';
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  pageSize?: number;
  itemName?: string;
  className?: string;
  // Optional mobile view custom renderer
  renderMobileCard?: (row: T, index: number) => React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = 'Belum Ada Data',
  emptyDescription = 'Tidak ada data yang tersedia untuk ditampilkan saat ini.',
  emptyActionLabel,
  onEmptyAction,
  pageSize = 10,
  itemName = 'data',
  className = '',
  renderMobileCard,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      return sortDirection === 'asc' ? 1 : -1;
    });
  }, [data, sortKey, sortDirection]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  if (isLoading) {
    return <TableSkeleton rows={pageSize > 5 ? 5 : pageSize} cols={columns.length} className={className} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} className={className} />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
        className={className}
      />
    );
  }

  return (
    <div className={`border border-border rounded-lg bg-surface shadow-subtle overflow-hidden ${className}`}>
      {/* Desktop & Tablet Table View */}
      <div className={renderMobileCard ? 'hidden md:block' : 'block'}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <TableHead
                    key={col.key}
                    className={`${col.className || ''} ${
                      col.mobilePriority === 'desktop-only' ? 'hidden sm:table-cell' : ''
                    }`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1.5 hover:text-text-primary transition"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-primary-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-primary-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-text-muted" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, idx) => (
              <TableRow key={row.id || idx}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={`${col.className || ''} ${
                      col.mobilePriority === 'desktop-only' ? 'hidden sm:table-cell' : ''
                    }`}
                  >
                    {col.cell ? col.cell(row, idx) : row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card Presentation Fallback */}
      {renderMobileCard && (
        <div className="md:hidden divide-y divide-border">
          {paginatedData.map((row, idx) => (
            <div key={row.id || idx} className="p-4 hover:bg-slate-50 transition">
              {renderMobileCard(row, idx)}
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={sortedData.length}
        pageSize={pageSize}
        itemName={itemName}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
