import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/supabaseClient';
import type { Account, AccountBalance, AccountTransfer, Currency } from '@/types';

const ACCOUNTS_KEY = ['accounts'] as const;
const BALANCES_KEY = ['accountBalances'] as const;
const TRANSFERS_KEY = ['accountTransfers'] as const;

interface AccountRow {
  id: string;
  name: string;
  kind: Account['kind'];
  currency: string;
  opening_balance: number;
  is_default: boolean;
  archived: boolean;
  note: string | null;
  created_at: string;
}
const mapAccount = (r: AccountRow): Account => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  currency: r.currency as Currency,
  openingBalance: Number(r.opening_balance),
  isDefault: r.is_default,
  archived: r.archived,
  note: r.note ?? undefined,
  createdAt: r.created_at,
});

export function useAccounts(includeArchived = false) {
  return useQuery({
    queryKey: [...ACCOUNTS_KEY, { includeArchived }] as const,
    queryFn: async (): Promise<Account[]> => {
      let q = supabase.from('accounts').select('*').order('created_at');
      if (!includeArchived) q = q.eq('archived', false);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapAccount);
    },
  });
}

export function useAccountBalances() {
  return useQuery({
    queryKey: BALANCES_KEY,
    queryFn: async (): Promise<AccountBalance[]> => {
      const { data, error } = await supabase
        .from('account_balances')
        .select('*')
        .order('name');
      if (error) throw new Error(error.message);
      return (data ?? []).map(r => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        currency: r.currency as Currency,
        openingBalance: Number(r.opening_balance),
        balance: Number(r.balance),
      }));
    },
  });
}

export function useAddAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Account, 'id' | 'createdAt' | 'archived'>) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          name: input.name,
          kind: input.kind,
          currency: input.currency,
          opening_balance: input.openingBalance,
          is_default: input.isDefault,
          note: input.note ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapAccount(data as AccountRow);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
      qc.invalidateQueries({ queryKey: BALANCES_KEY });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Account> }) => {
      const payload: Record<string, unknown> = {};
      if (input.patch.name !== undefined) payload.name = input.patch.name;
      if (input.patch.kind !== undefined) payload.kind = input.patch.kind;
      if (input.patch.openingBalance !== undefined) payload.opening_balance = input.patch.openingBalance;
      if (input.patch.isDefault !== undefined) payload.is_default = input.patch.isDefault;
      if (input.patch.archived !== undefined) payload.archived = input.patch.archived;
      if (input.patch.note !== undefined) payload.note = input.patch.note || null;
      const { error } = await supabase.from('accounts').update(payload).eq('id', input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACCOUNTS_KEY });
      qc.invalidateQueries({ queryKey: BALANCES_KEY });
    },
  });
}

export function useAddTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<AccountTransfer, 'id' | 'createdAt'>) => {
      const { error } = await supabase.from('account_transfers').insert({
        from_account_id: input.fromAccountId,
        to_account_id: input.toAccountId,
        amount: input.amount,
        note: input.note ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRANSFERS_KEY });
      qc.invalidateQueries({ queryKey: BALANCES_KEY });
    },
  });
}
