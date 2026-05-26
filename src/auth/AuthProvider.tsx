import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { Role, User } from '@/types';

interface AuthContextValue {
  currentUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: 'invalid_credentials' }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  can: (action: 'manage_users' | 'view_workers' | 'view_calendar' | 'view_reports') => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const repo = useRepository();
  const qc = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const session = await repo.getSession();
    if (!session) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }
    const users = await repo.listUsers();
    const found = users.find(u => u.id === session.userId) ?? null;
    setCurrentUser(found);
    if (!found) await repo.setSession(null);
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (email, password) => {
      const users = await repo.listUsers();
      const match = users.find(
        u =>
          u.email.trim().toLowerCase() === email.trim().toLowerCase() &&
          u.password === password,
      );
      if (!match) return { ok: false, error: 'invalid_credentials' };
      await repo.setSession({ userId: match.id, signedInAt: new Date().toISOString() });
      setCurrentUser(match);
      qc.invalidateQueries();
      return { ok: true };
    },
    [repo, qc],
  );

  const signOut = useCallback(async () => {
    await repo.setSession(null);
    setCurrentUser(null);
    qc.clear();
  }, [repo, qc]);

  const hasRole = useCallback(
    (role: Role) => currentUser?.role === role,
    [currentUser],
  );

  const can = useCallback<AuthContextValue['can']>(
    action => {
      if (!currentUser) return false;
      if (currentUser.role === 'super_admin') return true;
      // admin permissions
      switch (action) {
        case 'manage_users':
        case 'view_workers':
        case 'view_calendar':
        case 'view_reports':
          return false;
        default:
          return false;
      }
    },
    [currentUser],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ currentUser, loading, signIn, signOut, refresh, hasRole, can }),
    [currentUser, loading, signIn, signOut, refresh, hasRole, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
