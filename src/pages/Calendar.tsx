import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useT } from '@/i18n/LanguageProvider';
import { useSales } from '@/hooks/useSales';
import { useExpenses } from '@/hooks/useExpenses';
import { actualCashIncome, inMonth, expenseTotal } from '@/lib/calc';
import { formatUZS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@/i18n/translations';

export default function Calendar() {
  const t = useT();
  const { data: sales = [] } = useSales();
  const { data: expenses = [] } = useExpenses();
  const [year, setYear] = useState(new Date().getFullYear());
  const now = new Date();

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthSales = sales.filter(s => inMonth(s.date, year, i));
      const monthExp = expenses.filter(e => inMonth(e.date, year, i));
      const income = actualCashIncome(monthSales);
      const expense = expenseTotal(monthExp);
      const profit = income - expense;
      const isCurrent = year === now.getFullYear() && i === now.getMonth();
      const isFuture = year > now.getFullYear() || (year === now.getFullYear() && i > now.getMonth());
      return { idx: i, income, expense, profit, isCurrent, isFuture };
    });
  }, [sales, expenses, year, now]);

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader
            title={t('cal.title')}
            onMenu={openMenu}
            rightSlot={
              <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
                <button
                  className="px-2.5 py-2 hover:bg-surface transition"
                  onClick={() => setYear(y => y - 1)}
                  aria-label="prev year"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="font-semibold tnum px-3 min-w-[60px] text-center text-sm border-x border-border py-1.5">{year}</div>
                <button
                  className="px-2.5 py-2 hover:bg-surface transition"
                  onClick={() => setYear(y => y + 1)}
                  aria-label="next year"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {months.map(m => (
              <div
                key={m.idx}
                className={cn(
                  'card p-4 transition',
                  m.isFuture && 'opacity-50',
                  m.isCurrent && 'ring-1 ring-fg',
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">{t(`month.${m.idx + 1}` as TranslationKey)}</div>
                  <CalendarIcon className="w-4 h-4 text-fg-subtle" />
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">{t('cal.income')}</dt>
                    <dd className="font-medium text-positive tnum">{formatUZS(m.income)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">{t('cal.expense')}</dt>
                    <dd className="font-medium text-negative tnum">{formatUZS(m.expense)}</dd>
                  </div>
                </dl>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs font-medium text-fg-muted">{t('cal.profit')}</span>
                  <span
                    className={cn(
                      'text-lg font-semibold tnum',
                      m.profit > 0 && 'text-positive',
                      m.profit < 0 && 'text-negative',
                    )}
                  >
                    {formatUZS(m.profit)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
