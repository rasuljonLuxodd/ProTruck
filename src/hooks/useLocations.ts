import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/supabaseClient';
import type { Location } from '@/types';

const KEY = ['locations'] as const;

interface LocationRow {
  id: string;
  name: string;
  short_code: string | null;
  address: string | null;
  phone: string | null;
  is_default: boolean;
  archived: boolean;
  note: string | null;
  created_at: string;
}
const mapLocation = (r: LocationRow): Location => ({
  id: r.id,
  name: r.name,
  shortCode: r.short_code ?? undefined,
  address: r.address ?? undefined,
  phone: r.phone ?? undefined,
  isDefault: r.is_default,
  archived: r.archived,
  note: r.note ?? undefined,
  createdAt: r.created_at,
});

export function useLocations(includeArchived = false) {
  return useQuery({
    queryKey: [...KEY, { includeArchived }] as const,
    queryFn: async (): Promise<Location[]> => {
      let q = supabase.from('locations').select('*').order('created_at');
      if (!includeArchived) q = q.eq('archived', false);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapLocation);
    },
  });
}

export function useAddLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Location, 'id' | 'createdAt' | 'archived'>) => {
      const { data, error } = await supabase
        .from('locations')
        .insert({
          name: input.name,
          short_code: input.shortCode ?? null,
          address: input.address ?? null,
          phone: input.phone ?? null,
          is_default: input.isDefault,
          note: input.note ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapLocation(data as LocationRow);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Location> }) => {
      const payload: Record<string, unknown> = {};
      if (input.patch.name !== undefined) payload.name = input.patch.name;
      if (input.patch.shortCode !== undefined) payload.short_code = input.patch.shortCode || null;
      if (input.patch.address !== undefined) payload.address = input.patch.address || null;
      if (input.patch.phone !== undefined) payload.phone = input.patch.phone || null;
      if (input.patch.isDefault !== undefined) payload.is_default = input.patch.isDefault;
      if (input.patch.archived !== undefined) payload.archived = input.patch.archived;
      if (input.patch.note !== undefined) payload.note = input.patch.note || null;
      const { error } = await supabase.from('locations').update(payload).eq('id', input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
