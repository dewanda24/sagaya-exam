'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'GURU' | 'PENGAWAS';
  schoolId?: string | null;
  schoolName?: string | null;
}

interface UseAuthResult {
  user: AuthUser | null;
  isLoading: boolean;
  /** Hapus sesi dari server + localStorage, lalu reset state */
  logout: () => Promise<void>;
  /** Refresh data user dari server */
  refresh: () => void;
}

/**
 * Hook terpusat untuk membaca sesi pengguna yang sedang login.
 * Digunakan oleh Navbar, halaman Login, dan halaman lain yang
 * perlu mengetahui status autentikasi tanpa double-fetch.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.authenticated && data.user) {
          setUser({
            id: data.user.id,
            username: data.user.username,
            fullName: data.user.name || data.user.fullName,
            role: data.user.role,
            schoolId: data.user.schoolId,
            schoolName: data.user.schoolName,
          });
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network errors on logout
    } finally {
      setUser(null);
    }
  }, []);

  return { user, isLoading, logout, refresh };
}

/** Kembalikan URL dashboard sesuai role */
export function getDashboardUrlByRole(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/superadmin/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    case 'GURU':
      return '/guru/dashboard';
    case 'PENGAWAS':
      return '/pengawas';
    default:
      return '/admin/dashboard';
  }
}
