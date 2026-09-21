'use client';

import React from 'react';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className="w-full overflow-x-auto focus:outline-none focus:ring-1 focus:ring-primary-500"
      tabIndex={0}
      role="region"
      aria-label="Tabel data"
    >
      <table
        className={`w-full text-left text-sm border-collapse ${className}`}
        {...props}
      >
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<
  React.HTMLAttributes<HTMLTableSectionElement>
> = ({ children, className = '', ...props }) => {
  return (
    <thead
      className={`bg-surface-subtle border-b border-border text-xs font-bold text-text-secondary uppercase tracking-wider ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
};

export const TableBody: React.FC<
  React.HTMLAttributes<HTMLTableSectionElement>
> = ({ children, className = '', ...props }) => {
  return (
    <tbody
      className={`divide-y divide-border bg-surface ${className}`}
      {...props}
    >
      {children}
    </tbody>
  );
};

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <tr
      className={`hover:bg-slate-50/80 transition-colors duration-100 ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
};

export const TableHead: React.FC<
  React.ThHTMLAttributes<HTMLTableCellElement>
> = ({ children, className = '', ...props }) => {
  return (
    <th scope="col" className={`px-4 py-3 font-bold select-none ${className}`} {...props}>
      {children}
    </th>
  );
};

export const TableCell: React.FC<
  React.TdHTMLAttributes<HTMLTableCellElement>
> = ({ children, className = '', ...props }) => {
  return (
    <td className={`px-4 py-3 text-text-primary ${className}`} {...props}>
      {children}
    </td>
  );
};
