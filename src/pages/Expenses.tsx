import { useMemo, useState } from 'react';
import { Trash2, Edit, Wallet, Download, FileDown } from 'lucide-react';
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
import {
  useRecurringExpenses, useAddRecurringExpense, useUpdateRecurringExpense, useDeleteRecurringExpense,
} from '@/hooks/useRecurringExpenses';
import { useSuppliers, useAddSupplier } from '@/hooks/useSuppliers';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { useAddActionLog } from '@/hooks/useActionLogs';
import { formatUZS, formatDate, percentChange, toInputDate, fromInputDate } from '@/lib/format';
import { useFormatDate } from '@/lib/useFormatters';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { expensePdf } from '@/lib/pdfCheque';
import { inMonth, dailySeries } from '@/lib/calc';
import type { Expense, ExpenseCategory, PaymentType, RecurringExpense } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

const CATEGORIES: ExpenseCategory[] = ['Ijara', 'Elektr', 'Xom ashyo', 'Maosh', 'Boshqa'];
const PAYMENT_TYPES: PaymentType[] = ['naqd', 'karta', 'qarz', 'aralash'];

export default function Expenses() {
  const t = useT();
  const fmtDate = useFormatDate();
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

  const { data: suppliers = [] } = useSuppliers();
  const addSupplier = useAddSupplier();
  const [newSupplierName, setNewSupplierName] = useState('');

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

  // 14-day sparkline of daily expenses
  const dailyExpenses = useMemo(
    () => dailySeries(expenses, e => e.date, e => e.amount),
    [expenses],
  );

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
    if (!description.trim()) {
      toast(t('common.description') + ': ' + t('form.required'), 'error');
      return;
    }
    if (amount <= 0) {
      toast(t('form.amountRequired'), 'error');
      return;
    }
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
                  title={t('common.export')}
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
                  <span className="hidden sm:inline">{t('common.export')}</span>
                </button>
              )
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatCard
              title={t('exp.monthly')}
              value={formatUZS(thisMonth)}
              icon={Wallet}
              tone="negative"
              series={dailyExpenses}
            />
            <StatCard title={t('exp.biggest')} value={formatUZS(biggest)} />
            <StatCard
              title={t('exp.vsPrev')}
              value={formatUZS(thisMonth - lastMonth)}
              tone={(thisMonth - lastMonth) >= 0 ? 'negative' : 'positive'}
              change={percentChange(thisMonth, lastMonth)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Select
              className="sm:w-52"
              value={filterCat}
              onChange={setFilterCat}
              options={[
                { value: 'all' as const, label: t('common.all') },
                ...CATEGORIES.map(c => ({ value: c, label: t(`expCat.${c}` as TranslationKey) })),
              ]}
            />
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
                        <td className="font-mono text-xs text-fg-muted">{fmtDate(e.date)}</td>
                        <td className="text-right space-x-1 whitespace-nowrap">
                          <button
                            className="btn-ghost !py-1.5"
                            onClick={() => expensePdf(e)}
                            title={t('common.downloadPdf')}
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
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

          <RecurringSection />

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
              <Select
                value={category}
                onChange={setCategory}
                options={CATEGORIES.map(c => ({ value: c, label: t(`expCat.${c}` as TranslationKey) }))}
              />
            </Field>
            <Field label={t('common.description')}>
              <input className="input" value={description} onChange={e => setDescription(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('common.amount')}>
                <MoneyInput value={amount} onChange={setAmount} placeholder="0" />
              </Field>
              <Field label={t('common.date')}>
                <DatePicker value={date} onChange={setDate} />
              </Field>
            </div>
            <Field label={t('common.paymentType')}>
              <Select
                value={paymentType}
                onChange={setPaymentType}
                options={PAYMENT_TYPES.map(p => ({ value: p, label: t(`payment.${p}` as TranslationKey) }))}
              />
            </Field>

            {category === 'Xom ashyo' && (
              <Field label="Supplier">
                <div className="flex gap-2">
                  <Select
                    className="flex-1"
                    value=""
                    onChange={() => { /* TODO: persist supplier_id on the expense */ }}
                    placeholder="—"
                    options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                  />
                  <input
                    className="input flex-1"
                    placeholder="+ new supplier"
                    value={newSupplierName}
                    onChange={e => setNewSupplierName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newSupplierName.trim()) {
                        e.preventDefault();
                        addSupplier.mutate({ name: newSupplierName.trim() }, {
                          onSuccess: () => { setNewSupplierName(''); toast(t('toast.saved')); },
                        });
                      }
                    }}
                  />
                </div>
              </Field>
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

// ---------- recurring rules section ----------

function RecurringSection() {
  const t = useT();
  const { toast } = useToast();
  const { data: rules = [] } = useRecurringExpenses();
  const add = useAddRecurringExpense();
  const upd = useUpdateRecurringExpense();
  const del = useDeleteRecurringExpense();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [category, setCategory] = useState<ExpenseCategory>('Ijara');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<PaymentType>('naqd');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [active, setActive] = useState(true);

  function reset() {
    setEditing(null);
    setCategory('Ijara');
    setDescription('');
    setAmount(0);
    setPaymentType('naqd');
    setDayOfMonth(1);
    setActive(true);
  }
  function startAdd() { reset(); setOpen(true); }
  function startEdit(r: RecurringExpense) {
    setEditing(r);
    setCategory(r.category); setDescription(r.description);
    setAmount(r.amount); setPaymentType(r.paymentType);
    setDayOfMonth(r.dayOfMonth); setActive(r.active);
    setOpen(true);
  }

  function save() {
    if (!description.trim() || amount <= 0) return;
    const payload = { category, description: description.trim(), amount, paymentType, dayOfMonth, active };
    if (editing) {
      upd.mutate({ id: editing.id, patch: payload }, {
        onSuccess: () => { toast(t('toast.saved')); setOpen(false); reset(); },
        onError: () => toast(t('toast.error'), 'error'),
      });
    } else {
      add.mutate(payload, {
        onSuccess: () => { toast(t('toast.saved')); setOpen(false); reset(); },
        onError: () => toast(t('toast.error'), 'error'),
      });
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold">{t('exp.recurring')}</h2>
          <p className="text-xs text-fg-muted mt-0.5">{t('exp.recurringDesc')}</p>
        </div>
        <button className="btn-secondary" onClick={startAdd}>
          <Edit className="w-3.5 h-3.5" />
          {t('exp.addRecurring')}
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="card p-6 text-center text-sm text-fg-muted">{t('common.empty')}</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.category')}</th>
                <th>{t('common.description')}</th>
                <th className="text-right">{t('common.amount')}</th>
                <th>{t('exp.dayOfMonth')}</th>
                <th>{t('exp.active')}</th>
                <th className="text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id}>
                  <td><Badge>{t(`expCat.${r.category}` as TranslationKey)}</Badge></td>
                  <td>{r.description}</td>
                  <td className="text-right font-semibold">{formatUZS(r.amount)}</td>
                  <td className="font-mono">{r.dayOfMonth}</td>
                  <td>
                    <button
                      onClick={() => upd.mutate({ id: r.id, patch: { active: !r.active } })}
                      className={`badge ${r.active ? 'bg-positive/10 text-positive border border-positive/20' : 'bg-surface-2 text-fg-muted border border-border'}`}
                    >
                      {r.active ? t('exp.active') : t('exp.paused')}
                    </button>
                  </td>
                  <td className="text-right space-x-1">
                    <button className="btn-ghost !py-1.5" onClick={() => startEdit(r)}>
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="btn-ghost !py-1.5 text-negative"
                      onClick={() => del.mutate(r.id, { onSuccess: () => toast(t('toast.deleted')) })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => { setOpen(false); reset(); }}
        title={editing ? t('common.edit') : t('exp.addRecurring')}
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setOpen(false); reset(); }}>{t('common.cancel')}</button>
            <button className="btn-primary" onClick={save}>{t('common.save')}</button>
          </>
        }
      >
        <Field label={t('common.category')}>
          <Select
            value={category}
            onChange={setCategory}
            options={CATEGORIES.map(c => ({ value: c, label: t(`expCat.${c}` as TranslationKey) }))}
          />
        </Field>
        <Field label={t('common.description')}>
          <input className="input" value={description} onChange={e => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('common.amount')}>
            <MoneyInput value={amount} onChange={setAmount} placeholder="0" />
          </Field>
          <Field label={t('exp.dayOfMonth')}>
            <MoneyInput value={dayOfMonth} onChange={setDayOfMonth} min={1} max={28} placeholder="1" />
          </Field>
        </div>
        <Field label={t('common.paymentType')}>
          <Select
            value={paymentType}
            onChange={setPaymentType}
            options={PAYMENT_TYPES.map(p => ({ value: p, label: t(`payment.${p}` as TranslationKey) }))}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          {t('exp.active')}
        </label>
      </Modal>
    </div>
  );
}
