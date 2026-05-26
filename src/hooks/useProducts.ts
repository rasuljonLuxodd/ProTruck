import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { Product } from '@/types';

const KEY = ['products'] as const;

export function useProducts() {
  const repo = useRepository();
  return useQuery({
    queryKey: KEY,
    queryFn: () => repo.listProducts(),
  });
}

export function useAddProduct() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Product, 'id' | 'createdAt' | 'lastUpdated'>) => repo.addProduct(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateProduct() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Product> }) => repo.updateProduct(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteProduct() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
