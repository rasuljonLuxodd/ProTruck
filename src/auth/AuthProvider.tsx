import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/supabaseClient';
import type { Role, User } from '@/types';

type SignInError = 'invalid_credentials' | 'email_not_confirmed' | 'unknown';
type CreateUserError = 'duplicate_email' | 'weak_password' | 'forbidden' | 'unknown';
type MfaError = 'invalid_code' | 'no_factor' | 'unknown';

export type SignInResult =
  | { ok: true }
  | { ok: false; error: SignInError }
  | { ok: false; mfaRequired: true; factorId: string };

interface AuthContextValue {
  currentUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  verifyMfa: (factorId: string, code: string) => Promise<{ ok: true } | { ok: false; error: MfaError }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  createUser: (
    input: { name: string; email: string; password: string; role: Role },
  ) => Promise<{ ok: true; user: User } | { ok: false; error: CreateUserError }>;
  hasRole: (role: Role) => boolean;
  can: (action: 'manage_users' | 'view_workers' | 'view_calendar' | 'view_reports') => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadCurrentUser(): Promise<User | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();
  if (error || !profile) return null;

  // Soft-deleted users are treated as signed out: terminate the session so
  // they don't loop on /login when their profile filter hides them.
  if (profile.deleted_at) {
    await supabase.auth.signOut();
    return null;
  }

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email ?? session.user.email ?? '',
    password: '',
    role: profile.role,
    createdAt: profile.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const user = await loadCurrentUser();
    setCurrentUser(user);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const user = await loadCurrentUser();
      if (active) {
        setCurrentUser(user);
        setLoading(false);
      }
    })();

    // React to auth state changes from any tab.
    // IMPORTANT: do not `await` async work directly inside the callback —
    // it can deadlock the Supabase auth lock. Defer with setTimeout.
    const { data: sub } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'INITIAL_SESSION') return; // handled by IIFE above
      setTimeout(() => {
        if (!active) return;
        void loadCurrentUser().then(user => {
          if (active) setCurrentUser(user);
        });
      }, 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          return { ok: false, error: 'email_not_confirmed' };
        }
        if (
          error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('invalid email')
        ) {
          return { ok: false, error: 'invalid_credentials' };
        }
        return { ok: false, error: 'unknown' };
      }
      if (!data.session) return { ok: false, error: 'unknown' };

      // Detect AAL gap: a verified TOTP factor means we need a code before
      // we count the session as fully authenticated.
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData && aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const verifiedTotp = factorsData?.totp?.find(f => f.status === 'verified');
        if (verifiedTotp) {
          return { ok: false, mfaRequired: true, factorId: verifiedTotp.id };
        }
      }

      await refresh();
      qc.invalidateQueries();
      return { ok: true };
    },
    [qc, refresh],
  );

  const verifyMfa = useCallback<AuthContextValue['verifyMfa']>(
    async (factorId, code) => {
      const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chalErr || !chal) return { ok: false, error: 'no_factor' };
      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: chal.id,
        code,
      });
      if (verErr) return { ok: false, error: 'invalid_code' };
      await refresh();
      qc.invalidateQueries();
      return { ok: true };
    },
    [qc, refresh],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    qc.clear();
  }, [qc]);

  /**
   * Create a new user. Super admin only.
   *
   * Calls the `create-user` Supabase edge function, which uses the
   * service-role key (server-side only) to provision the auth user
   * and bump the profile role. This avoids the session-restore hack
   * we used initially and avoids signing the current admin out.
   */
  const createUser = useCallback<AuthContextValue['createUser']>(
    async input => {
      const { data, error } = await supabase.functions.invoke<{
        id: string;
        email: string;
        name: string;
        role: Role;
      } | { error: string; detail?: string }>('create-user', {
        body: {
          email: input.email.trim(),
          password: input.password,
          name: input.name.trim(),
          role: input.role,
        },
      });
      if (error) {
        const msg = (error.message ?? '').toLowerCase();
        if (msg.includes('already')) return { ok: false, error: 'duplicate_email' };
        if (msg.includes('password')) return { ok: false, error: 'weak_password' };
        return { ok: false, error: 'unknown' };
      }
      if (!data || 'error' in data) {
        const errStr = (data && 'detail' in data ? data.detail : data?.error) ?? '';
        if (errStr.toLowerCase().includes('already')) return { ok: false, error: 'duplicate_email' };
        if (errStr.toLowerCase().includes('password')) return { ok: false, error: 'weak_password' };
        if (data && data.error === 'forbidden') return { ok: false, error: 'forbidden' };
        return { ok: false, error: 'unknown' };
      }
      const user: User = {
        id: data.id,
        name: data.name,
        email: data.email,
        password: '',
        role: data.role,
        createdAt: new Date().toISOString(),
      };
      qc.invalidateQueries({ queryKey: ['users'] });
      return { ok: true, user };
    },
    [qc],
  );

  const hasRole = useCallback(
    (role: Role) => currentUser?.role === role,
    [currentUser],
  );

  const can = useCallback<AuthContextValue['can']>(
    action => {
      if (!currentUser) return false;
      if (currentUser.role === 'super_admin') return true;
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
    () => ({ currentUser, loading, signIn, verifyMfa, signOut, refresh, createUser, hasRole, can }),
    [currentUser, loading, signIn, verifyMfa, signOut, refresh, createUser, hasRole, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
