import { Link } from 'react-router-dom';
import { TrendingUp, AlertTriangle, Users, ArrowRight } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';
import { cn } from '@/lib/utils';

interface Top3Item { name: string; quantity: number; }
interface LowStockItem { id: string; name: string; stock: number; minStock: number; }

interface Props {
  top3: Top3Item[];
  lowStock: LowStockItem[];
  activeWorkers: number;
}

/**
 * Combined "at a glance" sidebar: best sellers, low stock alert, and a
 * tiny live counter of workers active this month. Lives in the right rail
 * next to the main chart so the page stays dense even when the chart is
 * the headline.
 */
export function InsightsRail({ top3, lowStock, activeWorkers }: Props) {
  const t = useT();

  return (
    <div className="space-y-4 animate-slideIn stagger-3">
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-fg-muted" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
            {t('dash.top3')}
          </h3>
        </div>
        {top3.length === 0 ? (
          <p className="px-4 py-5 text-sm text-fg-subtle text-center">{t('common.empty')}</p>
        ) : (
          <ol className="divide-y divide-border">
            {top3.map((p, i) => (
              <li key={p.name} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-semibold tnum shrink-0',
                    i === 0 && 'bg-fg text-bg',
                    i === 1 && 'bg-surface-2 text-fg border border-border',
                    i === 2 && 'bg-surface-2 text-fg-muted border border-border',
                  )}>{i + 1}</span>
                  <span className="text-sm font-medium truncate">{p.name}</span>
                </div>
                <span className="text-sm font-semibold tnum">{p.quantity}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {lowStock.length > 0 && (
        <Link
          to="/production"
          className="card flex items-center gap-3 p-4 hover:bg-surface transition group"
        >
          <div className="w-9 h-9 rounded-lg bg-negative/10 text-negative flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">
              {lowStock.length} {t('prod.lowStockAlert')}
            </div>
            <div className="text-xs text-fg-muted truncate mt-0.5">
              {lowStock.slice(0, 2).map(p => `${p.name} (${p.stock})`).join(' · ')}
              {lowStock.length > 2 ? ` +${lowStock.length - 2}` : ''}
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-fg-muted shrink-0 opacity-0 group-hover:opacity-100 transition" />
        </Link>
      )}

      {activeWorkers > 0 && (
        <Link
          to="/workers"
          className="card flex items-center gap-3 p-4 hover:bg-surface transition group"
        >
          <div className="w-9 h-9 rounded-lg bg-surface-2 text-fg-muted flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold tnum">
              {t('dash.activeWorkers').replace('{n}', String(activeWorkers))}
            </div>
            <div className="text-xs text-fg-muted mt-0.5">
              {t('wrk.currentMonth')}
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-fg-muted shrink-0 opacity-0 group-hover:opacity-100 transition" />
        </Link>
      )}
    </div>
  );
}
