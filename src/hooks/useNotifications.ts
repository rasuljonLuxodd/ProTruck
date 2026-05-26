import { useMemo } from 'react';
import { useProducts } from './useProducts';
import { useDebts } from './useDebts';
import { useSales } from './useSales';
import { isSameDay } from '@/lib/calc';
import { daysBetween } from '@/lib/format';
import type { TranslationKey } from '@/i18n/translations';

export type NotificationKind = 'low_stock' | 'overdue_debt' | 'big_sale';

export interface Notification {
  id: string;
  kind: NotificationKind;
  /** translation key for the title */
  titleKey: TranslationKey;
  /** plain text body (already includes values, not translated) */
  body: string;
  href?: string;
}

const BIG_SALE_THRESHOLD = 1_000_000; // UZS
const DEBT_OVERDUE_DAYS = 30;

/**
 * Derives an in-app notification feed from the current data caches.
 * No server table — everything is computed from products / debts / sales.
 */
export function useNotifications(): Notification[] {
  const { data: products = [] } = useProducts();
  const { data: debts = [] } = useDebts();
  const { data: sales = [] } = useSales();

  return useMemo<Notification[]>(() => {
    const out: Notification[] = [];

    // 1) Low stock
    const low = products
      .filter(p => p.stock <= p.minStock)
      .sort((a, b) => a.stock - b.stock);
    if (low.length > 0) {
      out.push({
        id: 'lowstock',
        kind: 'low_stock',
        titleKey: 'prod.lowStock',
        body: low.slice(0, 3).map(p => `${p.name} (${p.stock})`).join(', '),
        href: '/production',
      });
    }

    // 2) Overdue debts (older than 30 days)
    const overdue = debts
      .filter(d => daysBetween(d.date) >= DEBT_OVERDUE_DAYS)
      .sort((a, b) => b.amount - a.amount);
    if (overdue.length > 0) {
      out.push({
        id: 'overdue',
        kind: 'overdue_debt',
        titleKey: 'nav.debts',
        body: `${overdue.length} · ${overdue.slice(0, 3).map(d => d.customerName).join(', ')}`,
        href: '/debts',
      });
    }

    // 3) Big sales today
    const today = new Date().toISOString();
    const bigToday = sales.filter(
      s => isSameDay(s.date, today) && s.total >= BIG_SALE_THRESHOLD,
    );
    if (bigToday.length > 0) {
      out.push({
        id: 'bigsale',
        kind: 'big_sale',
        titleKey: 'dash.todaySales',
        body: `${bigToday.length} sale${bigToday.length > 1 ? 's' : ''} ≥ 1M`,
        href: '/sales',
      });
    }

    return out;
  }, [products, debts, sales]);
}
