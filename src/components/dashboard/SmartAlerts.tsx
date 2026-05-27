import { Package, AlertTriangle } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';
import { useProducts } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';
import { useExpenses } from '@/hooks/useExpenses';
import { useFormatDate } from '@/lib/useFormatters';
import { computeReorderHints, detectAnomalies } from '@/lib/smart';
import { formatUZS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import type { TranslationKey } from '@/i18n/translations';

/**
 * Two stacked cards on the dashboard:
 *
 *  1. Reorder hints — products that will stock out in the next 7 days
 *     based on a 4-week moving-average velocity. Owner reads it, knows
 *     what to order today.
 *
 *  2. Anomalies — duplicate expenses, oversized expenses or sales.
 *     Always good to have a quiet second pair of eyes.
 *
 * Both widgets render NOTHING when there's no signal. The dashboard
 * stays clean when business is normal.
 */
export function SmartAlerts() {
  const t = useT();
  const fmtDate = useFormatDate();
  const { data: products = [] } = useProducts();
  const { data: sales = [] } = useSales();
  const { data: expenses = [] } = useExpenses();

  const reorderHints = useMemo(
    () => computeReorderHints(products, sales),
    [products, sales],
  );
  const anomalies = useMemo(
    () => detectAnomalies(expenses, sales),
    [expenses, sales],
  );

  if (reorderHints.length === 0 && anomalies.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {reorderHints.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-chip">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm">{t('smart.reorderTitle')}</h3>
          </div>
          <ul className="space-y-2">
            {reorderHints.slice(0, 5).map(h => (
              <li
                key={h.productId}
                className={cn(
                  'flex items-center justify-between gap-3 px-3 py-2 rounded-lg border',
                  h.urgency === 'high'   && 'border-negative/30 bg-negative/5',
                  h.urgency === 'medium' && 'border-amber-500/30 bg-amber-500/5',
                  h.urgency === 'low'    && 'border-border bg-surface',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{h.productName}</div>
                  <div className="text-xs text-fg-muted tnum">
                    {t('smart.stock')}: {h.currentStock}  ·  {t('smart.weekly')}: {h.weeklyVelocity.toFixed(1)}
                  </div>
                </div>
                <div className={cn(
                  'text-right text-sm font-semibold tnum',
                  h.urgency === 'high'   && 'text-negative',
                  h.urgency === 'medium' && 'text-amber-600 dark:text-amber-400',
                )}>
                  {h.daysUntilStockout === 0
                    ? t('smart.today')
                    : `${h.daysUntilStockout}${t('smart.daysShort')}`}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-chip">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm">{t('smart.anomaliesTitle')}</h3>
          </div>
          <ul className="space-y-2">
            {anomalies.slice(0, 5).map((a, i) => (
              <li
                key={i}
                className={cn(
                  'flex items-start justify-between gap-3 px-3 py-2 rounded-lg border',
                  a.severity === 'alert' ? 'border-negative/30 bg-negative/5' : 'border-amber-500/30 bg-amber-500/5',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-fg-muted mb-0.5">
                    {t(`smart.anomalyType.${a.type}` as TranslationKey)}
                  </div>
                  <div className="text-sm truncate">{a.message}</div>
                </div>
                <div className="text-[10px] font-mono text-fg-subtle shrink-0">{fmtDate(a.date)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
