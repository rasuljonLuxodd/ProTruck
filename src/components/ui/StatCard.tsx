import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'positive' | 'negative';

interface StatCardProps {
  title: string;
  value: string;
  icon?: LucideIcon;
  change?: number;
  changeLabel?: string;
  tone?: Tone;
}

const valueClass: Record<Tone, string> = {
  default:  'text-fg',
  positive: 'text-positive',
  negative: 'text-negative',
};

export function StatCard({ title, value, icon: Icon, change, changeLabel, tone = 'default' }: StatCardProps) {
  const hasChange = typeof change === 'number' && isFinite(change);
  const up = (change ?? 0) >= 0;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-medium text-fg-muted">{title}</div>
        {Icon ? <Icon className="w-4 h-4 text-fg-subtle" /> : null}
      </div>
      <div className={cn('stat-value', valueClass[tone])}>{value}</div>
      {hasChange ? (
        <div className="mt-2.5 flex items-center gap-1 text-xs">
          {up ? (
            <ArrowUpRight className="w-3.5 h-3.5 text-positive" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5 text-negative" />
          )}
          <span className={cn('font-medium tnum', up ? 'text-positive' : 'text-negative')}>
            {up ? '+' : ''}{change!.toFixed(1)}%
          </span>
          {changeLabel ? <span className="text-fg-subtle ml-0.5">{changeLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
