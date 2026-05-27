import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { BomItem } from '@/types';

const key = (productId: string) => ['bomItems', productId] as const;

/**
 * Read the BOM rows for a single finished product. Returns the empty
 * array if the product has no recipe yet, which lets callers treat
 * "no BOM" and "no rows yet" identically.
 */
export function useBomItems(productId: string | null | undefined) {
  const repo = useRepository();
  return useQuery({
    queryKey: productId ? key(productId) : ['bomItems', '__none__'],
    queryFn: () => (productId ? repo.listBomItems(productId) : Promise.resolve([])),
    enabled: !!productId,
  });
}

export function useUpsertBomItem() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<BomItem, 'id' | 'createdAt'>) => repo.upsertBomItem(input),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: key(item.productId) });
    },
  });
}

export function useDeleteBomItem(productId: string) {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteBomItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(productId) });
    },
  });
}

export function useProduceWithBom() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, quantity, date }: { productId: string; quantity: number; date?: string }) =>
      repo.produceWithBom(productId, quantity, date),
    onSuccess: () => {
      // Both products (stock changed) and production logs are now stale
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['productionLogs'] });
    },
  });
}
