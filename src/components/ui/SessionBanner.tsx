import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/data/supabaseClient';
import { useAuth } from '@/auth/AuthProvider';

const WARN_THRESHOLD_S = 120; // show banner when ≤ 2 minutes remain

/**
 * Watches the Supabase session expiry and warns the user shortly before
 * the access token expires. A click on "Refresh" calls
 * `supabase.auth.refreshSession()` to get a new token.
 */
export function SessionBanner() {
  const { currentUser } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setSecondsLeft(null);
      return;
    }
    let active = true;

    async function tick() {
      const { data } = await supabase.auth.getSession();
      const exp = data.session?.expires_at;
      if (!exp) {
        if (active) setSecondsLeft(null);
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      if (active) setSecondsLeft(exp - now);
    }

    void tick();
    const id = setInterval(tick, 15_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [currentUser]);

  async function refresh() {
    setRefreshing(true);
    await supabase.auth.refreshSession();
    setRefreshing(false);
  }

  if (!currentUser || secondsLeft === null || secondsLeft > WARN_THRESHOLD_S) {
    return null;
  }

  const minutes = Math.max(0, Math.floor(secondsLeft / 60));
  const seconds = Math.max(0, secondsLeft % 60);

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-300 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        <span>
          Session expires in <span className="tnum font-semibold">{minutes}:{String(seconds).padStart(2, '0')}</span>
        </span>
      </div>
      <button
        onClick={refresh}
        disabled={refreshing}
        className="text-xs font-medium underline underline-offset-2 hover:no-underline"
      >
        {refreshing ? '…' : 'Refresh now'}
      </button>
    </div>
  );
}
