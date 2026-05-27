import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/supabaseClient';
import type { CustomerCreditLimit } from '@/types';

const KEY = ['creditLimits'] as const;

/**
 * Customer credit limits + notes. Stored in `customer_credit_limits` on
 * Supabase. Indexed by `name_key` (lower-cased name) so we can match
 * free-form customer names from sales without requiring a normalized
 * customer entity. The `notes` column is the closest thing we have to
 * a customer-profile freetext field today.
 */
export function useCreditLimits() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<CustomerCreditLimit[]> => {
      const { data, error } = await supabase
        .from('customer_credit_limits')
        .select('*');
      if (error) throw new Error(error.message);
      return (data ?? []).map(r => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        maxDebt: Number(r.max_debt),
        notes: r.notes ?? undefined,
      }));
    },
  });
}

export function useSetCreditLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      phone: string;
      maxDebt: number;
      notes?: string;
    }) => {
      const key = input.name.trim().toLowerCase();
      const { error } = await supabase
        .from('customer_credit_limits')
        .upsert(
          {
            name_key: key,
            name: input.name.trim(),
            phone: input.phone,
            max_debt: input.maxDebt,
            // Only set notes if explicitly provided — undefined keeps the
            // existing value rather than overwriting with NULL.
            ...(input.notes !== undefined && { notes: input.notes || null }),
          },
          { onConflict: 'name_key' },
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/**
 * Save just the notes for a customer (used when the user types into the
 * notes textarea on the profile page). Creates a credit-limit row with
 * maxDebt = 0 if the customer doesn't have one yet.
 */
export function useSetCustomerNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; phone: string; notes: string }) => {
      const key = input.name.trim().toLowerCase();
      // First check if a row exists so we preserve existing maxDebt
      const { data: existing } = await supabase
        .from('customer_credit_limits')
        .select('max_debt')
        .eq('name_key', key)
        .maybeSingle();
      const { error } = await supabase
        .from('customer_credit_limits')
        .upsert(
          {
            name_key: key,
            name: input.name.trim(),
            phone: input.phone,
            max_debt: existing?.max_debt ?? 0,
            notes: input.notes || null,
          },
          { onConflict: 'name_key' },
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
