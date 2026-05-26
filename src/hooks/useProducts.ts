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
    onMutate: async input => {
      // Optimistically prepend a placeholder row so the table updates instantly.
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<Product[]>(KEY);
      const placeholder: Product = {
        id: `optimistic-${crypto.randomUUID()}`,
        name: input.name,
        stock: input.stock,
        minStock: input.minStock ?? 10,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      qc.setQueryData<Product[]>(KEY, prev => [placeholder, ...(prev ?? [])]);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      // Roll back the optimistic insert.
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
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
