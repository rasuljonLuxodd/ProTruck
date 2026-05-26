import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { Debt, DebtPayment } from '@/types';

const KEY = ['debts'] as const;

export function useDebts() {
  const repo = useRepository();
  return useQuery({ queryKey: KEY, queryFn: () => repo.listDebts() });
}

export function useAddDebt() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Debt, 'id' | 'payments' | 'originalAmount'> & { originalAmount?: number }) =>
      repo.addDebt(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function usePayDebtPartial() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payment }: { id: string; payment: DebtPayment }) => repo.payDebtPartial(id, payment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['actionLogs'] });
    },
  });
}

export function usePayDebtFull() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.payDebtFull(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['actionLogs'] });
    },
  });
}

export function useDeleteDebt() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteDebt(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
