import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Repository } from './repository';
import { LocalStorageRepository } from './localStorageRepository';

// TODO: SupabaseRepository — replace the single line below
// with `new SupabaseRepository(supabaseClient)` to switch storage.
// No other file needs to change.
const RepositoryContext = createContext<Repository | null>(null);

interface Props {
  children: ReactNode;
  repository?: Repository;
}

export function RepositoryProvider({ children, repository }: Props) {
  const repo = useMemo<Repository>(
    () => repository ?? new LocalStorageRepository(),
    [repository],
  );
  return <RepositoryContext.Provider value={repo}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): Repository {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepository must be used inside RepositoryProvider');
  return ctx;
}
