import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import { useT } from '@/i18n/LanguageProvider';

/**
 * Bell icon with a popover listing derived notifications. No server table —
 * uses `useNotifications` (which calculates from products/debts/sales).
 */
export function NotificationBell() {
  const t = useT();
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg border border-border hover:bg-surface transition"
        aria-label="notifications"
      >
        <Bell className="w-4 h-4" />
        {items.length > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-negative" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-bg border border-border rounded-xl shadow-lg z-30 overflow-hidden animate-scaleIn">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold flex items-center justify-between">
            <span>Notifications</span>
            <span className="text-xs text-fg-muted">{items.length}</span>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-fg-subtle text-center">
              {t('common.empty')}
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {items.map(n => (
                <li
                  key={n.id}
                  className={cn(
                    'border-b border-border last:border-0',
                    n.kind === 'overdue_debt' && 'border-l-2 border-l-negative',
                    n.kind === 'low_stock' && 'border-l-2 border-l-amber-500',
                    n.kind === 'big_sale' && 'border-l-2 border-l-positive',
                  )}
                >
                  <Link
                    to={n.href ?? '#'}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-surface transition"
                  >
                    <div className="text-sm font-medium">{t(n.titleKey)}</div>
                    <div className="text-xs text-fg-muted mt-0.5">{n.body}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
