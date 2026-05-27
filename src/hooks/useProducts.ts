import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import { useActiveLocationId } from '@/state/LocationProvider';
import type { Product } from '@/types';

const KEY = ['products'] as const;

export function useProducts() {
  const repo = useRepository();
  const locationId = useActiveLocationId();
  return useQuery({
    // Bucket the cache per-location so switching locations doesn't show
    // the previous location's data flicker through.
    queryKey: [...KEY, locationId] as const,
    queryFn: () => repo.listProducts({ locationId }),
    enabled: !!locationId,
  });
}

export function useAddProduct() {
  const repo = useRepository();
  const qc = useQueryClient();
  const locationId = useActiveLocationId();
  return useMutation({
    mutationFn: (input: Omit<Product, 'id' | 'createdAt' | 'lastUpdated'>) =>
      repo.addProduct({ ...input, locationId: locationId ?? undefined }),
    onMutate: async input => {
      // Optimistically prepend a placeholder row so the table updates instantly.
      const scopedKey = [...KEY, locationId] as const;
      await qc.cancelQueries({ queryKey: scopedKey });
      const previous = qc.getQueryData<Product[]>(scopedKey);
      const placeholder: Product = {
        id: `optimistic-${crypto.randomUUID()}`,
        name: input.name,
        stock: input.stock,
        minStock: input.minStock ?? 10,
        vatRate: input.vatRate ?? 0,
        cost: input.cost ?? 0,
        defaultPrice: input.defaultPrice,
        imageUrl: input.imageUrl,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      qc.setQueryData<Product[]>(scopedKey, prev => [placeholder, ...(prev ?? [])]);
      return { previous, scopedKey };
    },
    onError: (_err, _input, ctx) => {
      // Roll back the optimistic insert.
      if (ctx?.previous && ctx?.scopedKey) qc.setQueryData(ctx.scopedKey, ctx.previous);
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
