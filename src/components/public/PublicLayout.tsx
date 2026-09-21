'use client';

import React from 'react';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';

export interface PublicLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-text-primary">
      <PublicHeader />
      <main className={`flex-1 ${className}`}>{children}</main>
      <PublicFooter />
    </div>
  );
};
