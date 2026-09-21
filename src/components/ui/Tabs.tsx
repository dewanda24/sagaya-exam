'use client';

import React, { createContext, useContext, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value,
  onValueChange,
  children,
  className = '',
}) => {
  const [internalTab, setInternalTab] = useState(defaultValue);
  const activeTab = value !== undefined ? value : internalTab;

  const setActiveTab = (tab: string) => {
    if (value === undefined) {
      setInternalTab(tab);
    }
    onValueChange?.(tab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={`w-full flex flex-col gap-4 ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 p-1 bg-surface-subtle border border-border rounded-lg max-w-full overflow-x-auto no-scrollbar ${className}`}
    >
      {children}
    </div>
  );
};

export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
  className?: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  icon,
  badge,
  disabled = false,
  className = '',
}) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const isSelected = context.activeTab === value;

  const tabId = `tab-${value}`;
  const panelId = `tabpanel-${value}`;

  return (
    <button
      id={tabId}
      role="tab"
      type="button"
      disabled={disabled}
      aria-selected={isSelected}
      aria-controls={panelId}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => context.setActiveTab(value)}
      className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-md transition-all whitespace-nowrap outline-none min-h-[38px]
        ${
          isSelected
            ? 'bg-surface text-text-primary shadow-subtle border border-border/80'
            : 'text-text-muted hover:text-text-primary hover:bg-white/50 border border-transparent'
        }
        disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {icon}
      <span>{children}</span>
      {badge !== undefined && (
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
            isSelected
              ? 'bg-primary-50 text-primary-700'
              : 'bg-slate-200 text-text-muted'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
};

export const TabsContent: React.FC<{
  value: string;
  children: React.ReactNode;
  className?: string;
}> = ({ value, children, className = '' }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.activeTab !== value) return null;

  return (
    <div
      id={`tabpanel-${value}`}
      role="tabpanel"
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={`w-full animate-in fade-in duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary-500/20 ${className}`}
    >
      {children}
    </div>
  );
};

// Accordion Component
export interface AccordionItemProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  children,
  defaultOpen = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border border-border rounded-lg bg-surface overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between p-4 text-left font-bold text-sm text-text-primary hover:bg-surface-subtle transition"
      >
        <span>{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-divider text-sm text-text-secondary animate-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  );
};
