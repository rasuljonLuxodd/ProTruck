import { useMemo, useState } from 'react';
import { Plus, Trash2, Search, ShoppingCart } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { useSales, useAddSale, useDeleteSale } from '@/hooks/useSales';
import { useProducts, useUpdateProduct } from '@/hooks/useProducts';
import { useAddDebt } from '@/hooks/useDebts';
import { useAddActionLog } from '@/hooks/useActionLogs';
import { formatUZS, formatDate } from '@/lib/format';
import { actualCashIncome, inMonth } from '@/lib/calc';
import { cn } from '@/lib/utils';
import type { CartItem, PaymentType } from '@/types';

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
  const addSale = useAddSale();
  const deleteSale = useDeleteSale();
  const updateProduct = useUpdateProduct();
  const addDebt = useAddDebt();
  const addAction = useAddActionLog();

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

  function resetForm() {
    setCustomerName(''); setCustomerPhone(''); setCart([]);
    setPickProductId(''); setPickQty(1); setPickPrice(0);
    setPaymentType('naqd'); setCashPart(0); setDebtPart(0); setNote('');
  }

  function addCartItem() {
    const product = products.find(p => p.id === pickProductId);
    if (!product || pickQty <= 0 || pickPrice <= 0) return;
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
    const total = cartTotal;
    const sale = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      items: cart,
      total,
      paymentType,
      cashPart: paymentType === 'aralash' ? cashPart : undefined,
      debtPart: paymentType === 'aralash' ? debtPart : paymentType === 'qarz' ? total : undefined,
      note: note.trim() || undefined,
      date,
    };

    addSale.mutate(sale, {
      onSuccess: async created => {
        for (const item of cart) {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            updateProduct.mutate({
              id: product.id,
              patch: { stock: Math.max(0, product.stock - item.quantity) },
            });
          }
        }
        const debtAmount =
          paymentType === 'qarz' ? total : paymentType === 'aralash' ? debtPart : 0;
        if (debtAmount > 0) {
          addDebt.mutate({
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            product: cart.map(i => `${i.productName} ×${i.quantity}`).join(', '),
            amount: debtAmount,
            originalAmount: debtAmount,
            saleId: created.id,
            date,
            note: note.trim() || undefined,
          });
        }
        addAction.mutate({
          type: 'sale',
          description: `${customerName.trim()} — ${formatUZS(total)}`,
          date,
        });
        toast(t('toast.saved'));
        resetForm();
        setOpen(false);
      },
      onError: () => toast(t('toast.error'), 'error'),
    });
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
          <PageHeader title={t('nav.sales')} onMenu={openMenu} onAdd={() => setOpen(true)} />

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
                          <td className="text-right">
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

          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title={t('sales.title')}
            size="lg"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
                <button className="btn-primary" onClick={handleSave}>{t('common.save')}</button>
              </>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('sales.customerName')}>
                <input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} />
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
        </>
      )}
    </Layout>
  );
}
