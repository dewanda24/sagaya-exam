'use client';

import React from 'react';
import { LogOut, User as UserIcon, Shield, ChevronDown } from 'lucide-react';
import { Dropdown } from './Dropdown';

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  roleTag?: string;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = 'User',
  src,
  size = 'md',
  roleTag,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative inline-flex shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`rounded-lg object-cover border border-border ${sizeStyles[size]} ${className}`}
        />
      ) : (
        <div
          className={`rounded-lg bg-gradient-to-br from-primary-600 to-indigo-700 text-white font-black flex items-center justify-center border border-primary-500/20 shadow-subtle ${sizeStyles[size]} ${className}`}
        >
          {initials || <UserIcon className="w-4 h-4" />}
        </div>
      )}

      {roleTag && (
        <span
          className="absolute -bottom-1 -right-1 px-1 rounded bg-slate-900 text-white text-[9px] font-extrabold uppercase"
          title={roleTag}
        >
          {roleTag.slice(0, 3)}
        </span>
      )}
    </div>
  );
};

export interface UserMenuProps {
  user: {
    id: string;
    fullName?: string;
    username?: string;
    role: string;
    schoolName?: string | null;
  };
  onLogout: () => void;
  onProfileClick?: () => void;
  className?: string;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  user,
  onLogout,
  onProfileClick,
  className = '',
}) => {
  const displayName = user.fullName || user.username || 'Pengguna';
  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin Sekolah',
    GURU: 'Tenaga Pendidik',
    PENGAWAS: 'Pengawas Ruang',
    SISWA: 'Peserta Ujian',
  };

  const dropdownItems = [
    ...(onProfileClick
      ? [
          {
            label: 'Profil Saya',
            icon: <UserIcon className="w-4 h-4 text-text-muted" />,
            onClick: onProfileClick,
          },
        ]
      : []),
    {
      divider: true,
      label: '',
    },
    {
      label: 'Keluar (Logout)',
      icon: <LogOut className="w-4 h-4 text-danger" />,
      onClick: onLogout,
      variant: 'danger' as const,
    },
  ];

  return (
    <Dropdown
      align="right"
      items={dropdownItems}
      className={className}
      trigger={
        <div className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer select-none">
          <Avatar name={displayName} size="sm" />
          <div className="hidden md:flex flex-col text-left leading-tight">
            <span className="text-xs font-bold text-text-primary max-w-[140px] truncate">
              {displayName}
            </span>
            <span className="text-[10px] text-text-muted font-medium">
              {roleLabels[user.role] || user.role}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-text-muted hidden md:block" />
        </div>
      }
    />
  );
};
