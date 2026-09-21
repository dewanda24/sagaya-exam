'use client';

import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const variantStyles = {
    text: 'h-4 w-full rounded-xs',
    rectangular: 'h-24 w-full rounded-md',
    circular: 'rounded-full',
  };

  return (
    <div
      className={`animate-pulse bg-slate-200/80 ${variantStyles[variant]} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      {...props}
    />
  );
};

export const TableSkeleton: React.FC<{
  rows?: number;
  cols?: number;
  className?: string;
}> = ({ rows = 5, cols = 4, className = '' }) => {
  return (
    <div className={`w-full border border-border rounded-lg overflow-hidden bg-surface ${className}`}>
      <div className="h-10 bg-surface-subtle border-b border-border flex items-center px-4 gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="h-12 flex items-center px-4 gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  return (
    <div className={`p-5 sm:p-6 border border-border rounded-lg bg-surface flex flex-col gap-3 ${className}`}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
};
