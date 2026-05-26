import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { ActionLog } from '@/types';

const KEY = ['actionLogs'] as const;

export function useActionLogs() {
  const repo = useRepository();
  return useQuery({ queryKey: KEY, queryFn: () => repo.listActionLogs() });
}

export function useAddActionLog() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ActionLog, 'id'>) => repo.addActionLog(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
