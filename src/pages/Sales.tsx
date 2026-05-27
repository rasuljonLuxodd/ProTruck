import { useMemo, useState } from 'react';
import { Plus, Trash2, Search, ShoppingCart, FileDown, Download, Undo2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Select } from '@/components/ui/Select';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { useSales, useDeleteSale, useExecuteSale, useRefundSale } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { useDebts } from '@/hooks/useDebts';
import { useCreditLimits } from '@/hooks/useCreditLimits';
import { formatUZS, formatDate } from '@/lib/format';
import { useFormatDate } from '@/lib/useFormatters';
import { actualCashIncome, inMonth, outstandingDebt, dailySeries, totalMargin } from '@/lib/calc';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { salePdf } from '@/lib/pdfCheque';
import { customerProfilePath } from '@/pages/Customers';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { CartItem, PaymentType, Sale } from '@/types';

const PAYMENT_TYPES: PaymentType[] = ['naqd', 'karta', 'qarz', 'aralash'];

const statusTone = {
  naqd: 'positive',
  karta: 'positive',
  qarz: 'negative',
  aralash: 'warning',
} as const;

export default function Sales() {
  const t = useT();
  const fmtDate = useFormatDate();
  const { toast } = useToast();
  const { data: sales = [] } = useSales();
  const { data: products = [] } = useProducts();
  const { data: debts = [] } = useDebts();
  const { data: limits = [] } = useCreditLimits();
  const executeSale = useExecuteSale();
  const deleteSale = useDeleteSale();
  const refundSale = useRefundSale();
  const [confirmRefund, setConfirmRefund] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState<PaymentType | 'all'>('all');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickProductId, setPickProductId] = useState('');
  const [pickQty, setPickQty] = useState(1);
  const [pickPrice, setPickPrice] = useState(0);
  const [paymentType, setPaymentType] = useState<PaymentType>('naqd');
  const [cashPart, setCashPart] = useState(0);
  const [debtPart, setDebtPart] = useState(0);
  const [note, setNote] = useState('');

  const now = new Date();
  const monthSales = useMemo(
    () => sales.filter(s => inMonth(s.date, now.getFullYear(), now.getMonth())),
    [sales, now],
  );
  const monthTotal = monthSales.reduce((a, s) => a + s.total, 0);
  const actualIncome = actualCashIncome(monthSales);
  // Outstanding debt = current balance from the debts table (which gets
  // decremented as payments come in). Summing s.debtPart from sales would
  // double-count anything already paid off.
  const customerDebt = useMemo(() => outstandingDebt(debts), [debts]);

  // Index products by id once so margin calc isn't O(n²)
  const productsById = useMemo(() => {
    const m = new Map<string, { cost: number }>();
    for (const p of products) m.set(p.id, { cost: p.cost });
    return m;
  }, [products]);

  // Monthly gross margin (this is the real profit indicator)
  const monthMargin = useMemo(
    () => totalMargin(monthSales, productsById),
    [monthSales, productsById],
  );

  // 14-day sparkline series for the stat cards
  const dailyRevenue = useMemo(
    () => dailySeries(sales, s => s.date, s => s.total),
    [sales],
  );
  const dailyCash = useMemo(
    () => dailySeries(
      sales,
      s => s.date,
      s => {
        if (s.paymentType === 'naqd' || s.paymentType === 'karta') return s.total;
        if (s.paymentType === 'aralash') return s.cashPart ?? 0;
        return 0;
      },
    ),
    [sales],
  );

  const filtered = useMemo(() => {
    return sales
      .filter(s => (filterPayment === 'all' ? true : s.paymentType === filterPayment))
      .filter(s => s.customerName.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, filterPayment, search]);

  const cartTotal = cart.reduce((a, i) => a + i.quantity * i.price, 0);

  // Soft credit-limit check. Sum existing debt for this customer + the
  // debt this sale would add; compare against any saved limit.
  const creditWarning = useMemo(() => {
    if (!customerName.trim()) return null;
    if (paymentType !== 'qarz' && paymentType !== 'aralash') return null;
    const key = customerName.trim().toLowerCase();
    const limit = limits.find(l => l.name.trim().toLowerCase() === key);
    if (!limit) return null;
    const existingDebt = debts
      .filter(d => d.customerName.trim().toLowerCase() === key)
      .reduce((a, d) => a + d.amount, 0);
    const addedDebt = paymentType === 'qarz' ? cartTotal : debtPart;
    const projected = existingDebt + addedDebt;
    if (projected > limit.maxDebt) {
      return { existing: existingDebt, added: addedDebt, limit: limit.maxDebt };
    }
    return null;
  }, [customerName, paymentType, limits, debts, cartTotal, debtPart]);

  // Distinct customers (most-recent first) for the autocomplete datalist.
  const customerSuggestions = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; date: string }>();
    for (const s of sales) {
      const key = s.customerName.trim().toLowerCase();
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || new Date(s.date) > new Date(prev.date)) {
        map.set(key, { name: s.customerName, phone: s.customerPhone, date: s.date });
      }
    }
    return [...map.values()];
  }, [sales]);

  // When the cashier picks a customer name we know, prefill the phone.
  function onCustomerNameChange(next: string) {
    setCustomerName(next);
    const match = customerSuggestions.find(
      c => c.name.trim().toLowerCase() === next.trim().toLowerCase(),
    );
    if (match && match.phone && !customerPhone.trim()) {
      setCustomerPhone(match.phone);
    }
  }

  function resetForm() {
    setCustomerName(''); setCustomerPhone(''); setCart([]);
    setPickProductId(''); setPickQty(1); setPickPrice(0);
    setPaymentType('naqd'); setCashPart(0); setDebtPart(0); setNote('');
  }

  function addCartItem() {
    const product = products.find(p => p.id === pickProductId);
    if (!product || pickQty <= 0 || pickPrice <= 0) return;
    // Prevent overselling: if adding this row would exceed stock, reject.
    const alreadyInCart = cart
      .filter(c => c.productId === product.id)
      .reduce((a, c) => a + c.quantity, 0);
    if (alreadyInCart + pickQty > product.stock) {
      toast(t('sales.insufficientStock'), 'error');
      return;
    }
    setCart(prev => [
      ...prev,
      { productId: product.id, productName: product.name, quantity: pickQty, price: pickPrice },
    ]);
    setPickProductId(''); setPickQty(1); setPickPrice(0);
  }

  function removeCartItem(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!customerName.trim()) {
      toast(t('sales.customerName') + ': ' + t('form.required'), 'error');
      return;
    }
    if (cart.length === 0) {
      toast(t('sales.cartEmpty'), 'error');
      return;
    }
    const date = new Date().toISOString();

    executeSale.mutate(
      {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: cart,
        paymentType,
        cashPart: paymentType === 'aralash' ? cashPart : undefined,
        debtPart: paymentType === 'aralash' ? debtPart : undefined,
        note: note.trim() || undefined,
        date,
      },
      {
        onSuccess: () => {
          toast(t('toast.saved'));
          resetForm();
          setOpen(false);
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error && err.message === 'insufficient_stock'
            ? t('sales.insufficientStock')
            : t('toast.error');
          toast(msg, 'error');
        },
      },
    );
  }

  function handleDelete() {
    if (!confirmDel) return;
    deleteSale.mutate(confirmDel, {
      onSuccess: () => { toast(t('toast.deleted')); setConfirmDel(null); },
    });
  }

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader
            title={t('nav.sales')}
            onMenu={openMenu}
            onAdd={() => setOpen(true)}
            rightSlot={
              filtered.length > 0 && (
                <button
                  className="btn-secondary"
                  title={t('common.export')}
                  onClick={() => {
                    const csv = buildCsv(filtered, [
                      { key: 'date',          header: t('common.date'),          render: r => formatDate(r.date) },
                      { key: 'customerName',  header: t('common.customer') },
                      { key: 'customerPhone', header: t('common.phone') },
                      { key: 'items',         header: t('sales.colProducts'),    render: r => r.items.map(i => `${i.productName} x${i.quantity}`).join('; ') },
                      { key: 'total',         header: t('sales.colTotal'),       render: r => String(r.total) },
                      { key: 'paymentType',   header: t('common.paymentType'),   render: r => t(`payment.${r.paymentType}` as const) },
                      { key: 'note',          header: t('common.note'),          render: r => r.note ?? '' },
                    ]);
                    downloadCsv(`sales-${new Date().toISOString().slice(0, 10)}.csv`, csv);
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('common.export')}</span>
                </button>
              )
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            <StatCard
              title={t('sales.monthlyTotal')}
              value={formatUZS(monthTotal)}
              icon={ShoppingCart}
              series={dailyRevenue}
            />
            <StatCard
              title={t('sales.actualIncome')}
              value={formatUZS(actualIncome)}
              tone="positive"
              series={dailyCash}
            />
            <StatCard
              title={t('sales.grossMargin')}
              value={formatUZS(monthMargin)}
              tone={monthMargin >= 0 ? 'positive' : 'negative'}
            />
            <StatCard
              title={t('sales.customerDebt')}
              value={formatUZS(customerDebt)}
              tone="negative"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
              <input
                className="input pl-9"
                placeholder={t('sales.searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select
              className="sm:w-52"
              value={filterPayment}
              onChange={setFilterPayment}
              options={[
                { value: 'all' as const, label: t('common.all') },
                ...PAYMENT_TYPES.map(p => ({ value: p, label: t(`payment.${p}` as const) })),
              ]}
            />
          </div>

          {sales.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title={t('empty.sales.title')}
              description={t('empty.sales.desc')}
              actionLabel={t('sales.title')}
              onAction={() => setOpen(true)}
            />
          ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('common.customer')}</th>
                    <th>{t('sales.colProducts')}</th>
                    <th className="text-right">{t('common.quantity')}</th>
                    <th className="text-right">{t('sales.colTotal')}</th>
                    <th>{t('sales.colStatus')}</th>
                    <th>{t('common.date')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-fg-subtle py-10">{t('common.empty')}</td></tr>
                  ) : (
                    filtered.map(s => {
                      const totalQty = s.items.reduce((a, i) => a + i.quantity, 0);
                      return (
                        <tr key={s.id}>
                          <td>
                            <Link
                              to={customerProfilePath(s.customerName)}
                              className="font-medium hover:underline"
                            >
                              {s.customerName}
                            </Link>
                            <div className="font-mono text-[11px] text-fg-muted">{s.customerPhone}</div>
                          </td>
                          <td className="max-w-[240px]">
                            <div className="truncate">{s.items.map(i => i.productName).join(', ')}</div>
                          </td>
                          <td className="text-right font-mono">{totalQty}</td>
                          <td className="text-right font-semibold">{formatUZS(s.total)}</td>
                          <td>
                            <Badge tone={statusTone[s.paymentType]}>{t(`payment.${s.paymentType}` as const)}</Badge>
                          </td>
                          <td className="font-mono text-xs text-fg-muted">{fmtDate(s.date)}</td>
                          <td className="text-right whitespace-nowrap">
                            <button
                              className="btn-ghost !py-1.5"
                              onClick={() => salePdf(s)}
                              title={t('common.downloadPdf')}
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="btn-ghost !py-1.5"
                              onClick={() => setConfirmRefund(s.id)}
                              title={t('sales.refund')}
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                            <button className="btn-ghost !py-1.5 text-negative" onClick={() => setConfirmDel(s.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}

          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title={t('sales.title')}
            size="lg"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setOpen(false)} disabled={executeSale.isPending}>
                  {t('common.cancel')}
                </button>
                <button className="btn-primary" onClick={handleSave} disabled={executeSale.isPending}>
                  {executeSale.isPending ? '…' : t('common.save')}
                </button>
              </>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('sales.customerName')}>
                <input
                  className="input"
                  value={customerName}
                  onChange={e => onCustomerNameChange(e.target.value)}
                  list="customer-suggestions"
                  autoComplete="off"
                />
                <datalist id="customer-suggestions">
                  {customerSuggestions.map(c => (
                    <option key={c.name + c.phone} value={c.name}>
                      {c.phone}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label={t('sales.customerPhone')}>
                <input className="input" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <Field label={t('common.product')}>
                  <Select
                    value={pickProductId}
                    onChange={(id) => {
                      setPickProductId(id);
                      // Auto-fill the price if the product has a default —
                      // saves typing for catalog items, doesn't get in the
                      // way for negotiated sales (price is still editable).
                      const p = products.find(x => x.id === id);
                      if (p?.defaultPrice && pickPrice === 0) {
                        setPickPrice(p.defaultPrice);
                      }
                    }}
                    placeholder={t('sales.selectProduct')}
                    options={products.map(p => ({
                      value: p.id,
                      label: p.name,
                      hint: String(p.stock),
                    }))}
                  />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label={t('common.quantity')}>
                  <MoneyInput value={pickQty} onChange={setPickQty} min={1} placeholder="1" />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label={t('common.price')}>
                  <MoneyInput value={pickPrice} onChange={setPickPrice} placeholder="0" />
                </Field>
              </div>
              <div className="col-span-1">
                <button className="btn-primary w-full !px-0 !py-2" onClick={addCartItem} title={t('sales.addToCart')}>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="card overflow-hidden !rounded-lg">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('common.product')}</th>
                    <th className="text-right">{t('common.quantity')}</th>
                    <th className="text-right">{t('common.price')}</th>
                    <th className="text-right">{t('common.total')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-fg-subtle py-5">{t('sales.cartEmpty')}</td></tr>
                  ) : (
                    cart.map((i, idx) => (
                      <tr key={idx}>
                        <td>{i.productName}</td>
                        <td className="text-right font-mono">{i.quantity}</td>
                        <td className="text-right font-mono">{formatUZS(i.price)}</td>
                        <td className="text-right font-semibold">{formatUZS(i.quantity * i.price)}</td>
                        <td className="text-right">
                          <button className="text-negative hover:opacity-70" onClick={() => removeCartItem(idx)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-fg-muted">{t('sales.runningTotal')}</span>
              <span className="text-2xl font-semibold tnum">{formatUZS(cartTotal)}</span>
            </div>

            {creditWarning && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs rounded-lg px-3 py-2 tnum">
                ⚠ {formatUZS(creditWarning.existing)} + {formatUZS(creditWarning.added)} = {formatUZS(creditWarning.existing + creditWarning.added)}
                {' '}— credit limit {formatUZS(creditWarning.limit)}
              </div>
            )}

            <Field label={t('common.paymentType')}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PAYMENT_TYPES.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPaymentType(p)}
                    className={cn(
                      'py-2 px-2 rounded-lg border text-sm font-medium transition',
                      paymentType === p
                        ? 'bg-fg text-bg border-fg'
                        : 'bg-bg border-border text-fg-muted hover:text-fg hover:bg-surface',
                    )}
                  >
                    {t(`payment.${p}` as const)}
                  </button>
                ))}
              </div>
            </Field>

            {paymentType === 'aralash' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('sales.cashPart')}>
                  <MoneyInput value={cashPart} onChange={setCashPart} placeholder="0" />
                </Field>
                <Field label={t('sales.debtPart')}>
                  <MoneyInput value={debtPart} onChange={setDebtPart} placeholder="0" />
                </Field>
              </div>
            )}

            <Field label={t('common.note')}>
              <textarea className="input" value={note} onChange={e => setNote(e.target.value)} />
            </Field>
          </Modal>

          <ConfirmDialog
            open={!!confirmDel}
            onConfirm={handleDelete}
            onCancel={() => setConfirmDel(null)}
          />

          <ConfirmDialog
            open={!!confirmRefund}
            title="Refund this sale?"
            message="Stock will be restored and any linked debt removed."
            onConfirm={() => {
              if (!confirmRefund) return;
              refundSale.mutate(confirmRefund, {
                onSuccess: () => { toast(t('toast.saved')); setConfirmRefund(null); },
                onError: () => toast(t('toast.error'), 'error'),
              });
            }}
            onCancel={() => setConfirmRefund(null)}
          />
        </>
      )}
    </Layout>
  );
}
