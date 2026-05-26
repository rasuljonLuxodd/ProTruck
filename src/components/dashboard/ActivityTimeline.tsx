import { useMemo } from 'react';
import { useT } from '@/i18n/LanguageProvider';
import { isSameDay } from '@/lib/calc';
import { useFormatDate } from '@/lib/useFormatters';
import { relativeTime } from '@/lib/greeting';
import { cn } from '@/lib/utils';
import type { ActionLog, ActionType } from '@/types';

const dotColor: Record<ActionType, string> = {
  sale:       'bg-positive',
  expense:    'bg-negative',
  production: 'bg-fg',
  payment:    'bg-amber-500',
};

const typeLabel: Record<ActionType, string> = {
  sale: 'SOT', expense: 'XAR', production: 'PRD', payment: 'PAY',
};

interface Props { actions: ActionLog[]; }

function initials(name?: string) {
  if (!name) return '·';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '·';
}

/**
 * Activity feed grouped into Today / Yesterday / Earlier buckets. Each entry
 * shows a colored type chip, a tiny user initial avatar, the description,
 * and a relative time ("3 min ago"). Designed to feel like a flow, not a
 * spreadsheet — gives the dashboard a "pulse".
 */
export function ActivityTimeline({ actions }: Props) {
  const t = useT();
  const fmtDate = useFormatDate();

  const groups = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const today: ActionLog[] = [];
    const yest:  ActionLog[] = [];
    const earlier: ActionLog[] = [];
    for (const a of actions) {
      if (isSameDay(a.date, now.toISOString())) today.push(a);
      else if (isSameDay(a.date, yesterday.toISOString())) yest.push(a);
      else earlier.push(a);
    }
    return { today, yest, earlier };
  }, [actions]);

  function renderBucket(label: string, items: ActionLog[]) {
    if (items.length === 0) return null;
    return (
      <div className="border-b border-border last:border-0">
        <div className="px-5 pt-3 pb-1 text-[10px] uppercase tracking-wider font-semibold text-fg-subtle">
          {label}
        </div>
        <ul>
          {items.map(a => {
            const rel = relativeTime(a.date);
            const time = rel.key
              ? t(rel.key).replace('{n}', String(rel.n ?? ''))
              : fmtDate(a.date);
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface/60 transition"
              >
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor[a.type])} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted w-8 shrink-0">
                  {typeLabel[a.type]}
                </span>
                <span className="flex-1 text-sm truncate">{a.description}</span>
                {a.userName ? (
                  <div
                    className="hidden sm:flex items-center gap-1.5 text-xs text-fg-muted shrink-0"
                    title={a.userName}
                  >
                    <span className="w-5 h-5 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[10px] font-semibold">
                      {initials(a.userName)}
                    </span>
                  </div>
                ) : null}
                <span className="text-xs text-fg-subtle tnum shrink-0 w-20 text-right">
                  {time}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">{t('dash.recent')}</h2>
        </div>
        <p className="px-5 py-10 text-sm text-fg-subtle text-center">{t('common.empty')}</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('dash.recent')}</h2>
        <span className="text-xs text-fg-muted tnum">{actions.length}</span>
      </div>
      {renderBucket(t('dash.activityToday'), groups.today)}
      {renderBucket(t('dash.activityYesterday'), groups.yest)}
      {renderBucket(t('dash.activityEarlier'), groups.earlier)}
    </div>
  );
}
