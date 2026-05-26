import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useT } from '@/i18n/LanguageProvider';
import { useSales } from '@/hooks/useSales';
import { useExpenses } from '@/hooks/useExpenses';
import { actualCashIncome, inMonth, expenseTotal } from '@/lib/calc';
import { formatUZS, formatDate, percentChange, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@/i18n/translations';

export default function Reports() {
  const t = useT();
  const { data: sales = [] } = useSales();
  const { data: expenses = [] } = useExpenses();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  function shift(delta: number) {
    let y = year;
    let m = month + delta;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setYear(y); setMonth(m);
  }

  function prevMonthOf(y: number, m: number): { y: number; m: number } {
    if (m === 0) return { y: y - 1, m: 11 };
    return { y, m: m - 1 };
  }

  const monthSales = useMemo(
    () => sales.filter(s => inMonth(s.date, year, month)),
    [sales, year, month],
  );
  const monthExp = useMemo(
    () => expenses.filter(e => inMonth(e.date, year, month)),
    [expenses, year, month],
  );

  const prev = prevMonthOf(year, month);
  const prevSales = sales.filter(s => inMonth(s.date, prev.y, prev.m));
  const prevExp = expenses.filter(e => inMonth(e.date, prev.y, prev.m));

  const income = actualCashIncome(monthSales);
  const exp = expenseTotal(monthExp.filter(e => e.category !== 'Maosh'));
  const salaries = monthExp.filter(e => e.category === 'Maosh').reduce((a, e) => a + e.amount, 0);
  const profit = income - exp - salaries;

  const prevIncome = actualCashIncome(prevSales);
  const prevExpAmt = expenseTotal(prevExp.filter(e => e.category !== 'Maosh'));
  const prevSal = prevExp.filter(e => e.category === 'Maosh').reduce((a, e) => a + e.amount, 0);

  const dynamics = useMemo(() => {
    const out: Array<{ label: string; profit: number }> = [];
    for (let i = 5; i >= 0; i--) {
      let y = year;
      let m = month - i;
      while (m < 0) { m += 12; y -= 1; }
      const ms = sales.filter(s => inMonth(s.date, y, m));
      const me = expenses.filter(e => inMonth(e.date, y, m));
      const p = actualCashIncome(ms) - expenseTotal(me);
      out.push({ label: t(`month.${m + 1}` as TranslationKey).slice(0, 3), profit: p });
    }
    return out;
  }, [sales, expenses, year, month, t]);

  const monthLabel = `${t(`month.${month + 1}` as TranslationKey)} ${year}`;

  function downloadPDF() {
    window.print();
  }

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader
            title={t('nav.reports')}
            onMenu={openMenu}
            rightSlot={
              <div className="flex items-center gap-2">
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button className="px-2.5 py-2 hover:bg-surface transition" onClick={() => shift(-1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-sm font-medium px-3 min-w-[100px] text-center border-x border-border py-1.5">{monthLabel}</div>
                  <button className="px-2.5 py-2 hover:bg-surface transition" onClick={() => shift(1)}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <button className="btn-secondary" onClick={downloadPDF}>
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4">{monthLabel}</h2>
              <ReportRow
                label={t('rep.salesRow')}
                amount={income}
                change={percentChange(income, prevIncome)}
                tone="positive"
              />
              <ReportRow
                label={t('rep.expRow')}
                amount={exp}
                change={percentChange(exp, prevExpAmt)}
                tone="negative"
              />
              <ReportRow
                label={t('rep.salariesRow')}
                amount={salaries}
                change={percentChange(salaries, prevSal)}
                tone="neutral"
              />
              <div
                className={cn(
                  'mt-4 p-4 rounded-lg border flex items-center justify-between',
                  profit >= 0 ? 'bg-positive/5 border-positive/20' : 'bg-negative/5 border-negative/20',
                )}
              >
                <span className="text-sm font-medium">{t('rep.netProfit')}</span>
                <span className={cn('text-2xl font-semibold tnum', profit >= 0 ? 'text-positive' : 'text-negative')}>
                  {formatUZS(profit)}
                </span>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4">{t('rep.dynamics')}</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dynamics} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="rgb(var(--fg-muted))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="rgb(var(--fg-muted))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={v => {
                        if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                        if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}K`;
                        return String(v);
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgb(var(--bg))',
                        border: '1px solid rgb(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="rgb(var(--fg))"
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0, fill: 'rgb(var(--fg))' }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">{t('rep.expTable')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('common.description')}</th>
                    <th className="text-right">{t('common.amount')}</th>
                    <th>{t('common.category')}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthExp.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-fg-subtle py-10">{t('common.empty')}</td></tr>
                  ) : (
                    monthExp
                      .slice()
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(e => (
                        <tr key={e.id}>
                          <td className="font-mono text-xs text-fg-muted">{formatDate(e.date)}</td>
                          <td>{e.description}</td>
                          <td className="text-right text-negative font-semibold">{formatUZS(e.amount)}</td>
                          <td><Badge>{t(`expCat.${e.category}` as TranslationKey)}</Badge></td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

interface RowProps {
  label: string;
  amount: number;
  change: number;
  tone: 'positive' | 'negative' | 'neutral';
}

function ReportRow({ label, amount, change, tone }: RowProps) {
  const up = change >= 0;
  const positiveChange =
    tone === 'positive' ? up : tone === 'negative' ? !up : true;
  const Icon = tone === 'positive' ? ArrowUpRight : tone === 'negative' ? ArrowDownRight : Minus;
  const iconColor =
    tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : 'text-fg-muted';
  return (
    <div className="grid grid-cols-12 gap-3 items-center py-3 border-b border-border last:border-0">
      <div className="col-span-5 flex items-center gap-2 min-w-0">
        <Icon className={cn('w-4 h-4 shrink-0', iconColor)} />
        <span className="text-sm truncate">{label}</span>
      </div>
      <div className="col-span-4 text-right font-semibold tnum">{formatUZS(amount)}</div>
      <div className={cn('col-span-3 text-right text-xs tnum', positiveChange ? 'text-positive' : 'text-negative')}>
        {formatPercent(change)}
      </div>
    </div>
  );
}
