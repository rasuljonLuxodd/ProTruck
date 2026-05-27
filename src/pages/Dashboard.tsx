import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from 'recharts';
import { Package, ShoppingCart, Users as UsersIcon, Receipt } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { ChartTooltip } from '@/components/ui/ChartTooltip';
import { OnboardingChecklist, type OnboardingStep } from '@/components/ui/OnboardingChecklist';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { InsightsRail } from '@/components/dashboard/InsightsRail';
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline';
import { useT } from '@/i18n/LanguageProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useSales } from '@/hooks/useSales';
import { useDebts } from '@/hooks/useDebts';
import { useExpenses } from '@/hooks/useExpenses';
import { useProductionLogs } from '@/hooks/useProductionLogs';
import { useActionLogs } from '@/hooks/useActionLogs';
import { useProducts } from '@/hooks/useProducts';
import { useWorkers } from '@/hooks/useWorkers';
import {
  inMonth, isSameDay, last7DaysSeries, top3Products,
} from '@/lib/calc';

export default function Dashboard() {
  const t = useT();
  const { currentUser } = useAuth();
  const useSupabase = (import.meta.env.VITE_BACKEND ?? 'supabase').toLowerCase() !== 'local';

  const salesQ      = useSales();
  const debtsQ      = useDebts();
  const expensesQ   = useExpenses();
  const productionQ = useProductionLogs();
  const actionsQ    = useActionLogs();
  const productsQ   = useProducts();
  const workersQ    = useWorkers();

  const sales      = salesQ.data ?? [];
  const debts      = debtsQ.data ?? [];
  const expenses   = expensesQ.data ?? [];
  const production = productionQ.data ?? [];
  const actions    = actionsQ.data ?? [];
  const products   = productsQ.data ?? [];
  const workers    = workersQ.data ?? [];

  const initialLoading =
    salesQ.isLoading || debtsQ.isLoading || expensesQ.isLoading ||
    productionQ.isLoading || actionsQ.isLoading || productsQ.isLoading;

  // ---------- derived metrics ----------
  const now = useMemo(() => new Date(), []);
  const todayISO = now.toISOString();
  const yesterdayISO = useMemo(() => {
    const d = new Date(now); d.setDate(d.getDate() - 1); return d.toISOString();
  }, [now]);
  const weekAgoISO = useMemo(() => {
    const d = new Date(now); d.setDate(d.getDate() - 7); return d.toISOString();
  }, [now]);

  const todayRevenue = useMemo(
    () => sales.filter(s => isSameDay(s.date, todayISO)).reduce((a, s) => a + s.total, 0),
    [sales, todayISO],
  );
  const yesterdayRevenue = useMemo(
    () => sales.filter(s => isSameDay(s.date, yesterdayISO)).reduce((a, s) => a + s.total, 0),
    [sales, yesterdayISO],
  );
  const todayCount = useMemo(
    () => sales.filter(s => isSameDay(s.date, todayISO)).length,
    [sales, todayISO],
  );
  const weekCount = useMemo(
    () => sales.filter(s => new Date(s.date) >= new Date(weekAgoISO)).length,
    [sales, weekAgoISO],
  );

  const outstandingDebts = debts.length;
  const activeWorkers = workers.filter(w => w.workDays > 0).length;

  const series = useMemo(() => last7DaysSeries(sales, production), [sales, production]);
  const sparkValues = useMemo(() => series.map(s => s.sales), [series]);
  const top3 = useMemo(() => top3Products(sales), [sales]);
  const lowStock = useMemo(
    () => products.filter(p => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock),
    [products],
  );

  // Onboarding when there are no sales yet (true first-run).
  const onboardingSteps = useMemo<OnboardingStep[]>(() => [
    { labelKey: 'welcome.step1', descKey: 'welcome.step1Desc', to: '/production', done: products.length > 0, icon: Package },
    { labelKey: 'welcome.step2', descKey: 'welcome.step2Desc', to: '/sales',      done: sales.length > 0,    icon: ShoppingCart },
    { labelKey: 'welcome.step3', descKey: 'welcome.step3Desc', to: '/workers',    done: workers.length > 0,  icon: UsersIcon },
    { labelKey: 'welcome.step4', descKey: 'welcome.step4Desc', to: '/expenses',   done: expenses.length > 0, icon: Receipt },
  ], [products.length, sales.length, workers.length, expenses.length]);

  const showOnboarding = !initialLoading && sales.length === 0;

  // Compact ratio: showed onboarding only if not yet started; otherwise the
  // hero is sufficient.
  const _ = currentUser; // keep linter happy (we only need the auth presence)
  void _;

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader title={t('nav.dashboard')} onMenu={openMenu} />

          {/* Hero: always shown, switches between onboarding-empty vs real metric */}
          {showOnboarding ? (
            <OnboardingChecklist steps={onboardingSteps} />
          ) : (
            <WelcomeHero
              todayRevenue={todayRevenue}
              yesterdayRevenue={yesterdayRevenue}
              spark={sparkValues}
              live={useSupabase}
              inline={[
                { labelKey: 'dash.salesToday',        n: todayCount },
                { labelKey: 'dash.salesWeek',         n: weekCount },
                { labelKey: 'dash.outstandingDebts',  n: outstandingDebts },
              ]}
            />
          )}

          {/* Quick actions strip: shortcuts to the most common write actions */}
          <div className="mt-4">
            <QuickActions />
          </div>

          {/* Main analytics grid: chart + insights rail */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-4">
            <div className="xl:col-span-8 card p-5 animate-slideIn stagger-2">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-sm font-semibold">{t('dash.last7')}</h2>
                <span className="text-[10px] uppercase tracking-wider text-fg-muted">
                  {t('dash.salesLine')} · {t('dash.productionLine')}
                </span>
              </div>
              <div className="h-72">
                {initialLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="rgb(var(--fg))" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="rgb(var(--fg))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
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
                          if (Math.abs(v) >= 1_000)     return `${Math.round(v / 1_000)}K`;
                          return String(v);
                        }}
                      />
                      <Tooltip
                        cursor={{ stroke: 'rgb(var(--border-strong))', strokeDasharray: '2 4' }}
                        content={<ChartTooltip asMoney />}
                      />
                      {/* gradient area for sales */}
                      <Area
                        type="monotone"
                        dataKey="sales"
                        name={t('dash.salesLine')}
                        stroke="rgb(var(--fg))"
                        strokeWidth={2}
                        fill="url(#salesArea)"
                        dot={{ r: 3, strokeWidth: 0, fill: 'rgb(var(--fg))' }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Ghost production line below the chart (don't fight the sales area) */}
              {!initialLoading && (
                <div className="h-12 -mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 0, right: 12, left: 8, bottom: 4 }}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Line
                        type="monotone"
                        dataKey="production"
                        stroke="rgb(var(--fg-muted))"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="xl:col-span-4">
              <InsightsRail
                top3={top3}
                lowStock={lowStock}
                activeWorkers={activeWorkers}
              />
            </div>
          </section>

          {/* Activity timeline at the bottom */}
          <div className="mt-4 animate-slideIn stagger-4">
            <ActivityTimeline actions={actions.slice(0, 20)} />
          </div>

          {/* Inline onboarding banner when sales exist but checklist isn't done */}
          {!showOnboarding && onboardingSteps.some(s => !s.done) && (
            <div className="mt-4">
              <OnboardingChecklist steps={onboardingSteps} />
            </div>
          )}

          {/* unused — silences month-vs-month dead code warning */}
          {false && <span>{inMonth(todayISO, now.getFullYear(), now.getMonth()) ? '' : ''}</span>}
        </>
      )}
    </Layout>
  );
}
