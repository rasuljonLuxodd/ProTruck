import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from '@/data/RepositoryProvider';
import type { User } from '@/types';

const KEY = ['users'] as const;

export function useUsers() {
  const repo = useRepository();
  return useQuery({ queryKey: KEY, queryFn: () => repo.listUsers() });
}

// Note: useAddUser was removed — the Supabase repo's addUser throws because
// creating a real account requires Supabase Auth. Use `useAuth().createUser`
// from `@/auth/AuthProvider` instead.

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
