import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabaseClient';

/**
 * Map of Postgres table name → query keys to invalidate when a change
 * is received from Supabase Realtime. When admin A inserts/updates/deletes
 * a row, every other open client refreshes its corresponding cache.
 */
const TABLE_TO_KEYS: Record<string, string[][]> = {
  products:        [['products']],
  production_logs: [['productionLogs'], ['products']],
  sales:           [['sales'], ['actionLogs']],
  debts:           [['debts']],
  debt_payments:   [['debts']],
  expenses:        [['expenses'], ['actionLogs']],
  workers:         [['workers']],
  worker_payments: [['workers'], ['expenses'], ['actionLogs']],
  action_logs:     [['actionLogs']],
  profiles:        [['users']],
  recurring_expenses: [['recurringExpenses']],
};

/**
 * Subscribes to postgres_changes on every business table. Only used when
 * the user is authenticated (mount in a layout above protected routes).
 *
 * No-op when running against the LocalStorageRepository — Supabase channels
 * just won't have anything to push.
 */
export function useRealtimeSync(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel('protrack-changes');

    for (const table of Object.keys(TABLE_TO_KEYS)) {
      channel.on(
        'postgres_changes' as 'system',
        { event: '*', schema: 'public', table } as never,
        () => {
          for (const key of TABLE_TO_KEYS[table]) {
            qc.invalidateQueries({ queryKey: key });
          }
        },
      );
    }

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}
