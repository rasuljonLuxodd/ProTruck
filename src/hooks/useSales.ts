import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import { useActiveLocationId } from '@/state/LocationProvider';
import type { CartItem, PaymentType, Sale } from '@/types';

const KEY = ['sales'] as const;

export function useSales() {
  const repo = useRepository();
  const locationId = useActiveLocationId();
  return useQuery({
    queryKey: [...KEY, locationId] as const,
    queryFn: () => repo.listSales({ locationId }),
    enabled: !!locationId,
  });
}

export function useAddSale() {
  const repo = useRepository();
  const qc = useQueryClient();
  const locationId = useActiveLocationId();
  return useMutation({
    mutationFn: (input: Omit<Sale, 'id'>) =>
      repo.addSale({ ...input, locationId: locationId ?? undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['debts'] });
      qc.invalidateQueries({ queryKey: ['actionLogs'] });
    },
  });
}

export interface ExecuteSaleInput {
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  paymentType: PaymentType;
  cashPart?: number;
  debtPart?: number;
  note?: string;
  date: string;
  accountId?: string;
}

export function useExecuteSale() {
  const repo = useRepository();
  const qc = useQueryClient();
  const locationId = useActiveLocationId();
  return useMutation({
    mutationFn: (input: ExecuteSaleInput) =>
      repo.executeSale({ ...input, locationId: locationId ?? undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['debts'] });
      qc.invalidateQueries({ queryKey: ['actionLogs'] });
    },
  });
}

export function useDeleteSale() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteSale(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRefundSale() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.refundSale(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['debts'] });
      qc.invalidateQueries({ queryKey: ['actionLogs'] });
    },
  });
}
