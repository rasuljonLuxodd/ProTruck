import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/data/supabaseClient';
import type {
  PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus,
} from '@/types';

const KEY = ['purchaseOrders'] as const;

interface PoRow {
  id: string;
  number: string;
  supplier_id: string | null;
  status: PurchaseOrderStatus;
  expected_at: string | null;
  note: string | null;
  created_at: string;
  ordered_at: string | null;
  received_at: string | null;
}
interface PoItemRow {
  id: string;
  po_id: string;
  product_id: string;
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
  note: string | null;
}

/**
 * Pull every PO with its items in one round-trip plus a small batch
 * fetch for supplier + product names (denormalized into the in-memory
 * objects so the UI doesn't need to JOIN on its own).
 */
export function usePurchaseOrders() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<PurchaseOrder[]> => {
      const { data: orders, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (orders ?? []) as PoRow[];
      if (rows.length === 0) return [];

      const poIds = rows.map(r => r.id);
      const { data: items } = await supabase
        .from('purchase_order_items')
        .select('*')
        .in('po_id', poIds);

      // Lookup names so the UI is self-sufficient
      const supplierIds = [...new Set(rows.map(r => r.supplier_id).filter((x): x is string => !!x))];
      const productIds  = [...new Set((items ?? []).map(i => i.product_id))];
      const [supRes, prodRes] = await Promise.all([
        supplierIds.length > 0
          ? supabase.from('suppliers').select('id,name').in('id', supplierIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
        productIds.length > 0
          ? supabase.from('products').select('id,name').in('id', productIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      ]);
      const supName = new Map((supRes.data ?? []).map(s => [s.id, s.name] as const));
      const prodName = new Map((prodRes.data ?? []).map(p => [p.id, p.name] as const));

      const itemsByPo = new Map<string, PurchaseOrderItem[]>();
      for (const r of (items ?? []) as PoItemRow[]) {
        const it: PurchaseOrderItem = {
          id: r.id,
          poId: r.po_id,
          productId: r.product_id,
          productName: prodName.get(r.product_id),
          orderedQty: Number(r.ordered_qty),
          receivedQty: Number(r.received_qty),
          unitCost: Number(r.unit_cost),
          note: r.note ?? undefined,
        };
        const arr = itemsByPo.get(r.po_id) ?? [];
        arr.push(it);
        itemsByPo.set(r.po_id, arr);
      }

      return rows.map(r => ({
        id: r.id,
        number: r.number,
        supplierId: r.supplier_id ?? undefined,
        supplierName: r.supplier_id ? supName.get(r.supplier_id) : undefined,
        status: r.status,
        expectedAt: r.expected_at ?? undefined,
        note: r.note ?? undefined,
        createdAt: r.created_at,
        orderedAt: r.ordered_at ?? undefined,
        receivedAt: r.received_at ?? undefined,
        items: itemsByPo.get(r.id) ?? [],
      }));
    },
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      supplierId?: string;
      expectedAt?: string;
      note?: string;
      items: Array<{ productId: string; orderedQty: number; unitCost: number }>;
    }) => {
      const { data: po, error } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: input.supplierId ?? null,
          expected_at: input.expectedAt ?? null,
          note: input.note ?? null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      const poId = (po as PoRow).id;
      if (input.items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('purchase_order_items')
          .insert(input.items.map(i => ({
            po_id: poId,
            product_id: i.productId,
            ordered_qty: i.orderedQty,
            unit_cost: i.unitCost,
          })));
        if (itemsErr) throw new Error(itemsErr.message);
      }
      return poId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdatePoStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: PurchaseOrderStatus }) => {
      const payload: Record<string, unknown> = { status: input.status };
      if (input.status === 'ordered') payload.ordered_at = new Date().toISOString();
      if (input.status === 'received') payload.received_at = new Date().toISOString();
      const { error } = await supabase.from('purchase_orders').update(payload).eq('id', input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useReceivePoItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { poId: string; items: Array<{ poItemId: string; qty: number }> }) => {
      const payload = input.items
        .filter(i => i.qty > 0)
        .map(i => ({ po_item_id: i.poItemId, qty: i.qty }));
      if (payload.length === 0) return;
      const { error } = await supabase.rpc('receive_purchase_order_items', {
        p_po_id: input.poId,
        p_items: payload,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
