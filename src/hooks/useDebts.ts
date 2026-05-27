import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import { useActiveLocationId } from '@/state/LocationProvider';
import type { Debt, DebtPayment } from '@/types';

const KEY = ['debts'] as const;

export function useDebts() {
  const repo = useRepository();
  const locationId = useActiveLocationId();
  return useQuery({
    queryKey: [...KEY, locationId] as const,
    queryFn: () => repo.listDebts({ locationId }),
    enabled: !!locationId,
  });
}

export function useAddDebt() {
  const repo = useRepository();
  const qc = useQueryClient();
  const locationId = useActiveLocationId();
  return useMutation({
    mutationFn: (input: Omit<Debt, 'id' | 'payments' | 'originalAmount'> & { originalAmount?: number }) =>
      repo.addDebt({ ...input, locationId: locationId ?? undefined }),
    onMutate: async input => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<Debt[]>(KEY);
      const placeholder: Debt = {
        ...input,
        id: `optimistic-${crypto.randomUUID()}`,
        originalAmount: input.originalAmount ?? input.amount,
        payments: [],
      };
      qc.setQueryData<Debt[]>(KEY, prev => [placeholder, ...(prev ?? [])]);
      return { previous };
    },
    onError: (_e, _i, ctx) => { if (ctx?.previous) qc.setQueryData(KEY, ctx.previous); },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
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
