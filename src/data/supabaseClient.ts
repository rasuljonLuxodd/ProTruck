import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !anonKey) {
  // Fail loudly so misconfiguration is obvious in dev.
  // eslint-disable-next-line no-console
  console.error(
    '[ProTrack] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example to .env.local and fill in the values.',
  );
}

export const supabase: SupabaseClient = createClient(
  url ?? 'http://invalid',
  anonKey ?? 'invalid',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'protrack-auth',
    },
  },
);
