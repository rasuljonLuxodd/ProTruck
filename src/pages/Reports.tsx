import { useMemo, useState } from 'react';
import { FileText, TrendingUp, TrendingDown, ShoppingCart, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { DatePicker } from '@/components/ui/DatePicker';
import { ChartTooltip } from '@/components/ui/ChartTooltip';
import { useT } from '@/i18n/LanguageProvider';
import { useSales } from '@/hooks/useSales';
import { useExpenses } from '@/hooks/useExpenses';
import { useProducts } from '@/hooks/useProducts';
import {
  actualCashIncome, expenseTotal, totalMargin, inMonth,
} from '@/lib/calc';
import { formatUZS, percentChange } from '@/lib/format';
import { useFormatDate } from '@/lib/useFormatters';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@/i18n/translations';

type Preset = 'thisMonth' | 'lastMonth' | 'last30' | 'ytd' | 'custom';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromInputDate(s: string): Date {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

function presetRange(preset: Preset, now: Date = new Date()): { from: string; to: string } {
  const today = startOfDay(now);
  if (preset === 'thisMonth') {
    return {
      from: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to:   toInputDate(today),
    };
  }
  if (preset === 'lastMonth') {
    const y = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const m = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
    return {
      from: toInputDate(new Date(y, m, 1)),
      to:   toInputDate(new Date(y, m + 1, 0)),
    };
  }
  if (preset === 'last30') {
    const t = new Date(today);
    t.setDate(today.getDate() - 29);
    return { from: toInputDate(t), to: toInputDate(today) };
  }
  if (preset === 'ytd') {
    return {
      from: toInputDate(new Date(today.getFullYear(), 0, 1)),
      to:   toInputDate(today),
    };
  }
  return { from: toInputDate(today), to: toInputDate(today) };
}

const COLORS = [
  'rgb(var(--fg))',
  'rgb(var(--fg-muted))',
  'rgb(var(--fg-subtle))',
  'rgb(var(--border-strong))',
  'rgb(var(--border))',
];

export default function Reports() {
  const t = useT();
  const fmtDate = useFormatDate();
  const { data: sales = [] } = useSales();
  const { data: expenses = [] } = useExpenses();
  const { data: products = [] } = useProducts();

  const [preset, setPreset] = useState<Preset>('thisMonth');
  const initial = presetRange('thisMonth');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== 'custom') {
      const r = presetRange(p);
      setFrom(r.from);
      setTo(r.to);
    }
  }

  const range = useMemo(() => {
    const f = fromInputDate(from).getTime();
    const tEnd = endOfDay(fromInputDate(to)).getTime();
    return { from: f, to: tEnd };
  }, [from, to]);

  const inRange = (iso: string) => {
    const t0 = new Date(iso).getTime();
    return t0 >= range.from && t0 <= range.to;
  };

  // Range slices
  const rangeSales = useMemo(() => sales.filter(s => inRange(s.date)), [sales, range]);
  const rangeExpenses = useMemo(() => expenses.filter(e => inRange(e.date)), [expenses, range]);

  // Previous period (same length, immediately before) for trend comparisons
  const prevRange = useMemo(() => {
    const span = range.to - range.from;
    return { from: range.from - span - 1, to: range.from - 1 };
  }, [range]);
  const prevInRange = (iso: string) => {
    const t0 = new Date(iso).getTime();
    return t0 >= prevRange.from && t0 <= prevRange.to;
  };
  const prevSales = useMemo(() => sales.filter(s => prevInRange(s.date)), [sales, prevRange]);
  const prevExpenses = useMemo(() => expenses.filter(e => prevInRange(e.date)), [expenses, prevRange]);

  // Index products for margin calc
  const productsById = useMemo(() => {
    const m = new Map<string, { cost: number; name: string }>();
    for (const p of products) m.set(p.id, { cost: p.cost, name: p.name });
    return m;
  }, [products]);

  // Headline numbers
  const revenue       = useMemo(() => actualCashIncome(rangeSales), [rangeSales]);
  const grossMargin   = useMemo(() => totalMargin(rangeSales, productsById), [rangeSales, productsById]);
  const cogs          = useMemo(() => rangeSales.reduce((sum, s) => {
    return sum + s.items.reduce((acc, it) => acc + (productsById.get(it.productId)?.cost ?? 0) * it.quantity, 0);
  }, 0), [rangeSales, productsById]);
  const opexExSalary  = useMemo(() => expenseTotal(rangeExpenses.filter(e => e.category !== 'Maosh')), [rangeExpenses]);
  const salaries      = useMemo(() => expenseTotal(rangeExpenses.filter(e => e.category === 'Maosh')), [rangeExpenses]);
  const netProfit     = revenue - cogs - opexExSalary - salaries;

  const prevRevenue     = useMemo(() => actualCashIncome(prevSales), [prevSales]);
  const prevMargin      = useMemo(() => totalMargin(prevSales, productsById), [prevSales, productsById]);
  const prevExpAmt      = useMemo(() => expenseTotal(prevExpenses), [prevExpenses]);

  // Expense breakdown by category
  const expenseByCategory = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of rangeExpenses) {
      buckets.set(e.category, (buckets.get(e.category) ?? 0) + e.amount);
    }
    return [...buckets.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [rangeExpenses]);

  const totalExp = opexExSalary + salaries;

  // Top customers (by total revenue brought)
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; salesCount: number }>();
    for (const s of rangeSales) {
      const key = s.customerName.trim();
      if (!key) continue;
      const prev = map.get(key.toLowerCase()) ?? { name: key, revenue: 0, salesCount: 0 };
      map.set(key.toLowerCase(), {
        name: prev.name,
        revenue: prev.revenue + s.total,
        salesCount: prev.salesCount + 1,
      });
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [rangeSales]);

  // Top products (by total revenue + computed margin)
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; quantity: number; margin: number }>();
    for (const s of rangeSales) {
      for (const it of s.items) {
        const product = productsById.get(it.productId);
        const prev = map.get(it.productId) ?? { name: it.productName, revenue: 0, quantity: 0, margin: 0 };
        const lineRevenue = it.quantity * it.price;
        const lineMargin = (it.price - (product?.cost ?? 0)) * it.quantity;
        map.set(it.productId, {
          name: prev.name,
          revenue: prev.revenue + lineRevenue,
          quantity: prev.quantity + it.quantity,
          margin: prev.margin + lineMargin,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [rangeSales, productsById]);

  // Profit dynamics: 12 monthly buckets ending at the range's end month
  const dynamics = useMemo(() => {
    const out: Array<{ label: string; profit: number; revenue: number }> = [];
    const end = new Date(range.to);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const ms = sales.filter(s => inMonth(s.date, y, m));
      const me = expenses.filter(e => inMonth(e.date, y, m));
      const rev = actualCashIncome(ms);
      const cgs = ms.reduce((sum, s) =>
        sum + s.items.reduce((acc, it) => acc + (productsById.get(it.productId)?.cost ?? 0) * it.quantity, 0), 0);
      const p = rev - cgs - expenseTotal(me);
      out.push({
        label: t(`month.${m + 1}` as TranslationKey).slice(0, 3),
        profit: p,
        revenue: rev,
      });
    }
    return out;
  }, [sales, expenses, range.to, t, productsById]);

  function downloadPDF() {
    window.print();
  }

  const rangeLabel = `${fmtDate(fromInputDate(from).toISOString())} — ${fmtDate(fromInputDate(to).toISOString())}`;

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader
            title={t('nav.reports')}
            onMenu={openMenu}
            description={rangeLabel}
            rightSlot={
              <button className="btn-secondary no-print" onClick={downloadPDF}>
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            }
          />

          {/* Date range + presets */}
          <div className="card p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex flex-wrap gap-1">
              {(['thisMonth', 'lastMonth', 'last30', 'ytd'] as Preset[]).map(p => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-md text-xs font-medium transition',
                    preset === p
                      ? 'bg-fg text-bg'
                      : 'text-fg-muted hover:bg-surface hover:text-fg',
                  )}
                >
                  {t(`rep.preset.${p}` as TranslationKey)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 lg:ml-auto">
              <DatePicker
                value={from}
                onChange={(v) => { setFrom(v); setPreset('custom'); }}
                className="w-40"
              />
              <span className="text-fg-subtle">—</span>
              <DatePicker
                value={to}
                onChange={(v) => { setTo(v); setPreset('custom'); }}
                className="w-40"
              />
            </div>
          </div>

          {/* Headline stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <HeadlineCard
              title={t('rep.revenue')}
              value={formatUZS(revenue)}
              icon={ShoppingCart}
              change={percentChange(revenue, prevRevenue)}
            />
            <HeadlineCard
              title={t('rep.grossMargin')}
              value={formatUZS(grossMargin)}
              icon={TrendingUp}
              change={percentChange(grossMargin, prevMargin)}
              tone={grossMargin >= 0 ? 'positive' : 'negative'}
            />
            <HeadlineCard
              title={t('rep.expenses')}
              value={formatUZS(totalExp)}
              icon={Wallet}
              change={percentChange(totalExp, prevExpAmt)}
              invertChangeColor
            />
            <HeadlineCard
              title={t('rep.netProfit')}
              value={formatUZS(netProfit)}
              icon={netProfit >= 0 ? TrendingUp : TrendingDown}
              tone={netProfit >= 0 ? 'positive' : 'negative'}
            />
          </div>

          {/* Profit & Loss + expense breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
            <div className="card p-5 lg:col-span-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-fg-muted mb-4">
                {t('rep.pnl')}
              </h2>
              <div className="space-y-0">
                <PnlRow label={t('rep.revenue')} value={revenue} />
                <PnlRow label={t('rep.cogs')} value={-cogs} dim />
                <PnlRow label={t('rep.grossMargin')} value={grossMargin} emphasize />
                <div className="my-3 border-t border-border" />
                <PnlRow label={t('rep.opex')} value={-opexExSalary} dim />
                <PnlRow label={t('rep.salaries')} value={-salaries} dim />
                <div className="my-3 border-t border-border" />
                <PnlRow label={t('rep.netProfit')} value={netProfit} emphasize bold />
              </div>
            </div>

            <div className="card p-5 lg:col-span-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-fg-muted mb-4">
                {t('rep.expBreakdown')}
              </h2>
              {expenseByCategory.length === 0 ? (
                <div className="py-12 text-center text-sm text-fg-subtle">{t('common.empty')}</div>
              ) : (
                <>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseByCategory}
                          dataKey="amount"
                          nameKey="category"
                          innerRadius={42}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {expenseByCategory.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip asMoney />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {expenseByCategory.map((row, i) => (
                      <div key={row.category} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            aria-hidden
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                          <span className="truncate text-fg-muted">
                            {t(`expCat.${row.category}` as TranslationKey)}
                          </span>
                        </div>
                        <span className="tnum font-semibold">{formatUZS(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Profit dynamics — 12 months */}
          <div className="card p-5 mb-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-fg-muted mb-4">
              {t('rep.dynamics')}
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dynamics} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor="rgb(var(--fg))" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="rgb(var(--fg))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="rgb(var(--fg-muted))" fontSize={11} tickLine={false} axisLine={false} />
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
                  <Tooltip content={<ChartTooltip asMoney />} cursor={{ stroke: 'rgb(var(--border-strong))', strokeDasharray: '2 4' }} />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name={t('rep.netProfit')}
                    stroke="rgb(var(--fg))"
                    strokeWidth={2}
                    fill="url(#profitArea)"
                    dot={{ r: 3, strokeWidth: 0, fill: 'rgb(var(--fg))' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top customers + top products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h2 className="text-xs font-medium uppercase tracking-wider text-fg-muted">
                  {t('rep.topCustomers')}
                </h2>
              </div>
              {topCustomers.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-fg-subtle">
                  {t('common.empty')}
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('common.customer')}</th>
                      <th className="text-right">{t('rep.salesCount')}</th>
                      <th className="text-right">{t('rep.revenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map(c => (
                      <tr key={c.name}>
                        <td className="font-medium">{c.name}</td>
                        <td className="text-right font-mono text-xs text-fg-muted">{c.salesCount}</td>
                        <td className="text-right font-semibold">{formatUZS(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h2 className="text-xs font-medium uppercase tracking-wider text-fg-muted">
                  {t('rep.topProducts')}
                </h2>
              </div>
              {topProducts.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-fg-subtle">
                  {t('common.empty')}
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('common.product')}</th>
                      <th className="text-right">{t('common.quantity')}</th>
                      <th className="text-right">{t('rep.revenue')}</th>
                      <th className="text-right">{t('rep.margin')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map(p => (
                      <tr key={p.name}>
                        <td className="font-medium">{p.name}</td>
                        <td className="text-right font-mono text-xs text-fg-muted">{p.quantity}</td>
                        <td className="text-right font-semibold">{formatUZS(p.revenue)}</td>
                        <td className={cn(
                          'text-right tnum text-xs',
                          p.margin >= 0 ? 'text-positive' : 'text-negative',
                        )}>
                          {formatUZS(p.margin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Expense detail at the very bottom */}
          <div className="card overflow-hidden mt-4">
            <div className="px-5 py-3.5 border-b border-border">
              <h2 className="text-xs font-medium uppercase tracking-wider text-fg-muted">
                {t('rep.expTable')}
              </h2>
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
                  {rangeExpenses.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-fg-subtle py-10">{t('common.empty')}</td></tr>
                  ) : (
                    rangeExpenses
                      .slice()
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(e => (
                        <tr key={e.id}>
                          <td className="font-mono text-xs text-fg-muted whitespace-nowrap">{fmtDate(e.date)}</td>
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

// ---------- helpers ----------

interface HeadlineProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  change?: number;
  tone?: 'default' | 'positive' | 'negative';
  /** If true, a *positive* change is shown in red (used for expenses). */
  invertChangeColor?: boolean;
}

function HeadlineCard({ title, value, icon: Icon, change, tone = 'default', invertChangeColor }: HeadlineProps) {
  const hasChange = typeof change === 'number' && isFinite(change);
  const up = (change ?? 0) >= 0;
  const goodMove = invertChangeColor ? !up : up;
  const valueClass =
    tone === 'positive' ? 'text-positive' :
    tone === 'negative' ? 'text-negative' :
    'text-fg';
  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-fg-muted">{title}</div>
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-surface-2 border border-border">
          <Icon className="w-4 h-4 text-fg-muted" />
        </div>
      </div>
      <div className={cn('stat-value', valueClass)}>{value}</div>
      {hasChange && (
        <div className="mt-2.5 flex items-center gap-1 text-xs">
          <div className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium tnum',
            goodMove ? 'text-positive bg-positive/10' : 'text-negative bg-negative/10',
          )}>
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {up ? '+' : ''}{change!.toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}

interface PnlRowProps {
  label: string;
  value: number;
  dim?: boolean;
  emphasize?: boolean;
  bold?: boolean;
}

function PnlRow({ label, value, dim, emphasize, bold }: PnlRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={cn(
        'text-sm',
        dim && 'text-fg-muted',
        bold && 'font-semibold',
      )}>
        {label}
      </span>
      <span className={cn(
        'tnum',
        emphasize ? 'text-lg' : 'text-sm',
        bold && 'font-semibold',
        value < 0 && 'text-negative',
        value >= 0 && emphasize && 'text-positive',
        value >= 0 && !emphasize && !dim && 'text-fg',
      )}>
        {formatUZS(value)}
      </span>
    </div>
  );
}
