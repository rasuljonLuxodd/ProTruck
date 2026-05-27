import { useState } from 'react';
import { Wallet, Plus, ArrowLeftRight, Star, Archive } from 'lucide-react';
import { useT } from '@/i18n/LanguageProvider';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Badge } from '@/components/ui/Badge';
import {
  useAccounts, useAccountBalances, useAddAccount, useUpdateAccount, useAddTransfer,
} from '@/hooks/useAccounts';
import { formatUZS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Account, Currency } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

const KINDS: Account['kind'][] = ['cash', 'card', 'bank', 'other'];
const CURRENCIES: Currency[] = ['UZS', 'USD', 'RUB', 'EUR'];

/**
 * Settings → Accounts. Manages cash drawers + bank accounts that
 * sales/expenses/payments can be attributed to.
 *
 * One default per (currency, kind) is enforced at the DB level.
 * Archived accounts disappear from the picker but keep their history.
 */
export function AccountsSection() {
  const t = useT();
  const { toast } = useToast();
  const { data: accounts = [] } = useAccounts(true);
  const { data: balances = [] } = useAccountBalances();
  const add = useAddAccount();
  const upd = useUpdateAccount();
  const transfer = useAddTransfer();

  const [newOpen, setNewOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  // new-account form state
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Account['kind']>('cash');
  const [currency, setCurrency] = useState<Currency>('UZS');
  const [opening, setOpening] = useState(0);
  const [makeDefault, setMakeDefault] = useState(false);

  // transfer form state
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [transferAmt, setTransferAmt] = useState(0);
  const [transferNote, setTransferNote] = useState('');

  const balanceMap = new Map(balances.map(b => [b.id, b.balance] as const));

  function resetNewForm() {
    setName(''); setKind('cash'); setCurrency('UZS'); setOpening(0); setMakeDefault(false);
  }

  function saveNew() {
    if (!name.trim()) {
      toast(t('form.nameRequired'), 'error');
      return;
    }
    add.mutate(
      { name: name.trim(), kind, currency, openingBalance: opening, isDefault: makeDefault },
      {
        onSuccess: () => { toast(t('toast.saved')); setNewOpen(false); resetNewForm(); },
        onError: (err) => toast(err instanceof Error ? err.message : t('toast.error'), 'error'),
      },
    );
  }

  function saveTransfer() {
    if (!fromId || !toId) {
      toast(t('acc.pickBoth'), 'error');
      return;
    }
    if (fromId === toId) {
      toast(t('acc.sameAccount'), 'error');
      return;
    }
    if (transferAmt <= 0) {
      toast(t('form.amountRequired'), 'error');
      return;
    }
    transfer.mutate(
      { fromAccountId: fromId, toAccountId: toId, amount: transferAmt, note: transferNote.trim() || undefined },
      {
        onSuccess: () => {
          toast(t('toast.saved'));
          setTransferOpen(false);
          setFromId(''); setToId(''); setTransferAmt(0); setTransferNote('');
        },
        onError: (err) => toast(err instanceof Error ? err.message : t('toast.error'), 'error'),
      },
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="display text-[24px] leading-none flex items-center gap-2.5">
            <Wallet className="w-5 h-5" />
            {t('acc.title')}
          </h1>
          <p className="text-sm text-fg-muted mt-1.5 max-w-prose leading-relaxed">
            {t('acc.intro')}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            className="btn-secondary"
            onClick={() => setTransferOpen(true)}
            disabled={accounts.filter(a => !a.archived).length < 2}
            title={t('acc.transferCta')}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('acc.transferCta')}</span>
          </button>
          <button className="btn-primary" onClick={() => setNewOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('acc.addCta')}</span>
          </button>
        </div>
      </header>

      {accounts.length === 0 ? (
        <div className="card p-10 text-center text-sm text-fg-subtle">
          {t('acc.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map(a => (
            <div
              key={a.id}
              className={cn(
                'card card-hover p-4 relative',
                a.archived && 'opacity-60',
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{a.name}</span>
                    {a.isDefault && (
                      <Star className="w-3 h-3 text-amber-500" fill="currentColor" />
                    )}
                  </div>
                  <div className="kicker mt-0.5">
                    {t(`acc.kind.${a.kind}` as TranslationKey)}  ·  {a.currency}
                  </div>
                </div>
                {a.archived && <Badge tone="mute">{t('acc.archived')}</Badge>}
              </div>
              <div className="mt-3">
                <div className="text-xs text-fg-muted">{t('acc.balance')}</div>
                <div className="display text-[24px] leading-none mt-1 tnum">
                  {formatUZS(balanceMap.get(a.id) ?? a.openingBalance)}
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-1">
                {!a.archived ? (
                  <button
                    className="text-[10px] text-fg-muted hover:text-fg transition"
                    onClick={() => upd.mutate({ id: a.id, patch: { archived: true } })}
                  >
                    <Archive className="w-3 h-3 inline mr-1" />
                    {t('acc.archive')}
                  </button>
                ) : (
                  <button
                    className="text-[10px] text-fg-muted hover:text-fg transition"
                    onClick={() => upd.mutate({ id: a.id, patch: { archived: false } })}
                  >
                    {t('acc.unarchive')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add account modal */}
      <Modal
        open={newOpen}
        onClose={() => { setNewOpen(false); resetNewForm(); }}
        title={t('acc.addTitle')}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setNewOpen(false); resetNewForm(); }}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" onClick={saveNew} disabled={add.isPending}>
              {add.isPending ? '…' : t('common.save')}
            </button>
          </>
        }
      >
        <Field label={t('acc.name')}>
          <input className="input" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Asosiy kassa" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('acc.kind')}>
            <Select
              value={kind}
              onChange={setKind}
              options={KINDS.map(k => ({ value: k, label: t(`acc.kind.${k}` as TranslationKey) }))}
            />
          </Field>
          <Field label="Currency">
            <Select
              value={currency}
              onChange={setCurrency}
              options={CURRENCIES.map(c => ({ value: c, label: c }))}
            />
          </Field>
        </div>
        <Field label={t('acc.opening')}>
          <MoneyInput value={opening} onChange={setOpening} placeholder="0" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={e => setMakeDefault(e.target.checked)}
          />
          {t('acc.makeDefault')}
        </label>
      </Modal>

      {/* Transfer modal */}
      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title={t('acc.transferTitle')}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setTransferOpen(false)}>{t('common.cancel')}</button>
            <button className="btn-primary" onClick={saveTransfer} disabled={transfer.isPending}>
              {transfer.isPending ? '…' : t('common.save')}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('acc.from')}>
            <Select
              value={fromId}
              onChange={setFromId}
              placeholder={t('common.empty')}
              options={accounts.filter(a => !a.archived).map(a => ({
                value: a.id,
                label: a.name,
                hint: formatUZS(balanceMap.get(a.id) ?? 0),
              }))}
            />
          </Field>
          <Field label={t('acc.to')}>
            <Select
              value={toId}
              onChange={setToId}
              placeholder={t('common.empty')}
              options={accounts.filter(a => !a.archived && a.id !== fromId).map(a => ({
                value: a.id,
                label: a.name,
              }))}
            />
          </Field>
        </div>
        <Field label={t('common.amount')}>
          <MoneyInput value={transferAmt} onChange={setTransferAmt} placeholder="0" />
        </Field>
        <Field label={t('common.note')}>
          <input className="input" value={transferNote} onChange={e => setTransferNote(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
