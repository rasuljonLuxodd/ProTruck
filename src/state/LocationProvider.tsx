import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { useLocations } from '@/hooks/useLocations';
import type { Location } from '@/types';

const STORAGE_KEY = 'protrack:activeLocationId';

interface LocationContextValue {
  /**
   * The currently active location, or null while the list is still
   * loading (in which case we suspend filtering — better than showing
   * an empty page during cold start).
   */
  current: Location | null;
  /** All non-archived locations, fetched once and shared. */
  locations: Location[];
  /** Switch the active location. */
  setCurrent: (id: string) => void;
  /** True until the location list has loaded for the first time. */
  loading: boolean;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Holds the active location for the whole session.
 *
 * Selection priority:
 *   1. Whatever the user picked last (in localStorage)
 *   2. The default-flagged location
 *   3. The first non-archived location
 *
 * We persist to localStorage so the picker is sticky across reloads —
 * the cashier in shop B doesn't want to re-pick shop B every morning.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const { data: locations = [], isLoading } = useLocations();
  const [currentId, setCurrentId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  // Once locations load, settle on a current id if we don't have one
  // (or if the stored one points at an archived/deleted row).
  useEffect(() => {
    if (locations.length === 0) return;
    const stored = currentId;
    const exists = stored && locations.some(l => l.id === stored);
    if (exists) return;
    const next =
      locations.find(l => l.isDefault)?.id ??
      locations[0]?.id ??
      null;
    if (next && next !== currentId) {
      setCurrentId(next);
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next);
    }
  }, [locations, currentId]);

  const setCurrent = useCallback((id: string) => {
    setCurrentId(id);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const current = useMemo(
    () => locations.find(l => l.id === currentId) ?? null,
    [locations, currentId],
  );

  return (
    <LocationContext.Provider value={{ current, locations, setCurrent, loading: isLoading }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useActiveLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    // Provider not wired — return a safe stub so isolated components
    // (preview screenshots, tests) don't crash.
    return { current: null, locations: [], setCurrent: () => {}, loading: false };
  }
  return ctx;
}

/**
 * The id to scope queries by. Returns null while locations are still
 * loading; callers should pass that null through to `enabled: !!id`
 * on their useQuery hooks so we don't fire requests with no filter.
 */
export function useActiveLocationId(): string | null {
  const { current } = useActiveLocation();
  return current?.id ?? null;
}
