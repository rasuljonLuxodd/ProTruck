import { useMemo, useState } from 'react';
import { Trash2, Edit, Wallet, Download } from 'lucide-react';
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
import { useExpenses, useAddExpense, useUpdateExpense, useDeleteExpense } from '@/hooks/useExpenses';
import { useAddActionLog } from '@/hooks/useActionLogs';
import { formatUZS, formatDate, percentChange, toInputDate, fromInputDate } from '@/lib/format';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { inMonth } from '@/lib/calc';
import type { Expense, ExpenseCategory, PaymentType } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

const CATEGORIES: ExpenseCategory[] = ['Ijara', 'Elektr', 'Xom ashyo', 'Maosh', 'Boshqa'];
const PAYMENT_TYPES: PaymentType[] = ['naqd', 'karta', 'qarz', 'aralash'];

export default function Expenses() {
  const t = useT();
  const { toast } = useToast();
  const { data: expenses = [] } = useExpenses();
  const add = useAddExpense();
  const upd = useUpdateExpense();
  const del = useDeleteExpense();
  const addAction = useAddActionLog();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const [category, setCategory] = useState<ExpenseCategory>('Boshqa');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<PaymentType>('naqd');
  const [date, setDate] = useState(toInputDate(new Date().toISOString()));

  const [filterCat, setFilterCat] = useState<ExpenseCategory | 'all'>('all');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisMonth = useMemo(
    () =>
      expenses
        .filter(e => inMonth(e.date, now.getFullYear(), now.getMonth()))
        .reduce((a, e) => a + e.amount, 0),
    [expenses, now],
  );
  const lastMonth = useMemo(
    () =>
      expenses
        .filter(e => inMonth(e.date, last.getFullYear(), last.getMonth()))
        .reduce((a, e) => a + e.amount, 0),
    [expenses, last],
  );
  const biggest = useMemo(() => {
    if (expenses.length === 0) return 0;
    return Math.max(...expenses.map(e => e.amount));
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses
      .filter(e => (filterCat === 'all' ? true : e.category === filterCat))
      .filter(e => {
        if (!filterMonth) return true;
        const [y, m] = filterMonth.split('-').map(Number);
        return inMonth(e.date, y, (m ?? 1) - 1);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, filterCat, filterMonth]);

  function reset() {
    setCategory('Boshqa'); setDescription(''); setAmount(0);
    setPaymentType('naqd');
    setDate(toInputDate(new Date().toISOString()));
    setEditing(null);
  }

  function startEdit(e: Expense) {
    setEditing(e);
    setCategory(e.category);
    setDescription(e.description);
    setAmount(e.amount);
    setPaymentType(e.paymentType);
    setDate(toInputDate(e.date));
    setOpen(true);
  }

  function save() {
    if (amount <= 0 || !description.trim()) return;
    const payload: Omit<Expense, 'id'> = {
      category,
      description: description.trim(),
      amount,
      paymentType,
      date: fromInputDate(date),
      auto: editing?.auto,
    };
    if (editing) {
      upd.mutate(
        { id: editing.id, patch: payload },
        { onSuccess: () => { toast(t('toast.saved')); setOpen(false); reset(); } },
      );
    } else {
      add.mutate(payload, {
        onSuccess: () => {
          addAction.mutate({
            type: 'expense',
            description: `${description.trim()} — ${formatUZS(amount)}`,
            date: payload.date,
          });
          toast(t('toast.saved')); setOpen(false); reset();
        },
      });
    }
  }

  function handleDelete() {
    if (!confirmDel) return;
    del.mutate(confirmDel, { onSuccess: () => { toast(t('toast.deleted')); setConfirmDel(null); } });
  }

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader
            title={t('nav.expenses')}
            onMenu={openMenu}
            onAdd={() => { reset(); setOpen(true); }}
            rightSlot={
              filtered.length > 0 && (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    const csv = buildCsv(filtered, [
                      { key: 'date',        header: t('common.date'),        render: r => formatDate(r.date) },
                      { key: 'category',    header: t('common.category'),    render: r => t(`expCat.${r.category}` as TranslationKey) },
                      { key: 'description', header: t('common.description') },
                      { key: 'amount',      header: t('common.amount'),      render: r => String(r.amount) },
                      { key: 'paymentType', header: t('common.paymentType'), render: r => t(`payment.${r.paymentType}` as TranslationKey) },
                      { key: 'auto',        header: 'auto',                  render: r => (r.auto ? 'yes' : 'no') },
                    ]);
                    downloadCsv(`expenses-${new Date().toISOString().slice(0, 10)}.csv`, csv);
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  {t('common.export')}
                </button>
              )
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatCard title={t('exp.monthly')} value={formatUZS(thisMonth)} icon={Wallet} tone="negative" />
            <StatCard title={t('exp.biggest')} value={formatUZS(biggest)} />
            <StatCard
              title={t('exp.vsPrev')}
              value={formatUZS(thisMonth - lastMonth)}
              tone={(thisMonth - lastMonth) >= 0 ? 'negative' : 'positive'}
              change={percentChange(thisMonth, lastMonth)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <select
              className="input sm:w-48"
              value={filterCat}
              onChange={e => setFilterCat(e.target.value as ExpenseCategory | 'all')}
            >
              <option value="all">{t('common.all')}</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{t(`expCat.${c}` as TranslationKey)}</option>
              ))}
            </select>
            <input
              className="input sm:w-48"
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
            />
          </div>

          {expenses.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title={t('empty.expenses.title')}
              description={t('empty.expenses.desc')}
              actionLabel={t('exp.newTitle')}
              onAction={() => { reset(); setOpen(true); }}
            />
          ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('common.category')}</th>
                    <th>{t('common.description')}</th>
                    <th className="text-right">{t('common.amount')}</th>
                    <th>{t('common.paymentType')}</th>
                    <th>{t('common.date')}</th>
                    <th className="text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-fg-subtle py-10">{t('common.empty')}</td></tr>
                  ) : (
                    filtered.map(e => (
                      <tr key={e.id}>
                        <td><Badge>{t(`expCat.${e.category}` as TranslationKey)}</Badge></td>
                        <td>
                          {e.description}
                          {e.auto ? <span className="ml-2 text-[10px] text-fg-subtle uppercase">auto</span> : null}
                        </td>
                        <td className="text-right text-negative font-semibold">{formatUZS(e.amount)}</td>
                        <td><Badge>{t(`payment.${e.paymentType}` as TranslationKey)}</Badge></td>
                        <td className="font-mono text-xs text-fg-muted">{formatDate(e.date)}</td>
                        <td className="text-right space-x-1 whitespace-nowrap">
                          <button className="btn-ghost !py-1.5" onClick={() => startEdit(e)}>
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button className="btn-ghost !py-1.5 text-negative" onClick={() => setConfirmDel(e.id)}>
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
            open={open}
            onClose={() => { setOpen(false); reset(); }}
            title={editing ? t('exp.editTitle') : t('exp.newTitle')}
            footer={
              <>
                <button className="btn-secondary" onClick={() => { setOpen(false); reset(); }}>{t('common.cancel')}</button>
                <button className="btn-primary" onClick={save}>{t('common.save')}</button>
              </>
            }
          >
            <Field label={t('common.category')}>
              <select className="input" value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{t(`expCat.${c}` as TranslationKey)}</option>
                ))}
              </select>
            </Field>
            <Field label={t('common.description')}>
              <input className="input" value={description} onChange={e => setDescription(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('common.amount')}>
                <input className="input" type="number" min={0} value={amount} onChange={e => setAmount(Number(e.target.value))} />
              </Field>
              <Field label={t('common.date')}>
                <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </Field>
            </div>
            <Field label={t('common.paymentType')}>
              <select className="input" value={paymentType} onChange={e => setPaymentType(e.target.value as PaymentType)}>
                {PAYMENT_TYPES.map(p => (
                  <option key={p} value={p}>{t(`payment.${p}` as TranslationKey)}</option>
                ))}
              </select>
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
