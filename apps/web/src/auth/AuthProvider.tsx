import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AdminProfile, ChangePasswordRequest, LoginRequest } from '@eventpass/shared';
import { api, ApiRequestError } from '../lib/api';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  admin: AdminProfile | null;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((a) => {
        if (!active) return;
        setAdmin(a);
        setStatus('authenticated');
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (!(e instanceof ApiRequestError && e.status === 401)) console.error(e);
        setStatus('anonymous');
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const a = await api.login(data);
    setAdmin(a);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setAdmin(null);
      setStatus('anonymous');
    }
  }, []);

  const changePassword = useCallback(async (data: ChangePasswordRequest) => {
    const a = await api.changePassword(data);
    setAdmin(a);
    setStatus('authenticated');
  }, []);

  const value = useMemo(
    () => ({ status, admin, login, logout, changePassword }),
    [status, admin, login, logout, changePassword],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
