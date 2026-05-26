import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/supabaseClient';
import type { Role, User } from '@/types';

type SignInError = 'invalid_credentials' | 'email_not_confirmed' | 'unknown';
type CreateUserError = 'duplicate_email' | 'weak_password' | 'forbidden' | 'unknown';

interface AuthContextValue {
  currentUser: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: SignInError }>;
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
   * Implementation note: we call `supabase.auth.signUp()` for the new user.
   * Side effect: that call signs IN as the new user, which would log out
   * the current admin. To avoid that, we capture the current session before
   * signUp and restore it after.
   *
   * (A cleaner solution is an edge function using the service role key —
   * left as a follow-up. This works for an internal admin tool.)
   */
  const createUser = useCallback<AuthContextValue['createUser']>(
    async input => {
      // Capture current session so we can restore it after signUp.
      const { data: snap } = await supabase.auth.getSession();
      const prior = snap.session;

      const { data, error } = await supabase.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: { data: { name: input.name.trim() } },
      });

      if (error) {
        if (error.message.toLowerCase().includes('user already registered')) {
          return { ok: false, error: 'duplicate_email' };
        }
        if (error.message.toLowerCase().includes('password')) {
          return { ok: false, error: 'weak_password' };
        }
        return { ok: false, error: 'unknown' };
      }
      if (!data.user) return { ok: false, error: 'unknown' };

      // Restore the admin's session if signUp logged the new user in.
      if (prior) {
        await supabase.auth.setSession({
          access_token: prior.access_token,
          refresh_token: prior.refresh_token,
        });
      }

      // If the requested role is super_admin, promote the new profile.
      // The default trigger created the profile as 'admin'. (Or 'super_admin'
      // if this happened to be the first user, which shouldn't happen here
      // since createUser is only callable when already signed in.)
      if (input.role === 'super_admin') {
        const { error: roleErr } = await supabase
          .from('profiles')
          .update({ role: 'super_admin' })
          .eq('id', data.user.id);
        if (roleErr) {
          return { ok: false, error: 'forbidden' };
        }
      }

      const user: User = {
        id: data.user.id,
        name: input.name.trim(),
        email: input.email.trim(),
        password: '',
        role: input.role,
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
    () => ({ currentUser, loading, signIn, signOut, refresh, createUser, hasRole, can }),
    [currentUser, loading, signIn, signOut, refresh, createUser, hasRole, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
