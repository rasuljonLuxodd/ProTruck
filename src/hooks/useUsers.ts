import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { User } from '@/types';

const KEY = ['users'] as const;

export function useUsers() {
  const repo = useRepository();
  return useQuery({ queryKey: KEY, queryFn: () => repo.listUsers() });
}

export function useAddUser() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<User, 'id' | 'createdAt'>) => repo.addUser(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateUser() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<User> }) => repo.updateUser(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteUser() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
