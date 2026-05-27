import { useMemo, useState } from 'react';
import { Plus, Trash2, Package, Edit, Upload, ListTree, ClipboardCheck } from 'lucide-react';
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
import { useProductionLogs } from '@/hooks/useProductionLogs';
import { useProduceWithBom } from '@/hooks/useBomItems';
import { BomEditor } from '@/components/ui/BomEditor';
import { StocktakeModal } from '@/components/ui/StocktakeModal';
import { useAddActionLog } from '@/hooks/useActionLogs';
import { formatDate } from '@/lib/format';
import { productionThisMonth } from '@/lib/calc';
import { parseCsv } from '@/lib/csv';
import { supabase } from '@/data/supabaseClient';
import { MoneyInput } from '@/components/ui/MoneyInput';
import type { Product } from '@/types';

export default function Production() {
  const t = useT();
  const { toast } = useToast();
  const { data: products = [] } = useProducts();
  const { data: logs = [] } = useProductionLogs();
  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const produceWithBom = useProduceWithBom();
  const addAction = useAddActionLog();

  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [initialStock, setInitialStock] = useState(0);
  const [minStock, setMinStock] = useState(10);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [vatRate, setVatRate] = useState(0);
  const [cost, setCost] = useState(0);
  const [defaultPrice, setDefaultPrice] = useState(0);

  function openEdit(p: Product) {
    setEditing(p);
    setName(p.name);
    setMinStock(p.minStock);
    setImageUrl(p.imageUrl);
    setVatRate(p.vatRate ?? 0);
    setCost(p.cost ?? 0);
    setDefaultPrice(p.defaultPrice ?? 0);
    setNewOpen(true);
  }
  function openNew() {
    setEditing(null);
    setName('');
    setInitialStock(0);
    setMinStock(10);
    setImageUrl(undefined);
    setVatRate(0);
    setCost(0);
    setDefaultPrice(0);
    setNewOpen(true);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      toast(t('toast.error'), 'error');
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
  }

  const [dailyOpen, setDailyOpen] = useState<string | null>(null);
  const [dailyQty, setDailyQty] = useState(0);
  const [bomFor, setBomFor] = useState<Product | null>(null);
  const [stocktakeOpen, setStocktakeOpen] = useState(false);

  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<Array<{ name: string; stock: number; minStock: number }>>([]);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setImportError(null);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setImportError('Empty file');
      setImportRows([]);
      return;
    }
    // Expected headers: name, stock, min_stock (case-insensitive, min_stock optional)
    const parsed = rows.map(r => {
      const name = (r.name ?? r.Name ?? '').trim();
      const stock = Number(r.stock ?? r.Stock ?? 0) || 0;
      const minStock = Number(r.min_stock ?? r.minStock ?? r['Min Stock'] ?? 10) || 10;
      return { name, stock, minStock };
    }).filter(r => r.name);
    setImportRows(parsed);
    if (parsed.length === 0) setImportError('No valid rows. Expected columns: name, stock, min_stock');
  }

  async function runImport() {
    for (const row of importRows) {
      try {
        await new Promise<void>((resolve, reject) => {
          addProduct.mutate(
            { ...row, vatRate: 0, cost: 0 },
            { onSuccess: () => resolve(), onError: reject },
          );
        });
      } catch {
        // skip individual failures (e.g. duplicates)
      }
    }
    toast(`${importRows.length} ${t('toast.saved').toLowerCase()}`);
    setImportOpen(false);
    setImportRows([]);
  }

  const monthly = useMemo(() => productionThisMonth(logs), [logs]);
  const totalStock = useMemo(() => products.reduce((a, p) => a + p.stock, 0), [products]);
  const topProduct = useMemo(() => {
    if (products.length === 0) return '—';
    return [...products].sort((a, b) => b.stock - a.stock)[0].name;
  }, [products]);

  function handleSaveNew() {
    if (!name.trim()) {
      toast(t('form.nameRequired'), 'error');
      return;
    }
    if (editing) {
      updateProduct.mutate(
        {
          id: editing.id,
          patch: {
            name: name.trim(),
            minStock,
            imageUrl,
            vatRate,
            cost,
            defaultPrice: defaultPrice > 0 ? defaultPrice : undefined,
          },
        },
        {
          onSuccess: () => {
            toast(t('toast.saved'));
            setNewOpen(false);
            setEditing(null);
          },
          onError: () => toast(t('toast.error'), 'error'),
        },
      );
    } else {
      addProduct.mutate(
        {
          name: name.trim(),
          stock: initialStock,
          minStock,
          imageUrl,
          vatRate,
          cost,
          defaultPrice: defaultPrice > 0 ? defaultPrice : undefined,
        },
        {
          onSuccess: () => {
            toast(t('toast.saved'));
            setNewOpen(false);
            setName('');
            setInitialStock(0);
            setMinStock(10);
            setImageUrl(undefined);
          },
          onError: () => toast(t('toast.error'), 'error'),
        },
      );
    }
  }

  function handleAddDaily() {
    if (!dailyOpen) return;
    if (dailyQty <= 0) {
      toast(t('form.positive'), 'error');
      return;
    }
    const product = products.find(p => p.id === dailyOpen);
    if (!product) return;

    // Use the BOM-aware RPC: this atomically deducts raw materials AND
    // increments finished stock AND inserts the production log. If the
    // product has no BOM rows, the RPC just increments stock + logs.
    produceWithBom.mutate(
      { productId: product.id, quantity: dailyQty, date: new Date().toISOString() },
      {
        onSuccess: () => {
          addAction.mutate({
            type: 'production',
            description: `+${dailyQty} ${product.name}`,
            date: new Date().toISOString(),
          });
          toast(t('prod.producedWithBom'));
          setDailyOpen(null);
          setDailyQty(0);
        },
        onError: (err) => {
          const msg = err instanceof Error && err.message.includes('insufficient_raw_material')
            ? t('prod.insufficientRaw')
            : t('toast.error');
          toast(msg, 'error');
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
            onAdd={openNew}
            rightSlot={
              <>
                <button
                  className="btn-secondary"
                  onClick={() => setStocktakeOpen(true)}
                  title={t('stocktake.title')}
                  disabled={products.length === 0}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('stocktake.cta')}</span>
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => { setImportOpen(true); setImportRows([]); setImportError(null); }}
                  title="CSV"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
              </>
            }
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
              onAction={openNew}
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
                      <td className="font-medium">
                        <div className="flex items-center gap-2.5">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="w-8 h-8 rounded-md object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-surface-2 border border-border shrink-0 flex items-center justify-center text-fg-subtle">
                              <Package className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <span>{p.name}</span>
                        </div>
                      </td>
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
                          className="btn-ghost !py-1.5"
                          onClick={() => setBomFor(p)}
                          title={t('prod.bom')}
                        >
                          <ListTree className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="btn-ghost !py-1.5"
                          onClick={() => openEdit(p)}
                          title={t('common.edit')}
                        >
                          <Edit className="w-3.5 h-3.5" />
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
            onClose={() => { setNewOpen(false); setEditing(null); }}
            title={editing ? t('common.edit') : t('prod.newProduct')}
            size="sm"
            footer={
              <>
                <button className="btn-secondary" onClick={() => { setNewOpen(false); setEditing(null); }} disabled={addProduct.isPending || updateProduct.isPending}>
                  {t('common.cancel')}
                </button>
                <button className="btn-primary" onClick={handleSaveNew} disabled={addProduct.isPending || updateProduct.isPending}>
                  {(addProduct.isPending || updateProduct.isPending) ? '…' : t('common.save')}
                </button>
              </>
            }
          >
            <Field label={t('prod.productName')}>
              <input className="input" value={name} onChange={e => setName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              {!editing && (
                <Field label={t('prod.initialStock')}>
                  <MoneyInput value={initialStock} onChange={setInitialStock} placeholder="0" />
                </Field>
              )}
              <Field label={t('prod.minStock')}>
                <MoneyInput value={minStock} onChange={setMinStock} placeholder="10" />
              </Field>
              <Field label="VAT %">
                <MoneyInput value={vatRate} onChange={setVatRate} max={100} placeholder="0" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('prod.unitCost')} hint={t('prod.unitCostHint')}>
                <MoneyInput value={cost} onChange={setCost} placeholder="0" />
              </Field>
              <Field label={t('prod.defaultPrice')} hint={t('prod.defaultPriceHint')}>
                <MoneyInput value={defaultPrice} onChange={setDefaultPrice} placeholder="—" />
              </Field>
            </div>
            {cost > 0 && defaultPrice > 0 && (
              <div className="text-xs text-fg-muted -mt-1 px-1 tnum">
                {t('prod.estimatedMargin')}:{' '}
                <span className={defaultPrice > cost ? 'text-positive font-semibold' : 'text-negative font-semibold'}>
                  {(((defaultPrice - cost) / defaultPrice) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            <Field label="Image">
              <div className="flex items-center gap-3">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-fg-subtle">
                    <Package className="w-5 h-5" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) void uploadImage(f);
                  }}
                  className="block text-xs file:mr-2 file:py-1.5 file:px-2 file:rounded-md file:border file:border-border file:bg-bg file:text-fg file:hover:bg-surface file:transition"
                  disabled={uploading}
                />
                {imageUrl && (
                  <button
                    type="button"
                    className="btn-ghost !py-1 text-xs text-negative"
                    onClick={() => setImageUrl(undefined)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </Field>
          </Modal>

          <Modal
            open={!!dailyOpen}
            onClose={() => setDailyOpen(null)}
            title={`${t('prod.addDaily')} — ${dailyProduct?.name ?? ''}`}
            size="sm"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setDailyOpen(null)} disabled={produceWithBom.isPending}>
                  {t('common.cancel')}
                </button>
                <button className="btn-primary" onClick={handleAddDaily} disabled={produceWithBom.isPending}>
                  {produceWithBom.isPending ? '…' : t('common.save')}
                </button>
              </>
            }
          >
            <Field label={t('prod.addQty')}>
              <MoneyInput value={dailyQty} onChange={setDailyQty} min={1} placeholder="0" autoFocus />
            </Field>
          </Modal>

          <ConfirmDialog
            open={!!confirmDel}
            onConfirm={handleDelete}
            onCancel={() => setConfirmDel(null)}
          />

          <BomEditor
            product={bomFor}
            allProducts={products}
            onClose={() => setBomFor(null)}
          />

          <StocktakeModal
            open={stocktakeOpen}
            onClose={() => setStocktakeOpen(false)}
            products={products}
          />

          <Modal
            open={importOpen}
            onClose={() => setImportOpen(false)}
            title="Import products (CSV)"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setImportOpen(false)}>
                  {t('common.cancel')}
                </button>
                <button
                  className="btn-primary"
                  onClick={runImport}
                  disabled={importRows.length === 0}
                >
                  Import {importRows.length > 0 ? `(${importRows.length})` : ''}
                </button>
              </>
            }
          >
            <div className="text-xs text-fg-muted">
              Expected columns: <code>name</code>, <code>stock</code>, <code>min_stock</code>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-border file:bg-bg file:text-fg file:hover:bg-surface file:transition"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            {importError && (
              <div className="text-sm text-negative bg-negative/5 border border-negative/20 rounded-lg px-3 py-2">
                {importError}
              </div>
            )}
            {importRows.length > 0 && (
              <div className="card overflow-hidden max-h-64 overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>name</th>
                      <th>stock</th>
                      <th>min_stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 50).map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td className="tnum">{r.stock}</td>
                        <td className="tnum">{r.minStock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importRows.length > 50 && (
                  <div className="px-4 py-2 text-xs text-fg-muted">+{importRows.length - 50} more</div>
                )}
              </div>
            )}
          </Modal>
        </>
      )}
    </Layout>
  );
}
