import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { RecurringExpense } from '@/types';

const KEY = ['recurringExpenses'] as const;

export function useRecurringExpenses() {
  const repo = useRepository();
  return useQuery({ queryKey: KEY, queryFn: () => repo.listRecurringExpenses() });
}

export function useAddRecurringExpense() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<RecurringExpense, 'id' | 'createdAt' | 'lastRunAt'>) =>
      repo.addRecurringExpense(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateRecurringExpense() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<RecurringExpense> }) =>
      repo.updateRecurringExpense(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteRecurringExpense() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteRecurringExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
