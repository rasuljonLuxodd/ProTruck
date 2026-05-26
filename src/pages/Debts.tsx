import { useMemo, useState } from 'react';
import { Trash2, Search, CreditCard, Download } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { useDebts, useAddDebt, usePayDebtPartial, usePayDebtFull, useDeleteDebt } from '@/hooks/useDebts';
import { useAddActionLog } from '@/hooks/useActionLogs';
import { formatUZS, formatDate, daysBetween, toInputDate, fromInputDate } from '@/lib/format';
import { useFormatDate } from '@/lib/useFormatters';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { MoneyInput } from '@/components/ui/MoneyInput';
import type { Debt } from '@/types';

export default function Debts() {
  const t = useT();
  const fmtDate = useFormatDate();
  const { toast } = useToast();
  const { data: debts = [] } = useDebts();
  const addDebt = useAddDebt();
  const payPartial = usePayDebtPartial();
  const payFull = usePayDebtFull();
  const deleteDebt = useDeleteDebt();
  const addAction = useAddActionLog();

  const [search, setSearch] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [product, setProduct] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(toInputDate(new Date().toISOString()));
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  const [partial, setPartial] = useState<Debt | null>(null);
  const [partialAmount, setPartialAmount] = useState(0);

  const [fullPay, setFullPay] = useState<Debt | null>(null);

  const total = debts.reduce((a, d) => a + d.amount, 0);
  const count = debts.length;
  const biggest = useMemo(() => {
    if (debts.length === 0) return 0;
    return Math.max(...debts.map(d => d.amount));
  }, [debts]);

  const filtered = useMemo(
    () =>
      debts
        .filter(d => d.customerName.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [debts, search],
  );

  function resetNew() {
    setName(''); setPhone(''); setProduct(''); setAmount(0);
    setDate(toInputDate(new Date().toISOString()));
    setDueDate(''); setNote('');
  }

  function handleAddDebt() {
    if (!name.trim()) {
      toast(t('form.nameRequired'), 'error');
      return;
    }
    if (amount <= 0) {
      toast(t('form.amountRequired'), 'error');
      return;
    }
    addDebt.mutate(
      {
        customerName: name.trim(),
        customerPhone: phone.trim(),
        product: product.trim(),
        amount,
        originalAmount: amount,
        date: fromInputDate(date),
        dueDate: dueDate ? fromInputDate(dueDate) : undefined,
        note: note.trim() || undefined,
      },
      { onSuccess: () => { toast(t('toast.saved')); setNewOpen(false); resetNew(); } },
    );
  }

  function handlePartial() {
    if (!partial) return;
    if (partialAmount <= 0) {
      toast(t('form.amountRequired'), 'error');
      return;
    }
    payPartial.mutate(
      { id: partial.id, payment: { amount: partialAmount, date: new Date().toISOString() } },
      {
        onSuccess: () => {
          addAction.mutate({
            type: 'payment',
            description: `${partial.customerName} — ${formatUZS(partialAmount)}`,
            date: new Date().toISOString(),
          });
          toast(t('toast.paid')); setPartial(null); setPartialAmount(0);
        },
      },
    );
  }

  function handleFull() {
    if (!fullPay) return;
    payFull.mutate(fullPay.id, {
      onSuccess: () => {
        addAction.mutate({
          type: 'payment',
          description: `${fullPay.customerName} — ${formatUZS(fullPay.amount)} · ${t('debts.full')}`,
          date: new Date().toISOString(),
        });
        toast(t('toast.paid')); setFullPay(null);
      },
    });
  }

  function handleDelete() {
    if (!confirmDel) return;
    deleteDebt.mutate(confirmDel, { onSuccess: () => { toast(t('toast.deleted')); setConfirmDel(null); } });
  }

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader
            title={t('nav.debts')}
            onMenu={openMenu}
            onAdd={() => setNewOpen(true)}
            rightSlot={
              filtered.length > 0 && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    const csv = buildCsv(filtered, [
                      { key: 'date',           header: t('common.date'),          render: r => formatDate(r.date) },
                      { key: 'customerName',   header: t('common.customer') },
                      { key: 'customerPhone',  header: t('common.phone') },
                      { key: 'product',        header: t('common.product') },
                      { key: 'amount',         header: t('debts.colAmount'),      render: r => String(r.amount) },
                      { key: 'originalAmount', header: 'original',                 render: r => String(r.originalAmount) },
                      { key: 'dueDate',        header: t('debts.colDue'),          render: r => (r.dueDate ? formatDate(r.dueDate) : '') },
                    ]);
                    downloadCsv(`debts-${new Date().toISOString().slice(0, 10)}.csv`, csv);
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  {t('common.export')}
                </button>
              )
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatCard title={t('debts.total')} value={formatUZS(total)} icon={CreditCard} tone="negative" />
            <StatCard title={t('debts.count')} value={String(count)} />
            <StatCard title={t('debts.biggest')} value={formatUZS(biggest)} />
          </div>

          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
            <input
              className="input pl-9"
              placeholder={t('sales.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {debts.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title={t('empty.debts.title')}
              description={t('empty.debts.desc')}
              actionLabel={t('debts.newTitle')}
              onAction={() => setNewOpen(true)}
            />
          ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('common.customer')}</th>
                    <th>{t('common.phone')}</th>
                    <th>{t('common.product')}</th>
                    <th className="text-right">{t('debts.colAmount')}</th>
                    <th>{t('common.date')}</th>
                    <th className="text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-fg-subtle py-10">{t('common.empty')}</td></tr>
                  ) : (
                    filtered.map(d => (
                      <tr key={d.id}>
                        <td className="font-medium">{d.customerName}</td>
                        <td className="font-mono text-xs text-fg-muted">{d.customerPhone}</td>
                        <td className="max-w-[240px] truncate">{d.product}</td>
                        <td className="text-right text-negative font-semibold">{formatUZS(d.amount)}</td>
                        <td className="font-mono text-xs text-fg-muted">
                          {fmtDate(d.date)}
                          <div className="text-[10px] mt-0.5">{daysBetween(d.date)} {t('debts.daysPassed')}</div>
                        </td>
                        <td className="text-right space-x-1 whitespace-nowrap">
                          <button
                            className="btn-secondary !py-1.5 !text-xs"
                            onClick={() => { setPartial(d); setPartialAmount(0); }}
                          >
                            {t('debts.partial')}
                          </button>
                          <button
                            className="btn-primary !py-1.5 !text-xs"
                            onClick={() => setFullPay(d)}
                          >
                            {t('debts.full')}
                          </button>
                          <button className="btn-ghost !py-1.5 text-negative" onClick={() => setConfirmDel(d.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}

          <Modal
            open={newOpen}
            onClose={() => setNewOpen(false)}
            title={t('debts.newTitle')}
            footer={
              <>
                <button className="btn-secondary" onClick={() => setNewOpen(false)}>{t('common.cancel')}</button>
                <button className="btn-primary" onClick={handleAddDebt}>{t('common.save')}</button>
              </>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('common.customer')}>
                <input className="input" value={name} onChange={e => setName(e.target.value)} />
              </Field>
              <Field label={t('common.phone')}>
                <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
              </Field>
            </div>
            <Field label={t('common.product')}>
              <input className="input" value={product} onChange={e => setProduct(e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label={t('debts.amount')}>
                <MoneyInput value={amount} onChange={setAmount} placeholder="0" />
              </Field>
              <Field label={t('common.date')}>
                <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </Field>
              <Field label={t('debts.dueDate')}>
                <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </Field>
            </div>
            <Field label={t('common.note')}>
              <textarea className="input" value={note} onChange={e => setNote(e.target.value)} />
            </Field>
          </Modal>

          <Modal
            open={!!partial}
            onClose={() => setPartial(null)}
            title={t('debts.partialTitle')}
            size="sm"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setPartial(null)}>{t('common.cancel')}</button>
                <button className="btn-primary" onClick={handlePartial}>{t('common.save')}</button>
              </>
            }
          >
            {partial && (
              <>
                <div className="bg-surface border border-border rounded-lg p-3">
                  <div className="text-xs text-fg-muted mb-1">{partial.customerName}</div>
                  <div className="text-2xl font-semibold text-negative tnum">{formatUZS(partial.amount)}</div>
                </div>
                <Field label={t('debts.amount')}>
                  <MoneyInput
                    value={partialAmount}
                    onChange={setPartialAmount}
                    max={partial.amount}
                    placeholder="0"
                    autoFocus
                  />
                </Field>
              </>
            )}
          </Modal>

          <Modal
            open={!!fullPay}
            onClose={() => setFullPay(null)}
            title={t('debts.fullTitle')}
            size="sm"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setFullPay(null)}>{t('common.cancel')}</button>
                <button className="btn-primary" onClick={handleFull}>{t('common.confirm')}</button>
              </>
            }
          >
            {fullPay && (
              <div className="bg-surface border border-border rounded-lg p-3">
                <div className="text-xs text-fg-muted mb-1">{fullPay.customerName}</div>
                <div className="text-2xl font-semibold text-positive tnum">{formatUZS(fullPay.amount)}</div>
              </div>
            )}
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
