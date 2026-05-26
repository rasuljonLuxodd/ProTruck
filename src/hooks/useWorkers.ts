import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { Worker, WorkerPayment } from '@/types';

const KEY = ['workers'] as const;

export function useWorkers() {
  const repo = useRepository();
  return useQuery({ queryKey: KEY, queryFn: () => repo.listWorkers() });
}

export function useAddWorker() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; monthlySalary: number }) => repo.addWorker(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateWorker() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Worker> }) => repo.updateWorker(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteWorker() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteWorker(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function usePayWorker() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payment }: { id: string; payment: Omit<WorkerPayment, 'id' | 'workerId'> }) =>
      repo.payWorker(id, payment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['actionLogs'] });
    },
  });
}
