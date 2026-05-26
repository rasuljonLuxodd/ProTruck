import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, ShoppingCart, CreditCard, TrendingUp, AlertTriangle,
  Package, Users as UsersIcon, Receipt,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Skeleton, StatCardSkeleton } from '@/components/ui/Skeleton';
import { OnboardingChecklist, type OnboardingStep } from '@/components/ui/OnboardingChecklist';
import { useWorkers } from '@/hooks/useWorkers';
import { useT } from '@/i18n/LanguageProvider';
import { useSales } from '@/hooks/useSales';
import { useDebts } from '@/hooks/useDebts';
import { useExpenses } from '@/hooks/useExpenses';
import { useProductionLogs } from '@/hooks/useProductionLogs';
import { useActionLogs } from '@/hooks/useActionLogs';
import { useProducts } from '@/hooks/useProducts';
import {
  actualCashIncome,
  expenseTotal,
  inMonth,
  isSameDay,
  last7DaysSeries,
  netProfit,
  top3Products,
} from '@/lib/calc';
import { formatUZS, percentChange } from '@/lib/format';
import { useFormatDate } from '@/lib/useFormatters';
import type { ActionType } from '@/types';
import { cn } from '@/lib/utils';

const actionDot: Record<ActionType, string> = {
  sale: 'bg-positive',
  expense: 'bg-negative',
  production: 'bg-fg',
  payment: 'bg-amber-500',
};

export default function Dashboard() {
  const t = useT();
  const fmtDate = useFormatDate();
  const salesQ = useSales();
  const debtsQ = useDebts();
  const expensesQ = useExpenses();
  const productionQ = useProductionLogs();
  const actionsQ = useActionLogs();
  const productsQ = useProducts();
  const workersQ = useWorkers();

  const sales = salesQ.data ?? [];
  const debts = debtsQ.data ?? [];
  const expenses = expensesQ.data ?? [];
  const production = productionQ.data ?? [];
  const actions = actionsQ.data ?? [];
  const products = productsQ.data ?? [];
  const workers = workersQ.data ?? [];

  const lowStock = useMemo(
    () => products.filter(p => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock),
    [products],
  );

  // First-run? If nothing exists yet, show the onboarding checklist instead
  // of the four-zeros wasteland.
  const onboardingSteps = useMemo<OnboardingStep[]>(() => [
    { labelKey: 'welcome.step1', descKey: 'welcome.step1Desc', to: '/production', done: products.length > 0,  icon: Package },
    { labelKey: 'welcome.step2', descKey: 'welcome.step2Desc', to: '/sales',      done: sales.length > 0,     icon: ShoppingCart },
    { labelKey: 'welcome.step3', descKey: 'welcome.step3Desc', to: '/workers',    done: workers.length > 0,   icon: UsersIcon },
    { labelKey: 'welcome.step4', descKey: 'welcome.step4Desc', to: '/expenses',   done: expenses.length > 0,  icon: Receipt },
  ], [products.length, sales.length, workers.length, expenses.length]);

  const initialLoading = salesQ.isLoading || debtsQ.isLoading || expensesQ.isLoading || productionQ.isLoading;

  // Show the onboarding checklist as long as there are no sales yet — once
  // sales start flowing the dashboard has meaningful data to display.
  const showOnboarding = !initialLoading && sales.length === 0;

  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const totalIncome = useMemo(() => actualCashIncome(sales), [sales]);
  const prevIncome = useMemo(
    () => actualCashIncome(sales.filter(s => inMonth(s.date, last.getFullYear(), last.getMonth()))),
    [sales, last],
  );
  const todaySales = useMemo(
    () => sales.filter(s => isSameDay(s.date, now.toISOString())).reduce((a, s) => a + s.total, 0),
    [sales, now],
  );
  const yesterdaySales = useMemo(() => {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return sales.filter(s => isSameDay(s.date, y.toISOString())).reduce((a, s) => a + s.total, 0);
  }, [sales, now]);

  const totalDebt = useMemo(() => debts.reduce((a, d) => a + d.amount, 0), [debts]);
  const prevDebt = useMemo(
    () =>
      debts
        .filter(d => inMonth(d.date, last.getFullYear(), last.getMonth()))
        .reduce((a, d) => a + d.originalAmount, 0),
    [debts, last],
  );

  const profit = useMemo(() => netProfit(sales, expenses), [sales, expenses]);
  const prevProfit = useMemo(() => {
    const ms = sales.filter(s => inMonth(s.date, last.getFullYear(), last.getMonth()));
    const me = expenses.filter(e => inMonth(e.date, last.getFullYear(), last.getMonth()));
    return actualCashIncome(ms) - expenseTotal(me);
  }, [sales, expenses, last]);

  const series = useMemo(() => last7DaysSeries(sales, production), [sales, production]);
  const top3 = useMemo(() => top3Products(sales), [sales]);
  const recent = actions.slice(0, 10);

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader title={t('nav.dashboard')} onMenu={openMenu} />

          {showOnboarding && <OnboardingChecklist steps={onboardingSteps} />}

          {!showOnboarding && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {initialLoading ? (
              <>
                <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  title={t('dash.totalIncome')}
                  value={formatUZS(totalIncome)}
                  icon={Wallet}
                  change={percentChange(totalIncome, prevIncome)}
                  changeLabel={t('dash.vsLastMonth')}
                />
                <StatCard
                  title={t('dash.todaySales')}
                  value={formatUZS(todaySales)}
                  icon={ShoppingCart}
                  change={percentChange(todaySales, yesterdaySales)}
                />
                <StatCard
                  title={t('dash.totalDebt')}
                  value={formatUZS(totalDebt)}
                  icon={CreditCard}
                  tone="negative"
                  change={percentChange(totalDebt, prevDebt)}
                  changeLabel={t('dash.vsLastMonth')}
                />
                <StatCard
                  title={t('dash.netProfit')}
                  value={formatUZS(profit)}
                  icon={TrendingUp}
                  tone={profit >= 0 ? 'positive' : 'negative'}
                  change={percentChange(profit, prevProfit)}
                  changeLabel={t('dash.vsLastMonth')}
                />
              </>
            )}
          </div>
          )}

          {lowStock.length > 0 && (
            <Link
              to="/production"
              className="mt-4 card p-4 flex items-center gap-3 hover:bg-surface transition group"
            >
              <div className="w-9 h-9 rounded-lg bg-negative/10 text-negative flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {lowStock.length} {t('prod.lowStockAlert')}
                </div>
                <div className="text-xs text-fg-muted truncate">
                  {lowStock.slice(0, 4).map(p => `${p.name} (${p.stock})`).join(' · ')}
                  {lowStock.length > 4 ? ` +${lowStock.length - 4}` : ''}
                </div>
              </div>
              <span className="text-xs text-fg-muted opacity-0 group-hover:opacity-100 transition">→</span>
            </Link>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
            <div className="card p-5 xl:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">{t('dash.last7')}</h2>
              </div>
              <div className="h-72">
                {initialLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="date"
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
                        padding: '8px 10px',
                      }}
                      cursor={{ stroke: 'rgb(var(--border-strong))', strokeWidth: 1, strokeDasharray: '2 4' }}
                      offset={16}
                      allowEscapeViewBox={{ x: true, y: true }}
                    />
                    <Legend
                      iconType="plainline"
                      wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      name={t('dash.salesLine')}
                      stroke="rgb(var(--fg))"
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0, fill: 'rgb(var(--fg))' }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="production"
                      name={t('dash.productionLine')}
                      stroke="rgb(var(--fg-muted))"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, strokeWidth: 0, fill: 'rgb(var(--fg-muted))' }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4">{t('dash.top3')}</h2>
              {top3.length === 0 ? (
                <p className="text-sm text-fg-subtle">{t('common.empty')}</p>
              ) : (
                <ul className="space-y-2">
                  {top3.map((p, i) => (
                    <li key={p.name} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-surface-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-bg border border-border flex items-center justify-center text-[11px] font-semibold tnum">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium truncate">{p.name}</span>
                      </div>
                      <span className="text-sm font-semibold tnum">{p.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card mt-4">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">{t('dash.recent')}</h2>
            </div>
            {recent.length === 0 ? (
              <p className="px-5 py-8 text-sm text-fg-subtle text-center">{t('common.empty')}</p>
            ) : (
              <ul>
                {recent.map(a => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 px-5 py-2.5 border-b border-border last:border-0"
                  >
                    <span className={cn('w-2 h-2 rounded-full shrink-0', actionDot[a.type])} />
                    <span className="flex-1 text-sm truncate">{a.description}</span>
                    {a.userName ? (
                      <span className="text-xs text-fg-muted hidden sm:inline">— {a.userName}</span>
                    ) : null}
                    <span className="text-xs text-fg-subtle tnum">{fmtDate(a.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
