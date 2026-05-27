import { useMemo, useState } from 'react';
import { Plus, Truck, Trash2, Check } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { useFormatDate } from '@/lib/useFormatters';
import { usePurchaseOrders, useCreatePurchaseOrder, useUpdatePoStatus, useReceivePoItems } from '@/hooks/usePurchaseOrders';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { formatUZS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

const statusTone: Record<PurchaseOrderStatus, 'mute' | 'fg' | 'warning' | 'positive' | 'negative'> = {
  draft:     'mute',
  ordered:   'fg',
  partial:   'warning',
  received:  'positive',
  cancelled: 'negative',
};

/**
 * Purchase Orders page. Lifecycle:
 *
 *   draft → ordered → (partial) → received
 *
 * "Receive" can be partial — the receive modal lets the user enter how
 * much actually arrived for each line. The RPC handles atomic stock
 * updates and rolling the PO status forward.
 */
export default function Purchases() {
  const t = useT();
  const { toast } = useToast();
  const fmtDate = useFormatDate();
  const { data: orders = [], isLoading } = usePurchaseOrders();
  const { data: suppliers = [] } = useSuppliers();
  const { data: products = [] } = useProducts();
  const create = useCreatePurchaseOrder();
  const updStatus = useUpdatePoStatus();
  const receive = useReceivePoItems();

  // new-PO form
  const [newOpen, setNewOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Array<{ productId: string; qty: number; unitCost: number }>>([
    { productId: '', qty: 0, unitCost: 0 },
  ]);

  // receive modal
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);
  const [receiveQty, setReceiveQty] = useState<Map<string, number>>(new Map());

  function resetNew() {
    setSupplierId(''); setExpectedAt(''); setNote('');
    setRows([{ productId: '', qty: 0, unitCost: 0 }]);
  }

  function saveNew() {
    const items = rows
      .filter(r => r.productId && r.qty > 0)
      .map(r => ({ productId: r.productId, orderedQty: r.qty, unitCost: r.unitCost }));
    if (items.length === 0) {
      toast(t('po.atLeastOneItem'), 'error');
      return;
    }
    create.mutate(
      {
        supplierId: supplierId || undefined,
        expectedAt: expectedAt || undefined,
        note: note.trim() || undefined,
        items,
      },
      {
        onSuccess: () => { toast(t('toast.saved')); setNewOpen(false); resetNew(); },
        onError: (err) => toast(err instanceof Error ? err.message : t('toast.error'), 'error'),
      },
    );
  }

  function openReceive(po: PurchaseOrder) {
    setReceivePo(po);
    // Default each receivable line to its outstanding quantity
    const initial = new Map<string, number>();
    for (const it of po.items) {
      const remaining = it.orderedQty - it.receivedQty;
      if (remaining > 0) initial.set(it.id, remaining);
    }
    setReceiveQty(initial);
  }

  function saveReceive() {
    if (!receivePo) return;
    const items = [...receiveQty.entries()].map(([poItemId, qty]) => ({ poItemId, qty }));
    if (items.every(i => i.qty <= 0)) {
      toast(t('po.enterReceived'), 'error');
      return;
    }
    receive.mutate(
      { poId: receivePo.id, items },
      {
        onSuccess: () => { toast(t('toast.saved')); setReceivePo(null); },
        onError: (err) => toast(err instanceof Error ? err.message : t('toast.error'), 'error'),
      },
    );
  }

  const totalForRow = (po: PurchaseOrder) =>
    po.items.reduce((s, i) => s + i.orderedQty * i.unitCost, 0);

  const supplierOptions = useMemo(
    () => [
      { value: '', label: t('po.noSupplier') },
      ...suppliers.map(s => ({ value: s.id, label: s.name })),
    ],
    [suppliers, t],
  );
  const productOptions = useMemo(
    () => products.map(p => ({ value: p.id, label: p.name, hint: String(p.stock) })),
    [products],
  );

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader
            title={t('nav.purchases')}
            onMenu={openMenu}
            onAdd={() => { resetNew(); setNewOpen(true); }}
          />

          {orders.length === 0 && !isLoading ? (
            <EmptyState
              icon={Truck}
              title={t('po.emptyTitle')}
              description={t('po.emptyDesc')}
              actionLabel={t('po.newCta')}
              onAction={() => { resetNew(); setNewOpen(true); }}
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('po.number')}</th>
                      <th>{t('po.supplier')}</th>
                      <th>{t('po.status')}</th>
                      <th className="text-right">{t('po.itemsCol')}</th>
                      <th className="text-right">{t('po.totalCol')}</th>
                      <th>{t('po.expected')}</th>
                      <th className="text-right">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(po => (
                      <tr key={po.id}>
                        <td className="font-mono text-sm">{po.number}</td>
                        <td>{po.supplierName ?? '—'}</td>
                        <td>
                          <Badge tone={statusTone[po.status]}>
                            {t(`po.status.${po.status}` as TranslationKey)}
                          </Badge>
                        </td>
                        <td className="text-right font-mono text-xs">
                          {po.items.reduce((s, i) => s + i.receivedQty, 0)} / {po.items.reduce((s, i) => s + i.orderedQty, 0)}
                        </td>
                        <td className="text-right font-semibold tnum">{formatUZS(totalForRow(po))}</td>
                        <td className="font-mono text-xs text-fg-muted whitespace-nowrap">
                          {po.expectedAt ? fmtDate(po.expectedAt) : '—'}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          {po.status === 'draft' && (
                            <button
                              className="btn-secondary !py-1.5 !text-xs"
                              onClick={() => updStatus.mutate({ id: po.id, status: 'ordered' })}
                            >
                              {t('po.markOrdered')}
                            </button>
                          )}
                          {(po.status === 'ordered' || po.status === 'partial') && (
                            <button
                              className="btn-primary !py-1.5 !text-xs"
                              onClick={() => openReceive(po)}
                            >
                              <Check className="w-3 h-3" />
                              {t('po.receive')}
                            </button>
                          )}
                          {po.status === 'draft' && (
                            <button
                              className="btn-ghost !py-1.5 text-negative"
                              onClick={() => updStatus.mutate({ id: po.id, status: 'cancelled' })}
                              title={t('po.cancel')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* New PO */}
          <Modal
            open={newOpen}
            onClose={() => { setNewOpen(false); resetNew(); }}
            title={t('po.newTitle')}
            size="lg"
            footer={
              <>
                <button className="btn-secondary" onClick={() => { setNewOpen(false); resetNew(); }} disabled={create.isPending}>
                  {t('common.cancel')}
                </button>
                <button className="btn-primary" onClick={saveNew} disabled={create.isPending}>
                  {create.isPending ? '…' : t('common.save')}
                </button>
              </>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('po.supplier')}>
                <Select value={supplierId} onChange={setSupplierId} options={supplierOptions} />
              </Field>
              <Field label={t('po.expected')}>
                <input
                  type="date"
                  className="input"
                  value={expectedAt}
                  onChange={e => setExpectedAt(e.target.value)}
                />
              </Field>
            </div>
            <Field label={t('common.note')}>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} />
            </Field>

            <div className="space-y-2">
              <div className="kicker">{t('po.lineItems')}</div>
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    <Select
                      value={row.productId}
                      onChange={(v) => setRows(r => r.map((x, j) => j === i ? { ...x, productId: v } : x))}
                      placeholder={t('po.pickProduct')}
                      options={productOptions}
                    />
                  </div>
                  <div className="col-span-2">
                    <MoneyInput
                      value={row.qty}
                      onChange={(v) => setRows(r => r.map((x, j) => j === i ? { ...x, qty: v } : x))}
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-3">
                    <MoneyInput
                      value={row.unitCost}
                      onChange={(v) => setRows(r => r.map((x, j) => j === i ? { ...x, unitCost: v } : x))}
                      placeholder={t('po.unitCost')}
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      className="btn-ghost !py-2 text-negative"
                      onClick={() => setRows(r => r.length > 1 ? r.filter((_, j) => j !== i) : r)}
                      disabled={rows.length === 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="btn-secondary !text-xs"
                onClick={() => setRows(r => [...r, { productId: '', qty: 0, unitCost: 0 }])}
              >
                <Plus className="w-3 h-3" />
                {t('po.addLine')}
              </button>
            </div>
          </Modal>

          {/* Receive modal */}
          <Modal
            open={!!receivePo}
            onClose={() => setReceivePo(null)}
            title={`${t('po.receive')} · ${receivePo?.number ?? ''}`}
            size="lg"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setReceivePo(null)} disabled={receive.isPending}>
                  {t('common.cancel')}
                </button>
                <button className="btn-primary" onClick={saveReceive} disabled={receive.isPending}>
                  {receive.isPending ? '…' : t('po.confirmReceive')}
                </button>
              </>
            }
          >
            {receivePo && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('common.product')}</th>
                    <th className="text-right">{t('po.ordered')}</th>
                    <th className="text-right">{t('po.alreadyReceived')}</th>
                    <th className="text-right w-32">{t('po.receivingNow')}</th>
                  </tr>
                </thead>
                <tbody>
                  {receivePo.items.map(item => {
                    const remaining = item.orderedQty - item.receivedQty;
                    return (
                      <tr key={item.id}>
                        <td className="font-medium">{item.productName ?? '—'}</td>
                        <td className="text-right font-mono">{item.orderedQty}</td>
                        <td className="text-right font-mono text-fg-muted">{item.receivedQty}</td>
                        <td className="text-right">
                          <MoneyInput
                            value={receiveQty.get(item.id) ?? 0}
                            onChange={(v) => {
                              const next = new Map(receiveQty);
                              const clamped = Math.min(v, remaining);
                              if (clamped <= 0) next.delete(item.id);
                              else next.set(item.id, clamped);
                              setReceiveQty(next);
                            }}
                            max={remaining}
                            placeholder="0"
                            className={cn('!py-1 !text-xs text-right', remaining === 0 && 'opacity-50')}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Modal>
        </>
      )}
    </Layout>
  );
}
