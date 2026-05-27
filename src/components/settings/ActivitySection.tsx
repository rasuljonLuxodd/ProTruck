import { useMemo, useState } from 'react';
import { Search, History, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { useT } from '@/i18n/LanguageProvider';
import { useActionLogs } from '@/hooks/useActionLogs';
import { useUsers } from '@/hooks/useUsers';
import { useFormatDate } from '@/lib/useFormatters';
import { cn } from '@/lib/utils';
import type { ActionType } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

const TYPES: ActionType[] = ['sale', 'expense', 'production', 'payment'];

/** Tone per action type — matches the rest of the app's signal palette. */
const typeTone: Record<ActionType, 'positive' | 'negative' | 'warning' | 'fg' | 'mute'> = {
  sale:       'positive',
  expense:    'negative',
  production: 'warning',
  payment:    'fg',
};

/**
 * Settings → Activity. Surfaces the action_logs table with filters so
 * the super_admin can audit who-did-what. Hidden from regular admins.
 *
 * Pulls a window of 500 most-recent rows from Supabase, then filters
 * client-side — that's plenty of history for a small business and keeps
 * the UI snappy (no roundtrip per filter change).
 */
export function ActivitySection() {
  const t = useT();
  const fmtDate = useFormatDate();
  const { data: logs = [], isLoading } = useActionLogs(500);
  const { data: users = [] } = useUsers();

  const [search, setSearch] = useState('');
  const [type, setType] = useState<ActionType | 'all'>('all');
  const [userId, setUserId] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (type !== 'all' && l.type !== type) return false;
      if (userId !== 'all') {
        if (userId === 'none') {
          if (l.userId) return false;
        } else if (l.userId !== userId) return false;
      }
      if (from) {
        const t0 = new Date(l.date).getTime();
        const f = new Date(from).getTime();
        if (t0 < f) return false;
      }
      if (to) {
        const t0 = new Date(l.date).getTime();
        const tEnd = new Date(to).getTime() + 86_400_000; // include the end day
        if (t0 >= tEnd) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        if (
          !l.description.toLowerCase().includes(s) &&
          !(l.userName ?? '').toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [logs, type, userId, from, to, search]);

  function reset() {
    setSearch(''); setType('all'); setUserId('all'); setFrom(''); setTo('');
  }

  const hasFilters = !!search || type !== 'all' || userId !== 'all' || !!from || !!to;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="display text-[24px] leading-none flex items-center gap-2.5">
          <History className="w-5 h-5" />
          {t('activity.title')}
        </h1>
        <p className="text-sm text-fg-muted mt-1.5 max-w-prose leading-relaxed">
          {t('activity.intro')}
        </p>
      </header>

      {/* filter bar */}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-12 gap-2">
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
          <input
            className="input pl-9"
            placeholder={t('activity.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select
          className="md:col-span-2"
          value={type}
          onChange={setType}
          options={[
            { value: 'all' as const, label: t('activity.allTypes') },
            ...TYPES.map(p => ({ value: p, label: t(`actionType.${p}` as TranslationKey) })),
          ]}
        />
        <Select
          className="md:col-span-3"
          value={userId}
          onChange={setUserId}
          options={[
            { value: 'all' as const, label: t('activity.allUsers') },
            { value: 'none', label: t('activity.systemActions') },
            ...users.map(u => ({ value: u.id, label: u.name })),
          ]}
        />
        <DatePicker className="md:col-span-1" value={from} onChange={setFrom} clearable placeholder={t('activity.from')} />
        <DatePicker className="md:col-span-1" value={to} onChange={setTo} clearable placeholder={t('activity.to')} />
        <button
          className="btn-secondary md:col-span-1"
          onClick={reset}
          disabled={!hasFilters}
          title={t('activity.reset')}
        >
          <Filter className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* count summary */}
      <div className="text-xs text-fg-muted">
        {isLoading
          ? '…'
          : t('activity.count')
              .replace('{shown}', String(filtered.length))
              .replace('{total}', String(logs.length))}
      </div>

      {/* table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="whitespace-nowrap">{t('common.date')}</th>
                <th>{t('activity.user')}</th>
                <th>{t('activity.type')}</th>
                <th>{t('common.description')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-fg-subtle py-10">{t('common.empty')}</td></tr>
              ) : (
                filtered.map(l => (
                  <tr key={l.id}>
                    <td className="font-mono text-xs text-fg-muted whitespace-nowrap">
                      {fmtDate(l.date)}
                      <div className="text-[10px] mt-0.5 text-fg-subtle">
                        {new Date(l.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <div className={cn('text-sm', !l.userName && 'text-fg-subtle italic')}>
                        {l.userName ?? t('activity.systemActions')}
                      </div>
                    </td>
                    <td>
                      <Badge tone={typeTone[l.type]}>
                        {t(`actionType.${l.type}` as TranslationKey)}
                      </Badge>
                    </td>
                    <td className="text-sm">{l.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
