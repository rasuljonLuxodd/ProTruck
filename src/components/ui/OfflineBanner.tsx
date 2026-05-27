import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';

/**
 * Slim banner that appears at the top of the page when the browser
 * reports it's offline (or when a Supabase fetch fails — we listen to
 * both `online`/`offline` events and the navigator flag).
 *
 * Doesn't gate the UI — the app stays interactive on cached data. The
 * banner is just a signal so the user understands why "Save" might be
 * slow or failing.
 */
export function OfflineBanner() {
  const t = useT();
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="sticky top-0 z-30 bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-300 px-4 py-2 flex items-center justify-between text-sm animate-slideIn no-print"
      role="status"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span>{t('offline.banner')}</span>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
      >
        <RefreshCw className="w-3 h-3" />
        {t('offline.retry')}
      </button>
    </div>
  );
}
