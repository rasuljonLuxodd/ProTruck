import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, User as UserIcon, Shield, MessageCircle, Phone, ArrowLeft, TrendingUp } from 'lucide-react';
import { customerSlug, customerProfilePath as _customerProfilePath } from '@/lib/customerSlug';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { useT, useLanguage } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { useSales } from '@/hooks/useSales';
import { useDebts } from '@/hooks/useDebts';
import { useProducts } from '@/hooks/useProducts';
import { useCreditLimits, useSetCreditLimit, useSetCustomerNotes } from '@/hooks/useCreditLimits';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { formatUZS } from '@/lib/format';
import { useFormatDate } from '@/lib/useFormatters';
import { saleMargin } from '@/lib/calc';
import { buildReminderText, waMeUrl, normalizePhone } from '@/lib/reminder';
import { cn } from '@/lib/utils';

interface CustomerRow {
  name: string;
  phone: string;
  saleCount: number;
  totalSpent: number;
  totalMargin: number;
  debt: number;
  lastSeen: string;
}

// customerSlug + customerProfilePath now live in @/lib/customerSlug so
// other pages can import them without pulling this whole page into
// their bundle. _customerProfilePath import is just for the trailing
// re-export below (preserved for backward compatibility).

export default function Customers() {
  const t = useT();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const fmtDate = useFormatDate();
  const navigate = useNavigate();
  const params = useParams<{ slug?: string }>();
  const { data: sales = [] } = useSales();
  const { data: debts = [] } = useDebts();
  const { data: products = [] } = useProducts();
  const { data: limits = [] } = useCreditLimits();
  const setLimit = useSetCreditLimit();
  const setNotes = useSetCustomerNotes();
  const [search, setSearch] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaved, setNotesSaved] = useState(true);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [limitInput, setLimitInput] = useState(0);

  const productsById = useMemo(() => {
    const m = new Map<string, { cost: number }>();
    for (const p of products) m.set(p.id, { cost: p.cost });
    return m;
  }, [products]);

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
        totalMargin: 0,
        debt: 0,
        lastSeen: s.date,
      };
      prev.saleCount += 1;
      prev.totalSpent += s.total;
      prev.totalMargin += saleMargin(s, productsById);
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
          totalMargin: 0,
          debt: d.amount,
          lastSeen: d.date,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
    );
  }, [sales, debts, productsById]);

  // URL slug → selected customer. Falls back to null when the slug doesn't
  // match anyone (e.g. the customer was renamed or deleted).
  const selectedRow = useMemo(() => {
    if (!params.slug) return null;
    return rows.find(r => customerSlug(r.name) === params.slug) ?? null;
  }, [rows, params.slug]);

  // Redirect to the URL when a row is clicked
  function open(name: string) {
    navigate(`/customers/${customerSlug(name)}`);
  }

  const filtered = useMemo(
    () =>
      rows.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.phone.toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, search],
  );

  const detail = useMemo(() => {
    if (!selectedRow) return null;
    const key = selectedRow.name.trim().toLowerCase();
    return {
      customer: selectedRow,
      sales: sales.filter(s => s.customerName.trim().toLowerCase() === key)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      debts: debts.filter(d => d.customerName.trim().toLowerCase() === key)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    };
  }, [selectedRow, sales, debts]);

  // When the slug points at a customer that doesn't exist anymore, bounce
  // back to the list — better than leaving the user staring at a broken
  // "Select a customer" placeholder.
  useEffect(() => {
    if (params.slug && rows.length > 0 && !selectedRow) {
      navigate('/customers', { replace: true });
    }
  }, [params.slug, rows.length, selectedRow, navigate]);

  // Seed the notes draft when the selected customer changes
  const limitForCurrent = useMemo(() => {
    if (!selectedRow) return null;
    const k = selectedRow.name.trim().toLowerCase();
    return limits.find(l => l.name.trim().toLowerCase() === k) ?? null;
  }, [selectedRow, limits]);

  useEffect(() => {
    setNotesDraft(limitForCurrent?.notes ?? '');
    setNotesSaved(true);
  }, [limitForCurrent?.id, limitForCurrent?.notes]);

  function saveNotes() {
    if (!selectedRow) return;
    if (notesDraft === (limitForCurrent?.notes ?? '')) {
      setNotesSaved(true);
      return;
    }
    setNotes.mutate(
      {
        name: selectedRow.name,
        phone: selectedRow.phone,
        notes: notesDraft,
      },
      {
        onSuccess: () => { setNotesSaved(true); toast(t('toast.saved')); },
        onError: () => toast(t('toast.error'), 'error'),
      },
    );
  }

  function sendWhatsApp() {
    if (!detail?.customer) return;
    const text = detail.customer.debt > 0
      ? buildReminderText({
          customerName: detail.customer.name,
          amount: detail.customer.debt,
          lang,
        })
      : '';
    const url = waMeUrl(detail.customer.phone, text);
    if (!url) {
      toast(t('debts.noPhone'), 'error');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function callPhone() {
    if (!detail?.customer) return;
    const num = normalizePhone(detail.customer.phone);
    if (!num) {
      toast(t('debts.noPhone'), 'error');
      return;
    }
    window.location.href = `tel:+${num}`;
  }

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader
            title={t('nav.customers')}
            onMenu={openMenu}
            description={detail ? detail.customer.name : undefined}
          />

          {rows.length === 0 ? (
            <EmptyState
              icon={UserIcon}
              title={t('empty.sales.title')}
              description={t('empty.sales.desc')}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* List — hidden on mobile when a detail is selected, so the
                  detail can use the full screen. Desktop shows both. */}
              <div className={cn('lg:col-span-5', detail && 'hidden lg:block')}>
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
                    {filtered.map(c => {
                      const slug = customerSlug(c.name);
                      const active = params.slug === slug;
                      return (
                        <li
                          key={c.name + c.phone}
                          onClick={() => open(c.name)}
                          className={cn(
                            'flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-border last:border-0 transition',
                            active ? 'bg-surface-2' : 'hover:bg-surface',
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
                      );
                    })}
                  </ul>
                </div>
              </div>

              {/* Detail */}
              <div className={cn('lg:col-span-7', !detail && 'hidden lg:block')}>
                {detail?.customer ? (
                  <div className="space-y-4">
                    {/* mobile back button */}
                    <button
                      onClick={() => navigate('/customers')}
                      className="lg:hidden inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg transition"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t('common.back')}
                    </button>

                    <div className="card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-fg-muted mb-1 uppercase tracking-wider">{t('common.customer')}</div>
                          <div className="text-xl font-semibold">{detail.customer.name}</div>
                          <div className="font-mono text-xs text-fg-muted mt-0.5">{detail.customer.phone || '—'}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {detail.customer.phone && (
                            <>
                              <button
                                onClick={callPhone}
                                className="btn-secondary !p-2"
                                title={t('cust.call')}
                              >
                                <Phone className="w-4 h-4" />
                              </button>
                              <button
                                onClick={sendWhatsApp}
                                className="btn-primary !p-2"
                                title={t('cust.whatsapp')}
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                        <div className="bg-surface border border-border rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-fg-muted">{t('sales.colTotal')}</div>
                          <div className="text-base font-semibold tnum mt-0.5">{formatUZS(detail.customer.totalSpent)}</div>
                        </div>
                        <div className="bg-surface border border-border rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-fg-muted flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {t('cust.lifetimeMargin')}
                          </div>
                          <div className={cn(
                            'text-base font-semibold tnum mt-0.5',
                            detail.customer.totalMargin >= 0 ? 'text-positive' : 'text-negative',
                          )}>
                            {formatUZS(detail.customer.totalMargin)}
                          </div>
                        </div>
                        <div className="bg-surface border border-border rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-fg-muted">{t('debts.colAmount')}</div>
                          <div className={cn(
                            'text-base font-semibold tnum mt-0.5',
                            detail.customer.debt > 0 ? 'text-negative' : 'text-fg',
                          )}>
                            {formatUZS(detail.customer.debt)}
                          </div>
                        </div>
                        <div className="bg-surface border border-border rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-fg-muted">{t('cust.lastSeen')}</div>
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
                              <span className="text-fg-muted">{t('cust.creditLimit')}:</span>
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

                    {/* Notes — free-form, auto-saves on blur */}
                    <div className="card p-5">
                      <div className="flex items-baseline justify-between mb-2">
                        <div className="text-xs font-medium uppercase tracking-wider text-fg-muted">
                          {t('cust.notesTitle')}
                        </div>
                        <span className={cn(
                          'text-[10px] tnum',
                          notesSaved ? 'text-fg-subtle' : 'text-amber-600 dark:text-amber-400',
                        )}>
                          {setNotes.isPending
                            ? t('cust.notesSaving')
                            : notesSaved
                              ? t('cust.notesSaved')
                              : t('cust.notesUnsaved')}
                        </span>
                      </div>
                      <textarea
                        className="input min-h-[88px] resize-y"
                        placeholder={t('cust.notesPlaceholder')}
                        value={notesDraft}
                        onChange={e => {
                          setNotesDraft(e.target.value);
                          setNotesSaved(false);
                        }}
                        onBlur={saveNotes}
                      />
                    </div>

                    <div className="card overflow-hidden">
                      <div className="px-4 py-3 border-b border-border text-xs font-medium uppercase tracking-wider text-fg-muted">
                        {t('nav.sales')}  ·  {detail.sales.length}
                      </div>
                      {detail.sales.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-fg-subtle">{t('common.empty')}</div>
                      ) : (
                        <ul>
                          {detail.sales.map(s => {
                            const margin = saleMargin(s, productsById);
                            return (
                              <li key={s.id} className="px-4 py-2.5 border-b border-border last:border-0 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm truncate">{s.items.map(i => `${i.productName} ×${i.quantity}`).join(', ')}</div>
                                  <div className="text-xs text-fg-muted tnum">{fmtDate(s.date)} · {t(`payment.${s.paymentType}` as const)}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-sm font-semibold tnum">{formatUZS(s.total)}</div>
                                  {margin !== 0 && (
                                    <div className={cn(
                                      'text-[11px] tnum',
                                      margin >= 0 ? 'text-positive' : 'text-negative',
                                    )}>
                                      {margin >= 0 ? '+' : ''}{formatUZS(margin)}
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {detail.debts.length > 0 && (
                      <div className="card overflow-hidden">
                        <div className="px-4 py-3 border-b border-border text-xs font-medium uppercase tracking-wider text-fg-muted">
                          {t('nav.debts')}  ·  {detail.debts.length}
                        </div>
                        <ul>
                          {detail.debts.map(d => (
                            <li key={d.id} className="px-4 py-2.5 border-b border-border last:border-0 flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm truncate">{d.product}</div>
                                <div className="text-xs text-fg-muted tnum">
                                  {fmtDate(d.date)}
                                  {d.dueDate ? ` · ${t('debts.dueDate')}: ${fmtDate(d.dueDate)}` : ''}
                                </div>
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
                    {t('cust.pickHint')}
                  </div>
                )}
              </div>
            </div>
          )}

          <Modal
            open={limitModalOpen}
            onClose={() => setLimitModalOpen(false)}
            title={t('cust.creditLimit')}
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
            <Field label={`${t('cust.maxDebt')} (UZS)`}>
              <MoneyInput
                value={limitInput}
                onChange={setLimitInput}
                placeholder="0"
                autoFocus
              />
            </Field>
          </Modal>
        </>
      )}
    </Layout>
  );
}

// Backward-compatible re-export: anyone still importing from this module
// gets routed to the dedicated util.
export const customerProfilePath = _customerProfilePath;
