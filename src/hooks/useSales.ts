import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { CartItem, PaymentType, Sale } from '@/types';

const KEY = ['sales'] as const;

export function useSales() {
  const repo = useRepository();
  return useQuery({ queryKey: KEY, queryFn: () => repo.listSales() });
}

export function useAddSale() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Sale, 'id'>) => repo.addSale(input),
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
}

export function useExecuteSale() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExecuteSaleInput) => repo.executeSale(input),
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
