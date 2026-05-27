import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  CreditCard,
  UserSquare,
  Menu,
} from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@/i18n/translations';

interface Props {
  onMore: () => void;
}

/**
 * Mobile-only bottom navigation. Four direct destinations + a "More"
 * button that opens the existing sidebar drawer (so the less-frequent
 * pages — Production, Expenses, Workers, Calendar, Reports, Settings —
 * stay reachable in one tap).
 *
 * The four primary slots are the daily-use pages: Dashboard, Sales,
 * Debts, Customers. Sales gets a slightly larger center button because
 * recording a sale is by far the hottest action.
 *
 * Hidden at lg+ — desktop has the sidebar.
 */
export function BottomNav({ onMore }: Props) {
  const t = useT();
  const items: Array<{ to: string; labelKey: TranslationKey; icon: typeof LayoutDashboard; center?: boolean }> = [
    { to: '/',          labelKey: 'nav.dashboard', icon: LayoutDashboard },
    { to: '/sales',     labelKey: 'nav.sales',     icon: ShoppingCart, center: true },
    { to: '/debts',     labelKey: 'nav.debts',     icon: CreditCard },
    { to: '/customers', labelKey: 'nav.customers', icon: UserSquare },
  ];
  return (
    <nav
      className={cn(
        'lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-bg border-t border-border',
        'pb-[env(safe-area-inset-bottom)] no-print',
      )}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5 h-14">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn(
              'flex flex-col items-center justify-center gap-0.5 transition relative',
              isActive
                ? 'text-fg'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            {({ isActive }) => (
              <>
                {/* Top accent — saffron tick for active item */}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full"
                    style={{ background: 'rgb(var(--accent))' }}
                  />
                )}
                <item.icon className={cn('w-5 h-5', item.center && 'w-6 h-6')} strokeWidth={isActive ? 2.25 : 1.75} />
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={onMore}
          className="flex flex-col items-center justify-center gap-0.5 text-fg-muted hover:text-fg transition"
        >
          <Menu className="w-5 h-5" strokeWidth={1.75} />
          <span className="text-[10px] font-medium">{t('nav.more')}</span>
        </button>
      </div>
    </nav>
  );
}
