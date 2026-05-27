import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/data/supabaseClient';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  products: Product[];
}

/**
 * Stocktake workflow. The owner walks the warehouse with the tablet,
 * enters the actual count for each product, and the system writes the
 * variance + updates inventory atomically.
 *
 * Per-product state lives in a Map keyed by product id so partial-fill
 * works: only products with an entered value get an adjustment row.
 * No entered value = "not counted yet" = no change.
 */
export function StocktakeModal({ open, onClose, products }: Props) {
  const t = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => products
      .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [products, search],
  );

  // Roll up totals for the footer summary so the owner sees the impact
  // before committing.
  const counted = counts.size;
  const variances = useMemo(() => {
    let positive = 0;
    let negative = 0;
    let net = 0;
    for (const [id, after] of counts) {
      const p = products.find(x => x.id === id);
      if (!p) continue;
      const v = after - p.stock;
      if (v > 0) positive += v;
      if (v < 0) negative += v;
      net += v;
    }
    return { positive, negative, net };
  }, [counts, products]);

  function setCount(id: string, value: number | undefined) {
    setCounts(prev => {
      const next = new Map(prev);
      if (value === undefined) next.delete(id);
      else next.set(id, value);
      return next;
    });
  }

  async function save() {
    if (counts.size === 0) {
      toast(t('stocktake.nothingCounted'), 'error');
      return;
    }
    setSaving(true);
    const items = Array.from(counts.entries()).map(([product_id, after_qty]) => ({
      product_id,
      after_qty,
    }));
    const { error } = await supabase.rpc('apply_stocktake', { p_items: items });
    setSaving(false);
    if (error) {
      toast(t('toast.error'), 'error');
      return;
    }
    qc.invalidateQueries({ queryKey: ['products'] });
    toast(t('stocktake.applied').replace('{n}', String(counts.size)));
    setCounts(new Map());
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('stocktake.title')}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button className="btn-primary" onClick={save} disabled={saving || counts.size === 0}>
            <ClipboardCheck className="w-3.5 h-3.5" />
            {saving ? '…' : t('stocktake.save').replace('{n}', String(counts.size))}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-fg-muted leading-relaxed">
          {t('stocktake.intro')}
        </p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
          <input
            className="input pl-9"
            placeholder={t('stocktake.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-2">
          <SummaryTile label={t('stocktake.counted')} value={`${counted}/${products.length}`} />
          <SummaryTile
            label={t('stocktake.positive')}
            value={variances.positive > 0 ? `+${variances.positive}` : '0'}
            tone="positive"
          />
          <SummaryTile
            label={t('stocktake.negative')}
            value={variances.negative < 0 ? String(variances.negative) : '0'}
            tone="negative"
          />
        </div>

        {/* Product list */}
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.product')}</th>
                <th className="text-right">{t('stocktake.system')}</th>
                <th className="text-right w-32">{t('stocktake.actual')}</th>
                <th className="text-right w-24">{t('stocktake.variance')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-fg-subtle py-8">{t('common.empty')}</td></tr>
              ) : (
                filtered.map(p => {
                  const entered = counts.get(p.id);
                  const v = entered !== undefined ? entered - p.stock : null;
                  return (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-right font-mono text-fg-muted">{p.stock}</td>
                      <td className="text-right">
                        <MoneyInput
                          value={entered ?? 0}
                          onChange={(n) => setCount(p.id, n > 0 ? n : (entered !== undefined && n === 0 ? 0 : undefined))}
                          placeholder="—"
                          className="!py-1 !text-xs text-right"
                        />
                      </td>
                      <td className={cn(
                        'text-right font-mono tnum text-sm',
                        v === null && 'text-fg-subtle',
                        v !== null && v > 0 && 'text-positive',
                        v !== null && v < 0 && 'text-negative',
                      )}>
                        {v === null ? '—' : v > 0 ? `+${v}` : v}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

function SummaryTile({ label, value, tone }: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="kicker">{label}</div>
      <div className={cn(
        'text-lg font-semibold tnum mt-0.5',
        tone === 'positive' && 'text-positive',
        tone === 'negative' && 'text-negative',
      )}>{value}</div>
    </div>
  );
}
