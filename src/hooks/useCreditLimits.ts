import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/supabaseClient';
import type { CustomerCreditLimit } from '@/types';

const KEY = ['creditLimits'] as const;

/**
 * Customer credit limits. Stored in `customer_credit_limits` on Supabase.
 * Indexed by `name_key` (lower-cased name) so we can match free-form customer
 * names from sales without requiring a normalized customer entity.
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
      }));
    },
  });
}

export function useSetCreditLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; phone: string; maxDebt: number }) => {
      const key = input.name.trim().toLowerCase();
      const { error } = await supabase
        .from('customer_credit_limits')
        .upsert(
          {
            name_key: key,
            name: input.name.trim(),
            phone: input.phone,
            max_debt: input.maxDebt,
          },
          { onConflict: 'name_key' },
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
