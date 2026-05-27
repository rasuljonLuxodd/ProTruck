import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import { useActiveLocationId } from '@/state/LocationProvider';
import type { Expense } from '@/types';

const KEY = ['expenses'] as const;

export function useExpenses() {
  const repo = useRepository();
  const locationId = useActiveLocationId();
  return useQuery({
    queryKey: [...KEY, locationId] as const,
    queryFn: () => repo.listExpenses({ locationId }),
    enabled: !!locationId,
  });
}

export function useAddExpense() {
  const repo = useRepository();
  const qc = useQueryClient();
  const locationId = useActiveLocationId();
  return useMutation({
    mutationFn: (input: Omit<Expense, 'id'> & { accountId?: string }) =>
      repo.addExpense({ ...input, locationId: locationId ?? undefined }),
    onMutate: async input => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<Expense[]>(KEY);
      const placeholder: Expense = { ...input, id: `optimistic-${crypto.randomUUID()}` };
      qc.setQueryData<Expense[]>(KEY, prev => [placeholder, ...(prev ?? [])]);
      return { previous };
    },
    onError: (_e, _i, ctx) => { if (ctx?.previous) qc.setQueryData(KEY, ctx.previous); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['actionLogs'] });
    },
  });
}

export function useUpdateExpense() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Expense> }) => repo.updateExpense(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteExpense() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
