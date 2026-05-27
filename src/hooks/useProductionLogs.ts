import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import { useActiveLocationId } from '@/state/LocationProvider';
import type { ProductionLog } from '@/types';

const KEY = ['productionLogs'] as const;

export function useProductionLogs() {
  const repo = useRepository();
  const locationId = useActiveLocationId();
  return useQuery({
    queryKey: [...KEY, locationId] as const,
    queryFn: () => repo.listProductionLogs({ locationId }),
    enabled: !!locationId,
  });
}

export function useAddProductionLog() {
  const repo = useRepository();
  const qc = useQueryClient();
  const locationId = useActiveLocationId();
  return useMutation({
    mutationFn: (input: Omit<ProductionLog, 'id'>) =>
      repo.addProductionLog({ ...input, locationId: locationId ?? undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['actionLogs'] });
    },
  });
}
