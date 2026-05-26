import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { Expense } from '@/types';

const KEY = ['expenses'] as const;

export function useExpenses() {
  const repo = useRepository();
  return useQuery({ queryKey: KEY, queryFn: () => repo.listExpenses() });
}

export function useAddExpense() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Expense, 'id'>) => repo.addExpense(input),
    onSuccess: () => {
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
