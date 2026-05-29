import { useMemo, useState } from 'react';
import { Plus, Minus, Eye, Trash2, Wallet, Users as UsersIcon, Printer, CheckCircle2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PrintableSlip } from '@/components/ui/PrintableSlip';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Select } from '@/components/ui/Select';
import { supabase } from '@/data/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import {
  useWorkers, useAddWorker, useUpdateWorker, useDeleteWorker, usePayWorker,
} from '@/hooks/useWorkers';
import { useAddExpense } from '@/hooks/useExpenses';
import { useAddActionLog } from '@/hooks/useActionLogs';
import { formatUZS, formatDate } from '@/lib/format';
import { useFormatDate } from '@/lib/useFormatters';
import { workerPayoutDue, currentMonthDays } from '@/lib/calc';
import { cn } from '@/lib/utils';
import type { PaymentType, Worker, WorkerPayment } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

const PAYMENT_TYPES: PaymentType[] = ['naqd', 'karta', 'qarz', 'aralash'];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

export default function Workers() {
  const t = useT();
  const { toast } = useToast();
  const fmtDate = useFormatDate();
  const { data: workers = [] } = useWorkers();
  const addWorker = useAddWorker();
  const updWorker = useUpdateWorker();
  const delWorker = useDeleteWorker();
  const payWorker = usePayWorker();
  const addExpense = useAddExpense();
  const addAction = useAddActionLog();

  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');
  const [salary, setSalary] = useState(0);

  const [bonusFor, setBonusFor] = useState<Worker | null>(null);
  const [bonusAmount, setBonusAmount] = useState(0);

  const [penaltyFor, setPenaltyFor] = useState<Worker | null>(null);
  const [penaltyAmount, setPenaltyAmount] = useState(0);

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceWorkerId, setAdvanceWorkerId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState(0);

  const [payFor, setPayFor] = useState<Worker | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payType, setPayType] = useState<PaymentType>('naqd');
  const [payNote, setPayNote] = useState('');

  const [viewFor, setViewFor] = useState<Worker | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [payslipFor, setPayslipFor] = useState<{ worker: Worker; payment: WorkerPayment } | null>(null);

  const monthLabel = useMemo(() => {
    const m = new Date().getMonth() + 1;
    return t(`month.${m}` as TranslationKey);
  }, [t]);

  const qc = useQueryClient();
  async function markAttendance(w: Worker) {
    const { error } = await supabase.rpc('toggle_worker_attendance', {
      p_worker_id: w.id,
    });
    if (error) {
      toast(t('toast.error'), 'error');
      return;
    }
    qc.invalidateQueries({ queryKey: ['workers'] });
    toast(t('toast.saved'));
  }

  const totalAdvances = workers.reduce((a, w) => a + w.advance, 0);
  const monthDays = currentMonthDays();

  function adjustDays(w: Worker, delta: number) {
    // Cap at actual days in the current month, not a hardcoded 30 — Feb
    // and 31-day months were both wrong before.
    const next = Math.min(monthDays, Math.max(0, w.workDays + delta));
    if (next === w.workDays) return;
    updWorker.mutate({ id: w.id, patch: { workDays: next } });
  }

  function addNewWorker() {
    if (!name.trim()) {
      toast(t('form.nameRequired'), 'error');
      return;
    }
    if (salary <= 0) {
      toast(t('form.positive'), 'error');
      return;
    }
    addWorker.mutate(
      { name: name.trim(), monthlySalary: salary },
      {
        onSuccess: () => { toast(t('toast.saved')); setNewOpen(false); setName(''); setSalary(0); },
        onError: err => toast(err instanceof Error ? err.message : t('toast.error'), 'error'),
      },
    );
  }

  function saveBonus() {
    if (!bonusFor) return;
    if (bonusAmount <= 0) {
      toast(t('form.amountRequired'), 'error');
      return;
    }
    updWorker.mutate(
      { id: bonusFor.id, patch: { bonus: bonusFor.bonus + bonusAmount } },
      {
        onSuccess: () => { toast(t('toast.saved')); setBonusFor(null); setBonusAmount(0); },
        onError: err => toast(err instanceof Error ? err.message : t('toast.error'), 'error'),
      },
    );
  }

  function savePenalty() {
    if (!penaltyFor) return;
    if (penaltyAmount <= 0) {
      toast(t('form.amountRequired'), 'error');
      return;
    }
    updWorker.mutate(
      { id: penaltyFor.id, patch: { penalty: penaltyFor.penalty + penaltyAmount } },
      {
        onSuccess: () => { toast(t('toast.saved')); setPenaltyFor(null); setPenaltyAmount(0); },
        onError: err => toast(err instanceof Error ? err.message : t('toast.error'), 'error'),
      },
    );
  }

  function saveAdvance() {
    const worker = workers.find(w => w.id === advanceWorkerId);
    if (!worker) {
      toast(t('wrk.pickWorker'), 'error');
      return;
    }
    if (advanceAmount <= 0) {
      toast(t('form.amountRequired'), 'error');
      return;
    }
    updWorker.mutate(
      { id: worker.id, patch: { advance: worker.advance + advanceAmount } },
      {
        onSuccess: () => {
          addExpense.mutate({
            category: 'Boshqa',
            description: `${t('wrk.advanceExpense')}: ${worker.name}`,
            amount: advanceAmount,
            paymentType: 'naqd',
            date: new Date().toISOString(),
            auto: true,
          });
          addAction.mutate({
            type: 'payment',
            description: `${t('wrk.advanceExpense')}: ${worker.name} — ${formatUZS(advanceAmount)}`,
            date: new Date().toISOString(),
          });
          toast(t('toast.saved'));
          setAdvanceOpen(false);
          setAdvanceWorkerId('');
          setAdvanceAmount(0);
        },
        onError: err => toast(err instanceof Error ? err.message : t('toast.error'), 'error'),
      },
    );
  }

  function savePayment() {
    if (!payFor) return;
    if (payAmount <= 0) {
      toast(t('form.amountRequired'), 'error');
      return;
    }
    const snapshot = {
      workDays: payFor.workDays,
      bonus: payFor.bonus,
      penalty: payFor.penalty,
      advance: payFor.advance,
      salary: payFor.monthlySalary,
    };
    payWorker.mutate(
      {
        id: payFor.id,
        payment: {
          amount: payAmount,
          paymentType: payType,
          note: payNote.trim() || undefined,
          date: new Date().toISOString(),
          snapshot,
        },
      },
      {
        onSuccess: () => {
          addExpense.mutate({
            category: 'Maosh',
            description: `${t('wrk.salaryExpense')}: ${payFor.name}`,
            amount: payAmount,
            paymentType: payType,
            date: new Date().toISOString(),
            auto: true,
          });
          addAction.mutate({
            type: 'payment',
            description: `${t('wrk.salaryExpense')}: ${payFor.name} — ${formatUZS(payAmount)}`,
            date: new Date().toISOString(),
          });
          toast(t('toast.paid'));
          setPayFor(null); setPayAmount(0); setPayType('naqd'); setPayNote('');
        },
        onError: err => toast(err instanceof Error ? err.message : t('toast.error'), 'error'),
      },
    );
  }

  function handleDelete() {
    if (!confirmDel) return;
    delWorker.mutate(confirmDel, {
      onSuccess: () => { toast(t('toast.deleted')); setConfirmDel(null); },
      onError: err => toast(err instanceof Error ? err.message : t('toast.error'), 'error'),
    });
  }

  return (
    <Layout>
      {({ openMenu }) => (
        <>
          <PageHeader
            title={t('nav.workers')}
            onMenu={openMenu}
            onAdd={() => { setName(''); setSalary(0); setNewOpen(true); }}
          />

          <div className="card p-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-xs text-fg-muted">{t('wrk.currentMonth')}</div>
                <div className="text-base font-semibold mt-0.5">{monthLabel}</div>
              </div>
              <div>
                <div className="text-xs text-fg-muted">{t('wrk.totalAdvances')}</div>
                <div className="text-base font-semibold mt-0.5 tnum">{formatUZS(totalAdvances)}</div>
              </div>
            </div>
            <button className="btn-primary" onClick={() => setAdvanceOpen(true)}>
              <Wallet className="w-3.5 h-3.5" />
              {t('wrk.giveAdvance')}
            </button>
          </div>

          {workers.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title={t('empty.workers.title')}
              description={t('empty.workers.desc')}
              actionLabel={t('wrk.newTitle')}
              onAction={() => { setName(''); setSalary(0); setNewOpen(true); }}
            />
          ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {workers.map(w => {
                const due = workerPayoutDue(w);
                return (
                  <div key={w.id} className="card overflow-hidden">
                    <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-sm font-semibold">
                          {initials(w.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{w.name}</div>
                          <div className="text-xs text-fg-muted tnum">{formatUZS(w.monthlySalary)} / {t('wrk.salary')}</div>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button className="btn-ghost !p-1.5" onClick={() => setViewFor(w)}>
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="btn-ghost !p-1.5 text-negative" onClick={() => setConfirmDel(w.id)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="px-5 pb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-fg-muted">{t('wrk.workDays')}</span>
                        <span className="text-xs font-medium tnum">{w.workDays}/{monthDays}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="w-7 h-7 rounded-md border border-border hover:bg-surface flex items-center justify-center transition"
                          onClick={() => adjustDays(w, -1)}
                          title="-1"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-fg transition-all"
                            style={{ width: `${Math.min(100, (w.workDays / monthDays) * 100)}%` }}
                          />
                        </div>
                        <button
                          className="w-7 h-7 rounded-md border border-border hover:bg-surface flex items-center justify-center transition"
                          onClick={() => adjustDays(w, 1)}
                          title="+1"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          className="px-2 h-7 rounded-md border border-border hover:bg-surface flex items-center justify-center gap-1 text-xs transition"
                          onClick={() => markAttendance(w)}
                          title={t('wrk.attendanceToday')}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {t('wrk.attendanceToday')}
                        </button>
                      </div>
                    </div>

                    <dl className="grid grid-cols-3 border-t border-border">
                      <div className="px-4 py-3 border-r border-border">
                        <dt className="text-xs text-fg-muted">{t('wrk.bonus')}</dt>
                        <dd className="text-sm font-semibold text-positive tnum mt-0.5">{formatUZS(w.bonus)}</dd>
                      </div>
                      <div className="px-4 py-3 border-r border-border">
                        <dt className="text-xs text-fg-muted">{t('wrk.penalty')}</dt>
                        <dd className="text-sm font-semibold text-negative tnum mt-0.5">{formatUZS(w.penalty)}</dd>
                      </div>
                      <div className="px-4 py-3">
                        <dt className="text-xs text-fg-muted">{t('wrk.advance')}</dt>
                        <dd className="text-sm font-semibold tnum mt-0.5">{formatUZS(w.advance)}</dd>
                      </div>
                    </dl>

                    <div className="px-5 py-4 bg-surface border-t border-border flex items-center justify-between">
                      <span className="text-xs font-medium text-fg-muted">{t('wrk.payDue')}</span>
                      <span
                        className={cn(
                          'text-xl font-semibold tnum',
                          due < 0 && 'text-negative',
                        )}
                        title={due < 0 ? t('wrk.overpaidHint') : undefined}
                      >
                        {formatUZS(Math.abs(due))}
                        {due < 0 ? ' −' : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 border-t border-border">
                      <button
                        className="px-3 py-3 text-xs font-medium hover:bg-surface transition border-r border-border"
                        onClick={() => { setBonusFor(w); setBonusAmount(0); }}
                      >
                        + {t('wrk.bonus')}
                      </button>
                      <button
                        className="px-3 py-3 text-xs font-medium hover:bg-surface transition border-r border-border"
                        onClick={() => { setPenaltyFor(w); setPenaltyAmount(0); }}
                      >
                        + {t('wrk.penalty')}
                      </button>
                      <button
                        className="px-3 py-3 text-xs font-medium bg-fg text-bg hover:opacity-90 transition"
                        onClick={() => {
                          setPayFor(w);
                          // Default to 0 if balance is negative (already overpaid)
                          setPayAmount(Math.max(0, due));
                          setPayType('naqd');
                          setPayNote('');
                        }}
                      >
                        {t('wrk.pay')}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
          )}

          {/* New worker */}
          <Modal
            open={newOpen}
            onClose={() => setNewOpen(false)}
            title={t('wrk.newTitle')}
            size="md"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setNewOpen(false)} disabled={addWorker.isPending}>
                  {t('common.cancel')}
                </button>
                <button className="btn-primary" onClick={addNewWorker} disabled={addWorker.isPending}>
                  {addWorker.isPending ? '…' : t('common.save')}
                </button>
              </>
            }
          >
            <Field label={t('common.customer')}>
              <input
                className="input"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                placeholder="Bekzod Aliyev"
              />
            </Field>
            <Field label={t('wrk.salary')} hint="UZS / oy">
              <MoneyInput
                min={1}
                value={salary}
                onChange={setSalary}
                placeholder="3 000 000"
              />
            </Field>
          </Modal>

          <Modal
            open={!!bonusFor}
            onClose={() => setBonusFor(null)}
            title={t('wrk.bonusTitle')}
            size="md"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setBonusFor(null)}>{t('common.cancel')}</button>
                <button className="btn-primary" onClick={saveBonus}>{t('common.save')}</button>
              </>
            }
          >
            {bonusFor && <div className="text-sm text-fg-muted">{bonusFor.name}</div>}
            <Field label={t('common.amount')}>
              <MoneyInput value={bonusAmount} onChange={setBonusAmount} placeholder="0" />
            </Field>
          </Modal>

          <Modal
            open={!!penaltyFor}
            onClose={() => setPenaltyFor(null)}
            title={t('wrk.penaltyTitle')}
            size="md"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setPenaltyFor(null)}>{t('common.cancel')}</button>
                <button className="btn-primary" onClick={savePenalty}>{t('common.save')}</button>
              </>
            }
          >
            {penaltyFor && <div className="text-sm text-fg-muted">{penaltyFor.name}</div>}
            <Field label={t('common.amount')}>
              <MoneyInput value={penaltyAmount} onChange={setPenaltyAmount} placeholder="0" />
            </Field>
          </Modal>

          <Modal
            open={advanceOpen}
            onClose={() => setAdvanceOpen(false)}
            title={t('wrk.advanceTitle')}
            size="md"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setAdvanceOpen(false)}>{t('common.cancel')}</button>
                <button className="btn-primary" onClick={saveAdvance}>{t('common.save')}</button>
              </>
            }
          >
            <Field label={t('wrk.pickWorker')}>
              <Select
                value={advanceWorkerId}
                onChange={setAdvanceWorkerId}
                placeholder={t('wrk.pickWorker')}
                options={workers.map(w => ({
                  value: w.id,
                  label: w.name,
                  hint: formatUZS(w.monthlySalary),
                }))}
              />
            </Field>
            <Field label={t('common.amount')}>
              <MoneyInput value={advanceAmount} onChange={setAdvanceAmount} placeholder="0" />
            </Field>
          </Modal>

          <Modal
            open={!!payFor}
            onClose={() => setPayFor(null)}
            title={t('wrk.payTitle')}
            size="md"
            footer={
              <>
                <button className="btn-secondary" onClick={() => setPayFor(null)}>{t('common.cancel')}</button>
                <button className="btn-primary" onClick={savePayment}>{t('common.save')}</button>
              </>
            }
          >
            {payFor && (() => {
              const payDue = workerPayoutDue(payFor);
              return (
              <>
                <div className="bg-surface border border-border rounded-lg p-3">
                  <div className="text-xs text-fg-muted">{t('wrk.amountDue')}</div>
                  <div className={cn(
                    'text-2xl font-semibold tnum mt-0.5',
                    payDue < 0 && 'text-negative',
                  )}>
                    {payDue < 0 ? '−' : ''}{formatUZS(Math.abs(payDue))}
                  </div>
                  {payDue < 0 && (
                    <div className="text-xs text-negative mt-1">{t('wrk.overpaidHint')}</div>
                  )}
                </div>
                <Field label={t('wrk.paymentAmount')}>
                  <MoneyInput value={payAmount} onChange={setPayAmount} placeholder="0" />
                </Field>
                <Field label={t('common.paymentType')}>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PAYMENT_TYPES.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPayType(p)}
                        className={cn(
                          'py-2 rounded-lg border text-sm font-medium transition',
                          payType === p ? 'bg-fg text-bg border-fg' : 'bg-bg border-border text-fg-muted hover:text-fg hover:bg-surface',
                        )}
                      >
                        {t(`payment.${p}` as TranslationKey)}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={t('common.note')}>
                  <textarea className="input" value={payNote} onChange={e => setPayNote(e.target.value)} />
                </Field>
              </>
              );
            })()}
          </Modal>

          <Modal
            open={!!viewFor}
            onClose={() => setViewFor(null)}
            title={t('wrk.viewTitle')}
            footer={<button className="btn-secondary" onClick={() => setViewFor(null)}>{t('common.close')}</button>}
          >
            {viewFor && (
              <>
                <div>
                  <div className="text-xs text-fg-muted">{t('common.customer')}</div>
                  <div className="text-lg font-semibold mt-0.5">{viewFor.name}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface border border-border rounded-lg p-3">
                    <div className="text-xs text-fg-muted">{t('wrk.salary')}</div>
                    <div className="text-sm font-semibold tnum mt-0.5">{formatUZS(viewFor.monthlySalary)}</div>
                  </div>
                  <div className="bg-surface border border-border rounded-lg p-3">
                    <div className="text-xs text-fg-muted">{t('wrk.workDays')}</div>
                    <div className="text-sm font-semibold tnum mt-0.5">{viewFor.workDays}/{monthDays}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-fg-muted mb-2">{t('wrk.history')}</div>
                  {viewFor.paymentHistory.length === 0 ? (
                    <p className="text-sm text-fg-subtle">{t('common.empty')}</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                      {viewFor.paymentHistory.slice(0, 10).map(p => (
                        <li key={p.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2">
                          <div>
                            <div className="text-sm font-semibold tnum">{formatUZS(p.amount)}</div>
                            <div className="text-xs text-fg-muted">{fmtDate(p.date)} · {t(`payment.${p.paymentType}` as TranslationKey)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] text-fg-subtle">
                              {p.snapshot.workDays}d · b{p.snapshot.bonus} · p{p.snapshot.penalty}
                            </div>
                            <button
                              className="btn-ghost !p-1.5"
                              onClick={() => setPayslipFor({ worker: viewFor, payment: p })}
                              title={t('common.payslip')}
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </Modal>

          <ConfirmDialog open={!!confirmDel} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />

          <PrintableSlip
            open={!!payslipFor}
            onClose={() => setPayslipFor(null)}
            title={t('common.payslip')}
          >
            {payslipFor && (
              <div>
                <div className="text-center mb-4">
                  <div className="font-sans text-base font-bold">ProTrack</div>
                  <div className="text-xs">{t('common.payslip')} · {fmtDate(payslipFor.payment.date)}</div>
                </div>
                <div className="border-t border-b border-dashed border-fg py-2 mb-3 space-y-0.5 text-xs">
                  <div className="flex justify-between">
                    <span>{t('common.customer')}</span>
                    <span className="font-semibold">{payslipFor.worker.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('wrk.salary')}</span>
                    <span>{formatUZS(payslipFor.payment.snapshot.salary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('wrk.workDays')}</span>
                    <span>{payslipFor.payment.snapshot.workDays} / {monthDays}</span>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>{t('wrk.bonus')}</span>
                    <span className="text-positive">+{formatUZS(payslipFor.payment.snapshot.bonus)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('wrk.penalty')}</span>
                    <span className="text-negative">−{formatUZS(payslipFor.payment.snapshot.penalty)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('wrk.advance')}</span>
                    <span>−{formatUZS(payslipFor.payment.snapshot.advance)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-fg flex justify-between text-sm font-bold">
                  <span>{t('wrk.payDue')}</span>
                  <span>{formatUZS(payslipFor.payment.amount)}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs">
                  <span>{t('common.paymentType')}</span>
                  <span>{t(`payment.${payslipFor.payment.paymentType}` as TranslationKey)}</span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 text-[10px] text-center">
                  <div>
                    <div className="border-b border-fg pb-1 mb-1">_____________</div>
                    <div>{t('common.customer')}</div>
                  </div>
                  <div>
                    <div className="border-b border-fg pb-1 mb-1">_____________</div>
                    <div>{t('role.admin')}</div>
                  </div>
                </div>
              </div>
            )}
          </PrintableSlip>
        </>
      )}
    </Layout>
  );
}
