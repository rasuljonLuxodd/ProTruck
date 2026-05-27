import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { ActionLog } from '@/types';

const KEY = ['actionLogs'] as const;

export function useActionLogs(limit?: number) {
  const repo = useRepository();
  return useQuery({
    queryKey: limit ? (['actionLogs', limit] as const) : KEY,
    queryFn: () => repo.listActionLogs(limit),
  });
}

export function useAddActionLog() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ActionLog, 'id'>) => repo.addActionLog(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
