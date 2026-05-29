import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/supabaseClient';
import type { Supplier } from '@/types';

const KEY = ['suppliers'] as const;

export function useSuppliers() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Supplier[]> => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map(r => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        note: r.note ?? undefined,
        createdAt: r.created_at,
      }));
    },
  });
}

export function useAddSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; phone?: string; note?: string }): Promise<Supplier> => {
      const { data, error } = await supabase.from('suppliers').insert({
        name: input.name.trim(),
        phone: input.phone ?? '',
        note: input.note ?? null,
      }).select().single();
      if (error) throw new Error(error.message);
      return {
        id: data.id,
        name: data.name,
        phone: data.phone,
        note: data.note ?? undefined,
        createdAt: data.created_at,
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
