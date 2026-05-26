import { useMemo, useState } from 'react';
import { Plus, Trash2, Search, ShoppingCart, Printer, Download } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PrintableSlip } from '@/components/ui/PrintableSlip';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { useSales, useDeleteSale, useExecuteSale } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useProducts';
import { formatUZS, formatDate } from '@/lib/format';
import { actualCashIncome, inMonth } from '@/lib/calc';
import { buildCsv, downloadCsv } from '@/lib/csv';
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
  const { toast } = useToast();
  const { data: sales = [] } = useSales();
  const { data: products = [] } = useProducts();
  const executeSale = useExecuteSale();
  const deleteSale = useDeleteSale();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState<PaymentType | 'all'>('all');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);

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
  const customerDebt = useMemo(() => {
    return sales.reduce((acc, s) => {
      if (s.paymentType === 'qarz') return acc + s.total;
      if (s.paymentType === 'aralash') return acc + (s.debtPart || 0);
      return acc;
    }, 0);
  }, [sales]);

  const filtered = useMemo(() => {
    return sales
      .filter(s => (filterPayment === 'all' ? true : s.paymentType === filterPayment))
      .filter(s => s.customerName.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, filterPayment, search]);

  const cartTotal = cart.reduce((a, i) => a + i.quantity * i.price, 0);

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
    if (!customerName.trim() || cart.length === 0) return;
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
                  {t('common.export')}
                </button>
              )
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatCard title={t('sales.monthlyTotal')} value={formatUZS(monthTotal)} icon={ShoppingCart} />
            <StatCard title={t('sales.actualIncome')} value={formatUZS(actualIncome)} tone="positive" />
            <StatCard title={t('sales.customerDebt')} value={formatUZS(customerDebt)} tone="negative" />
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
            <select
              className="input sm:w-48"
              value={filterPayment}
              onChange={e => setFilterPayment(e.target.value as PaymentType | 'all')}
            >
              <option value="all">{t('common.all')}</option>
              {PAYMENT_TYPES.map(p => (
                <option key={p} value={p}>{t(`payment.${p}` as const)}</option>
              ))}
            </select>
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
                            <div className="font-medium">{s.customerName}</div>
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
                          <td className="font-mono text-xs text-fg-muted">{formatDate(s.date)}</td>
                          <td className="text-right whitespace-nowrap">
                            <button className="btn-ghost !py-1.5" onClick={() => setReceipt(s)} title="Print receipt">
                              <Printer className="w-3.5 h-3.5" />
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
                  <select className="input" value={pickProductId} onChange={e => setPickProductId(e.target.value)}>
                    <option value="">{t('sales.selectProduct')}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.stock})</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="col-span-3">
                <Field label={t('common.quantity')}>
                  <input className="input" type="number" min={1} value={pickQty} onChange={e => setPickQty(Number(e.target.value))} />
                </Field>
              </div>
              <div className="col-span-3">
                <Field label={t('common.price')}>
                  <input className="input" type="number" min={0} value={pickPrice} onChange={e => setPickPrice(Number(e.target.value))} />
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
                  <input className="input" type="number" min={0} value={cashPart} onChange={e => setCashPart(Number(e.target.value))} />
                </Field>
                <Field label={t('sales.debtPart')}>
                  <input className="input" type="number" min={0} value={debtPart} onChange={e => setDebtPart(Number(e.target.value))} />
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

          <PrintableSlip
            open={!!receipt}
            onClose={() => setReceipt(null)}
            title="Sale receipt"
          >
            {receipt && (
              <div>
                <div className="text-center mb-4">
                  <div className="font-sans text-base font-bold">ProTrack</div>
                  <div className="text-xs">{formatDate(receipt.date)}</div>
                </div>
                <div className="border-t border-b border-dashed border-fg py-2 mb-3">
                  <div className="flex justify-between text-xs">
                    <span>{t('common.customer')}</span>
                    <span className="font-semibold">{receipt.customerName}</span>
                  </div>
                  {receipt.customerPhone && (
                    <div className="flex justify-between text-xs">
                      <span>{t('common.phone')}</span>
                      <span>{receipt.customerPhone}</span>
                    </div>
                  )}
                </div>
                <table className="w-full text-xs mb-3">
                  <thead>
                    <tr>
                      <th className="text-left pb-1">{t('common.product')}</th>
                      <th className="text-right pb-1">×</th>
                      <th className="text-right pb-1">{t('common.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.items.map((i, idx) => (
                      <tr key={idx}>
                        <td className="py-0.5">{i.productName}</td>
                        <td className="text-right">{i.quantity}</td>
                        <td className="text-right">{formatUZS(i.quantity * i.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-fg pt-2 space-y-1 text-xs">
                  <div className="flex justify-between font-bold">
                    <span>{t('common.total')}</span>
                    <span>{formatUZS(receipt.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('common.paymentType')}</span>
                    <span>{t(`payment.${receipt.paymentType}` as const)}</span>
                  </div>
                  {receipt.paymentType === 'aralash' && (
                    <>
                      <div className="flex justify-between">
                        <span>{t('sales.cashPart')}</span>
                        <span>{formatUZS(receipt.cashPart ?? 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t('sales.debtPart')}</span>
                        <span>{formatUZS(receipt.debtPart ?? 0)}</span>
                      </div>
                    </>
                  )}
                  {receipt.paymentType === 'qarz' && (
                    <div className="flex justify-between text-negative font-semibold">
                      <span>{t('debts.colAmount')}</span>
                      <span>{formatUZS(receipt.total)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-6 text-center text-[10px]">{t('common.thanks')}</div>
              </div>
            )}
          </PrintableSlip>
        </>
      )}
    </Layout>
  );
}
