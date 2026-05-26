import { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';
import { useAuth } from '@/auth/AuthProvider';
import { formatUZS } from '@/lib/format';
import { useFormatDate } from '@/lib/useFormatters';
import { greetingKey, dayOfWeekKey } from '@/lib/greeting';
import { cn } from '@/lib/utils';
import { Sparkline } from './Sparkline';
import type { TranslationKey } from '@/i18n/translations';

interface Props {
  /** Today's revenue (UZS). */
  todayRevenue: number;
  /** Previous day for the trend % */
  yesterdayRevenue: number;
  /** Last-7-days sales values for the inline sparkline. */
  spark: number[];
  /** Inline sub-stats shown right under the hero metric. */
  inline: Array<{ labelKey: TranslationKey; n: number }>;
  /** True when realtime sync is active (Supabase backend). */
  live?: boolean;
}

export function WelcomeHero({
  todayRevenue, yesterdayRevenue, spark, inline, live,
}: Props) {
  const t = useT();
  const fmtDate = useFormatDate();
  const { currentUser } = useAuth();
  const now = useMemo(() => new Date(), []);

  const greeting = t(greetingKey(now));
  const dayLabel = t(dayOfWeekKey(now));
  const dateLabel = fmtDate(now.toISOString());

  // % vs yesterday
  const change = useMemo(() => {
    if (yesterdayRevenue === 0) return todayRevenue > 0 ? 100 : 0;
    return ((todayRevenue - yesterdayRevenue) / Math.abs(yesterdayRevenue)) * 100;
  }, [todayRevenue, yesterdayRevenue]);
  const up = change >= 0;

  const name = currentUser?.name ?? '—';
  const hello = t('greet.helloName').replace('{name}', name);

  return (
    <section className="relative card hero-mesh overflow-hidden p-6 md:p-8 animate-slideIn">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-fg-muted">
            <span>{greeting}</span>
            <span className="opacity-40">·</span>
            <span>{t('greet.todayIs')} {dayLabel}, {dateLabel}</span>
          </div>
          <h1 className="mt-1.5 text-2xl md:text-3xl font-semibold tracking-tight truncate">
            {hello}
          </h1>
        </div>

        {live ? (
          <div className="flex items-center gap-2 text-xs text-fg-muted shrink-0">
            <span className="live-pulse" />
            <span>{t('dash.live')}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-fg-muted">{t('dash.heroToday')}</div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-4xl md:text-5xl font-semibold tracking-tight tnum">
              {formatUZS(todayRevenue)}
            </span>
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-medium tnum',
              up ? 'text-positive' : 'text-negative',
            )}>
              {up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {up ? '+' : ''}{change.toFixed(1)}%
            </span>
          </div>
        </div>

        <Sparkline
          values={spark}
          width={180}
          size="lg"
          stroke={up ? 'rgb(var(--positive))' : 'rgb(var(--fg-muted))'}
          className="shrink-0 self-end opacity-90"
        />
      </div>

      {inline.length > 0 && (
        <div className="mt-6 pt-5 border-t border-border flex flex-wrap items-center gap-x-6 gap-y-2">
          {inline.map((s, i) => (
            <div key={i} className="flex items-baseline gap-1.5 text-sm">
              <span className="font-semibold tnum">{s.n}</span>
              <span className="text-fg-muted">{t(s.labelKey).replace('{n}', '')}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
