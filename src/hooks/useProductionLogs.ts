import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { ProductionLog } from '@/types';

const KEY = ['productionLogs'] as const;

export function useProductionLogs() {
  const repo = useRepository();
  return useQuery({ queryKey: KEY, queryFn: () => repo.listProductionLogs() });
}

export function useAddProductionLog() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ProductionLog, 'id'>) => repo.addProductionLog(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['actionLogs'] });
    },
  });
}
