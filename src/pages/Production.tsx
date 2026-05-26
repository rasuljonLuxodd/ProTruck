import { useMemo, useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { useProducts, useAddProduct, useDeleteProduct, useUpdateProduct } from '@/hooks/useProducts';
import { useProductionLogs, useAddProductionLog } from '@/hooks/useProductionLogs';
import { useAddActionLog } from '@/hooks/useActionLogs';
import { formatDate } from '@/lib/format';
import { productionThisMonth } from '@/lib/calc';

export default function Production() {
  const t = useT();
  const { toast } = useToast();
  const { data: products = [] } = useProducts();
  const { data: logs = [] } = useProductionLogs();
  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const addLog = useAddProductionLog();
  const addAction = useAddActionLog();

  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');
  const [initialStock, setInitialStock] = useState(0);
  const [minStock, setMinStock] = useState(10);

  const [dailyOpen, setDailyOpen] = useState<string | null>(null);
  const [dailyQty, setDailyQty] = useState(0);

  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const monthly = useMemo(() => productionThisMonth(logs), [logs]);
  const totalStock = useMemo(() => products.reduce((a, p) => a + p.stock, 0), [products]);
  const topProduct = useMemo(() => {
    if (products.length === 0) return '—';
    return [...products].sort((a, b) => b.stock - a.stock)[0].name;
  }, [products]);

  function handleSaveNew() {
    if (!name.trim()) return;
    addProduct.mutate(
      { name: name.trim(), stock: initialStock, minStock },
      {
        onSuccess: () => {
          toast(t('toast.saved'));
          setNewOpen(false);
          setName('');
          setInitialStock(0);
          setMinStock(10);
        },
        onError: () => toast(t('toast.error'), 'error'),
      },
    );
  }

  function handleAddDaily() {
    if (!dailyOpen || dailyQty <= 0) return;
    const product = products.find(p => p.id === dailyOpen);
    if (!product) return;
    addLog.mutate(
      { productId: product.id, quantity: dailyQty, date: new Date().toISOString() },
      {
        onSuccess: () => {
          updateProduct.mutate({ id: product.id, patch: { stock: product.stock + dailyQty } });
          addAction.mutate({
            type: 'production',
            description: `+${dailyQty} ${product.name}`,
            date: new Date().toISOString(),
          });
          toast(t('toast.saved'));
          setDailyOpen(null);
          setDailyQty(0);
        },
      },
    );
  }

  function handleDelete() {
    if (!confirmDel) return;
    deleteProduct.mutate(confirmDel, {
      onSuccess: () => { toast(t('toast.deleted')); setConfirmDel(null); },
    });
  }

  const dailyProduct = products.find(p => p.id === dailyOpen);

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader
            title={t('nav.production')}
            onMenu={openMenu}
            onAdd={() => setNewOpen(true)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatCard title={t('prod.monthly')} value={String(monthly)} icon={Package} />
            <StatCard title={t('prod.totalStock')} value={String(totalStock)} />
            <StatCard title={t('prod.topProduct')} value={topProduct} />
          </div>

          {products.length === 0 ? (
            <EmptyState
              icon={Package}
              title={t('empty.products.title')}
              description={t('empty.products.desc')}
              actionLabel={t('prod.newProduct')}
              onAction={() => setNewOpen(true)}
            />
          ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('prod.colName')}</th>
                    <th>{t('prod.colStock')}</th>
                    <th>{t('prod.colLast')}</th>
                    <th className="text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td>
                        <Badge
                          tone={
                            p.stock <= p.minStock ? 'negative'
                            : p.stock <= p.minStock * 2 ? 'warning'
                            : 'positive'
                          }
                        >
                          {p.stock}
                          {p.stock <= p.minStock ? ` · ${t('prod.lowStock')}` : ''}
                        </Badge>
                      </td>
                      <td className="text-fg-muted font-mono text-xs">{formatDate(p.lastUpdated)}</td>
                      <td className="text-right space-x-1 whitespace-nowrap">
                        <button
                          className="btn-secondary !py-1.5 !text-xs"
                          onClick={() => { setDailyOpen(p.id); setDailyQty(0); }}
                        >
                          <Plus className="w-3 h-3" />
                          {t('prod.dailyAdd')}
                        </button>
                        <button
                          className="btn-ghost !py-1.5 text-negative hover:text-negative"
                          onClick={() => setConfirmDel(p.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          <Modal
            open={newOpen}
            onClose={() => setNewOpen(false)}
            title={t('prod.newProduct')}
            size="sm"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setNewOpen(false)} disabled={addProduct.isPending}>
                  {t('common.cancel')}
                </button>
                <button className="btn-primary" onClick={handleSaveNew} disabled={addProduct.isPending}>
                  {addProduct.isPending ? '…' : t('common.save')}
                </button>
              </>
            }
          >
            <Field label={t('prod.productName')}>
              <input className="input" value={name} onChange={e => setName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('prod.initialStock')}>
                <input className="input" type="number" min={0} value={initialStock} onChange={e => setInitialStock(Number(e.target.value))} />
              </Field>
              <Field label={t('prod.minStock')}>
                <input className="input" type="number" min={0} value={minStock} onChange={e => setMinStock(Number(e.target.value))} />
              </Field>
            </div>
          </Modal>

          <Modal
            open={!!dailyOpen}
            onClose={() => setDailyOpen(null)}
            title={`${t('prod.addDaily')} — ${dailyProduct?.name ?? ''}`}
            size="sm"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setDailyOpen(null)} disabled={addLog.isPending}>
                  {t('common.cancel')}
                </button>
                <button className="btn-primary" onClick={handleAddDaily} disabled={addLog.isPending}>
                  {addLog.isPending ? '…' : t('common.save')}
                </button>
              </>
            }
          >
            <Field label={t('prod.addQty')}>
              <input className="input" type="number" min={1} value={dailyQty} onChange={e => setDailyQty(Number(e.target.value))} />
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
