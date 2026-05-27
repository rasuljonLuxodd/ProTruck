import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Sparkline } from '@/components/dashboard/Sparkline';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'positive' | 'negative';

interface StatCardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  change?: number;
  changeLabel?: string;
  tone?: Tone;
  /**
   * Optional series for a tiny inline sparkline rendered under the value.
   * Pass 7+ data points for best visual rhythm; falls back to a dashed line
   * if fewer than 2 points are provided.
   */
  series?: number[];
}

const valueClass: Record<Tone, string> = {
  default:  'text-fg',
  positive: 'text-positive',
  negative: 'text-negative',
};

const iconClass: Record<Tone, string> = {
  default:  'text-fg-muted',
  positive: 'text-positive',
  negative: 'text-negative',
};

const iconBg: Record<Tone, string> = {
  default:  'bg-surface-2',
  positive: 'bg-positive/10',
  negative: 'bg-negative/10',
};

const sparkColor: Record<Tone, string> = {
  default:  'text-fg-muted',
  positive: 'text-positive',
  negative: 'text-negative',
};

export function StatCard({
  title, value, icon: Icon, change, changeLabel, tone = 'default', series,
}: StatCardProps) {
  const hasChange = typeof change === 'number' && isFinite(change);
  const up = (change ?? 0) >= 0;
  const hasSpark = Array.isArray(series) && series.length > 0;

  return (
    <div className="card card-hover p-5 group relative overflow-hidden">
      {/* Decorative corner glyph — almost invisible but breaks the flatness */}
      <div
        aria-hidden
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(circle, rgb(var(--fg) / 0.04), transparent 70%)',
        }}
      />

      <div className="relative flex items-start justify-between mb-3">
        <div className="text-xs font-medium uppercase tracking-wider text-fg-muted">{title}</div>
        {Icon ? (
          <div
            className={cn(
              'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border transition-transform duration-300 group-hover:scale-110',
              iconBg[tone],
            )}
          >
            <Icon className={cn('w-4 h-4', iconClass[tone])} />
          </div>
        ) : null}
      </div>
      <div className={cn('stat-value relative', valueClass[tone])}>{value}</div>

      {/* Sparkline row + change badge share the same line; if there's no
          sparkline the change badge takes its old position alone. */}
      <div className="mt-2.5 relative flex items-end justify-between gap-3 min-h-[20px]">
        {hasChange ? (
          <div className="flex items-center gap-1 text-xs">
            <div
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium tnum',
                up ? 'text-positive bg-positive/10' : 'text-negative bg-negative/10',
              )}
            >
              {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {up ? '+' : ''}{change!.toFixed(1)}%
            </div>
            {changeLabel ? <span className="text-fg-subtle">{changeLabel}</span> : null}
          </div>
        ) : (
          <div /> /* keep the flex slot so spark sits right-aligned even without change */
        )}

        {hasSpark && (
          <Sparkline
            values={series}
            size="sm"
            width={72}
            filled
            className={cn('-mb-0.5 shrink-0', sparkColor[tone])}
          />
        )}
      </div>
    </div>
  );
}
