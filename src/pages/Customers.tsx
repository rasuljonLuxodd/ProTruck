import { useMemo, useState, type FormEvent } from 'react';
import { Search, User as UserIcon, Shield } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { useSales } from '@/hooks/useSales';
import { useDebts } from '@/hooks/useDebts';
import { useCreditLimits, useSetCreditLimit } from '@/hooks/useCreditLimits';
import { formatUZS } from '@/lib/format';
import { useFormatDate } from '@/lib/useFormatters';
import { cn } from '@/lib/utils';

interface CustomerRow {
  name: string;
  phone: string;
  saleCount: number;
  totalSpent: number;
  debt: number;
  lastSeen: string;
}

export default function Customers() {
  const t = useT();
  const { toast } = useToast();
  const fmtDate = useFormatDate();
  const { data: sales = [] } = useSales();
  const { data: debts = [] } = useDebts();
  const { data: limits = [] } = useCreditLimits();
  const setLimit = useSetCreditLimit();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitInput, setLimitInput] = useState(0);

  const rows = useMemo<CustomerRow[]>(() => {
    const map = new Map<string, CustomerRow>();
    for (const s of sales) {
      const key = s.customerName.trim().toLowerCase();
      if (!key) continue;
      const prev = map.get(key) ?? {
        name: s.customerName,
        phone: s.customerPhone,
        saleCount: 0,
        totalSpent: 0,
        debt: 0,
        lastSeen: s.date,
      };
      prev.saleCount += 1;
      prev.totalSpent += s.total;
      prev.phone = prev.phone || s.customerPhone;
      if (new Date(s.date) > new Date(prev.lastSeen)) prev.lastSeen = s.date;
      map.set(key, prev);
    }
    for (const d of debts) {
      const key = d.customerName.trim().toLowerCase();
      if (!key) continue;
      const prev = map.get(key);
      if (prev) {
        prev.debt += d.amount;
      } else {
        map.set(key, {
          name: d.customerName,
          phone: d.customerPhone,
          saleCount: 0,
          totalSpent: 0,
          debt: d.amount,
          lastSeen: d.date,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
    );
  }, [sales, debts]);

  const filtered = useMemo(
    () =>
      rows.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.phone.toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, search],
  );

  const selectedKey = selected?.toLowerCase() ?? null;
  const detail = selectedKey
    ? {
        customer: rows.find(r => r.name.toLowerCase() === selectedKey),
        sales: sales.filter(s => s.customerName.trim().toLowerCase() === selectedKey)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        debts: debts.filter(d => d.customerName.trim().toLowerCase() === selectedKey)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }
    : null;

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader title={t('nav.customers')} onMenu={openMenu} />

          {rows.length === 0 ? (
            <EmptyState
              icon={UserIcon}
              title={t('empty.sales.title')}
              description={t('empty.sales.desc')}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
                  <input
                    className="input pl-9"
                    placeholder={t('sales.searchPlaceholder')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="card overflow-hidden">
                  <ul className="max-h-[70vh] overflow-y-auto">
                    {filtered.map(c => (
                      <li
                        key={c.name + c.phone}
                        onClick={() => setSelected(c.name.toLowerCase())}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-border last:border-0 transition',
                          selectedKey === c.name.toLowerCase()
                            ? 'bg-surface-2'
                            : 'hover:bg-surface',
                        )}
                      >
                        <div className="w-9 h-9 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-semibold shrink-0">
                          {c.name.trim().slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{c.name}</div>
                          <div className="font-mono text-[11px] text-fg-muted truncate">{c.phone || '—'}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-fg-muted tnum">
                              {c.saleCount} · {formatUZS(c.totalSpent)}
                            </span>
                            {c.debt > 0 && (
                              <Badge tone="negative">{formatUZS(c.debt)}</Badge>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-7">
                {detail?.customer ? (
                  <div className="space-y-4">
                    <div className="card p-5">
                      <div className="text-xs text-fg-muted mb-1">{t('common.customer')}</div>
                      <div className="text-xl font-semibold">{detail.customer.name}</div>
                      <div className="font-mono text-xs text-fg-muted mt-0.5">{detail.customer.phone || '—'}</div>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="bg-surface border border-border rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-fg-muted">{t('sales.colTotal')}</div>
                          <div className="text-base font-semibold tnum mt-0.5">{formatUZS(detail.customer.totalSpent)}</div>
                        </div>
                        <div className="bg-surface border border-border rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-fg-muted">{t('debts.colAmount')}</div>
                          <div className={cn('text-base font-semibold tnum mt-0.5', detail.customer.debt > 0 ? 'text-negative' : 'text-fg')}>
                            {formatUZS(detail.customer.debt)}
                          </div>
                        </div>
                        <div className="bg-surface border border-border rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-fg-muted">{t('common.date')}</div>
                          <div className="text-base font-semibold tnum mt-0.5">{fmtDate(detail.customer.lastSeen)}</div>
                        </div>
                      </div>

                      {(() => {
                        const key = detail.customer.name.trim().toLowerCase();
                        const existing = limits.find(l => l.name.trim().toLowerCase() === key);
                        return (
                          <div className="mt-3 flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2.5">
                            <div className="flex items-center gap-2 text-sm">
                              <Shield className="w-4 h-4 text-fg-muted" />
                              <span className="text-fg-muted">Credit limit:</span>
                              <span className="font-semibold tnum">
                                {existing ? formatUZS(existing.maxDebt) : '—'}
                              </span>
                            </div>
                            <button
                              className="btn-secondary !py-1 !text-xs"
                              onClick={() => {
                                setLimitInput(existing?.maxDebt ?? 0);
                                setLimitModalOpen(true);
                              }}
                            >
                              {existing ? t('common.edit') : t('common.add')}
                            </button>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="card overflow-hidden">
                      <div className="px-4 py-3 border-b border-border text-sm font-semibold">
                        {t('nav.sales')}
                      </div>
                      <ul>
                        {detail.sales.map(s => (
                          <li key={s.id} className="px-4 py-2.5 border-b border-border last:border-0 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm truncate">{s.items.map(i => `${i.productName} ×${i.quantity}`).join(', ')}</div>
                              <div className="text-xs text-fg-muted tnum">{fmtDate(s.date)}</div>
                            </div>
                            <div className="text-sm font-semibold tnum">{formatUZS(s.total)}</div>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {detail.debts.length > 0 && (
                      <div className="card overflow-hidden">
                        <div className="px-4 py-3 border-b border-border text-sm font-semibold">
                          {t('nav.debts')}
                        </div>
                        <ul>
                          {detail.debts.map(d => (
                            <li key={d.id} className="px-4 py-2.5 border-b border-border last:border-0 flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm truncate">{d.product}</div>
                                <div className="text-xs text-fg-muted tnum">{fmtDate(d.date)}</div>
                              </div>
                              <div className="text-sm font-semibold text-negative tnum">{formatUZS(d.amount)}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="card p-10 text-center text-fg-subtle text-sm">
                    {t('common.view')} →
                  </div>
                )}
              </div>
            </div>
          )}

          <Modal
            open={limitModalOpen}
            onClose={() => setLimitModalOpen(false)}
            title="Credit limit"
            size="sm"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setLimitModalOpen(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  className="btn-primary"
                  onClick={(e: FormEvent | React.MouseEvent) => {
                    e.preventDefault();
                    if (!detail?.customer) return;
                    setLimit.mutate(
                      { name: detail.customer.name, phone: detail.customer.phone, maxDebt: limitInput },
                      {
                        onSuccess: () => { toast(t('toast.saved')); setLimitModalOpen(false); },
                        onError: () => toast(t('toast.error'), 'error'),
                      },
                    );
                  }}
                >
                  {t('common.save')}
                </button>
              </>
            }
          >
            <Field label="Max debt (UZS)">
              <input
                type="number"
                min={0}
                className="input"
                value={limitInput}
                onChange={e => setLimitInput(Number(e.target.value))}
                autoFocus
              />
            </Field>
          </Modal>
        </>
      )}
    </Layout>
  );
}
