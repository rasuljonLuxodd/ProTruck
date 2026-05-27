import { useMemo, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { useBomItems, useUpsertBomItem, useDeleteBomItem } from '@/hooks/useBomItems';
import { useUpdateProduct } from '@/hooks/useProducts';
import { formatUZS } from '@/lib/format';
import type { Product } from '@/types';

interface Props {
  product: Product | null;
  allProducts: Product[];
  onClose: () => void;
}

/**
 * Modal editor for a product's Bill of Materials.
 *
 * Shows the recipe rows + an inline "add row" form + a computed unit cost
 * derived from the BOM. A "Set as unit cost" button pushes that computed
 * value back to the product's `cost` column — convenient when the recipe
 * is the ground truth and the owner doesn't want to type it twice.
 */
export function BomEditor({ product, allProducts, onClose }: Props) {
  const t = useT();
  const { toast } = useToast();
  const { data: items = [] } = useBomItems(product?.id);
  const upsert = useUpsertBomItem();
  const del = useDeleteBomItem(product?.id ?? '');
  const updateProduct = useUpdateProduct();

  const [pickInputId, setPickInputId] = useState('');
  const [pickQty, setPickQty] = useState(0);

  const productsById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of allProducts) m.set(p.id, p);
    return m;
  }, [allProducts]);

  // Computed cost: sum(input.cost × qtyPerUnit). Anything with a missing
  // input or zero cost contributes 0 — we surface a hint when that happens.
  const computedCost = useMemo(() => {
    let total = 0;
    for (const it of items) {
      const raw = productsById.get(it.inputProductId);
      total += (raw?.cost ?? 0) * it.quantityPerUnit;
    }
    return total;
  }, [items, productsById]);

  // Inputs the user can pick — every product EXCEPT the current finished
  // one (a product cannot consume itself; the DB also enforces this).
  const inputOptions = useMemo(
    () =>
      allProducts
        .filter(p => p.id !== product?.id)
        .map(p => ({
          value: p.id,
          label: p.name,
          hint: p.cost > 0 ? formatUZS(p.cost) : t('prod.costWarning'),
        })),
    [allProducts, product, t],
  );

  if (!product) return null;

  function addRow() {
    if (!product) return;
    if (!pickInputId) {
      toast(t('bom.pickInputFirst'), 'error');
      return;
    }
    if (pickQty <= 0) {
      toast(t('form.amountRequired'), 'error');
      return;
    }
    upsert.mutate(
      { productId: product.id, inputProductId: pickInputId, quantityPerUnit: pickQty },
      {
        onSuccess: () => {
          toast(t('toast.saved'));
          setPickInputId('');
          setPickQty(0);
        },
        onError: (err) => toast(
          err instanceof Error ? err.message : t('toast.error'),
          'error',
        ),
      },
    );
  }

  function applyComputedCost() {
    if (!product) return;
    if (computedCost <= 0) {
      toast(t('bom.noComputedCost'), 'error');
      return;
    }
    updateProduct.mutate(
      { id: product.id, patch: { cost: computedCost } },
      {
        onSuccess: () => toast(t('toast.saved')),
        onError: () => toast(t('toast.error'), 'error'),
      },
    );
  }

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={`${t('bom.title')} · ${product.name}`}
      size="md"
      footer={
        <button className="btn-secondary" onClick={onClose}>
          {t('common.close')}
        </button>
      }
    >
      {/* existing rows */}
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <div className="text-sm text-fg-muted py-4 text-center">
            {t('bom.empty')}
          </div>
        ) : (
          items.map((it) => {
            const raw = productsById.get(it.inputProductId);
            const rowCost = (raw?.cost ?? 0) * it.quantityPerUnit;
            return (
              <div
                key={it.id}
                className="flex items-center gap-3 px-3 py-2 bg-surface border border-border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{raw?.name ?? '—'}</div>
                  <div className="text-xs text-fg-muted tnum">
                    {it.quantityPerUnit} × {raw?.cost ? formatUZS(raw.cost) : '—'} = {formatUZS(rowCost)}
                  </div>
                </div>
                <button
                  className="text-fg-subtle hover:text-negative transition"
                  onClick={() => del.mutate(it.id)}
                  aria-label="delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* computed cost summary */}
      {items.length > 0 && (
        <div className="mt-4 flex items-center justify-between px-3 py-2.5 rounded-lg gradient-ring">
          <div>
            <div className="text-xs text-fg-muted uppercase tracking-wider">
              {t('bom.computedCost')}
            </div>
            <div className="text-lg font-semibold tnum mt-0.5">
              {formatUZS(computedCost)}
            </div>
          </div>
          <button
            className="btn-secondary !text-xs !py-1.5"
            onClick={applyComputedCost}
            disabled={computedCost <= 0 || updateProduct.isPending}
          >
            {t('bom.applyAsCost')}
          </button>
        </div>
      )}

      {/* add row form */}
      <div className="mt-5 pt-4 border-t border-border space-y-3">
        <div className="text-xs font-medium uppercase tracking-wider text-fg-muted">
          {t('bom.addRowTitle')}
        </div>
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-7">
            <Field label={t('bom.input')}>
              <Select
                value={pickInputId}
                onChange={setPickInputId}
                placeholder={t('bom.pickInput')}
                options={inputOptions}
              />
            </Field>
          </div>
          <div className="col-span-4">
            <Field label={t('bom.qtyPerUnit')}>
              <MoneyInput value={pickQty} onChange={setPickQty} placeholder="0" />
            </Field>
          </div>
          <div className="col-span-1">
            <button
              className="btn-primary w-full !px-0 !py-2"
              onClick={addRow}
              disabled={upsert.isPending}
              aria-label={t('bom.addRow')}
              title={t('bom.addRow')}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
