import type {
  Product,
  ProductionLog,
  BomItem,
  Sale,
  Debt,
  DebtPayment,
  Expense,
  RecurringExpense,
  Worker,
  WorkerPayment,
  ActionLog,
  User,
  Session,
} from '@/types';
import type { Repository, ListOpts } from './repository';
import { supabase } from './supabaseClient';

// -------- row shapes returned by Supabase (snake_case) --------
interface ProductRow {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  vat_rate: number;
  cost: number;
  default_price: number | null;
  image_url: string | null;
  created_at: string;
  last_updated: string;
}
interface BomItemRow {
  id: string;
  product_id: string;
  input_product_id: string;
  quantity_per_unit: number;
  note: string | null;
  created_at: string;
}
interface ProductionLogRow {
  id: string;
  product_id: string;
  quantity: number;
  date: string;
}
interface SaleRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  items: Sale['items'];
  total: number;
  payment_type: Sale['paymentType'];
  cash_part: number | null;
  debt_part: number | null;
  note: string | null;
  date: string;
}
interface DebtRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  product: string;
  amount: number;
  original_amount: number;
  sale_id: string | null;
  date: string;
  due_date: string | null;
  note: string | null;
}
interface DebtPaymentRow {
  id: string;
  debt_id: string;
  amount: number;
  date: string;
}
interface ExpenseRow {
  id: string;
  category: Expense['category'];
  description: string;
  amount: number;
  payment_type: Expense['paymentType'];
  date: string;
  auto: boolean;
  supplier_id: string | null;
}
interface WorkerRow {
  id: string;
  name: string;
  monthly_salary: number;
  work_days: number;
  bonus: number;
  penalty: number;
  advance: number;
  created_at: string;
}
interface WorkerPaymentRow {
  id: string;
  worker_id: string;
  amount: number;
  payment_type: WorkerPayment['paymentType'];
  note: string | null;
  date: string;
  snapshot: WorkerPayment['snapshot'];
}
interface ActionLogRow {
  id: string;
  type: ActionLog['type'];
  description: string;
  date: string;
  user_id: string | null;
}
interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  created_at: string;
}

// -------- mappers --------
const mapProduct = (r: ProductRow): Product => ({
  id: r.id,
  name: r.name,
  stock: r.stock,
  minStock: r.min_stock ?? 10,
  vatRate: Number(r.vat_rate ?? 0),
  cost: Number(r.cost ?? 0),
  defaultPrice: r.default_price == null ? undefined : Number(r.default_price),
  imageUrl: r.image_url ?? undefined,
  createdAt: r.created_at,
  lastUpdated: r.last_updated,
});

const mapProductionLog = (r: ProductionLogRow): ProductionLog => ({
  id: r.id,
  productId: r.product_id,
  quantity: r.quantity,
  date: r.date,
});

const mapSale = (r: SaleRow): Sale => ({
  id: r.id,
  customerName: r.customer_name,
  customerPhone: r.customer_phone,
  items: r.items,
  total: Number(r.total),
  paymentType: r.payment_type,
  cashPart: r.cash_part ?? undefined,
  debtPart: r.debt_part ?? undefined,
  note: r.note ?? undefined,
  date: r.date,
});

const mapDebt = (r: DebtRow, payments: DebtPayment[]): Debt => ({
  id: r.id,
  customerName: r.customer_name,
  customerPhone: r.customer_phone,
  product: r.product,
  amount: Number(r.amount),
  originalAmount: Number(r.original_amount),
  saleId: r.sale_id ?? undefined,
  date: r.date,
  dueDate: r.due_date ?? undefined,
  note: r.note ?? undefined,
  payments,
});

const mapExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  category: r.category,
  description: r.description,
  amount: Number(r.amount),
  paymentType: r.payment_type,
  date: r.date,
  auto: r.auto,
  supplierId: r.supplier_id ?? undefined,
});

const mapWorkerPayment = (r: WorkerPaymentRow): WorkerPayment => ({
  id: r.id,
  workerId: r.worker_id,
  amount: Number(r.amount),
  paymentType: r.payment_type,
  note: r.note ?? undefined,
  date: r.date,
  snapshot: r.snapshot,
});

const mapWorker = (r: WorkerRow, history: WorkerPayment[]): Worker => ({
  id: r.id,
  name: r.name,
  monthlySalary: Number(r.monthly_salary),
  workDays: r.work_days,
  bonus: Number(r.bonus),
  penalty: Number(r.penalty),
  advance: Number(r.advance),
  paymentHistory: history,
});

const mapAction = (r: ActionLogRow, name?: string): ActionLog => ({
  id: r.id,
  type: r.type,
  description: r.description,
  date: r.date,
  userId: r.user_id ?? undefined,
  userName: name,
});

function throwIfError<T>(data: T | null, error: unknown, label: string): T {
  if (error) {
    const msg = (error as { message?: string }).message ?? String(error);
    throw new Error(`${label}: ${msg}`);
  }
  if (data === null) throw new Error(`${label}: no data returned`);
  return data;
}

export class SupabaseRepository implements Repository {
  // ============== products ==============
  async listProducts(opts?: ListOpts): Promise<Product[]> {
    let q = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (opts?.locationId) q = q.eq('location_id', opts.locationId);
    const { data, error } = await q;
    return throwIfError(data, error, 'listProducts').map(mapProduct);
  }

  async addProduct(input: Omit<Product, 'id' | 'createdAt' | 'lastUpdated'> & { locationId?: string }): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert({
        name: input.name,
        stock: input.stock,
        min_stock: input.minStock ?? 10,
        vat_rate: input.vatRate ?? 0,
        cost: input.cost ?? 0,
        default_price: input.defaultPrice ?? null,
        image_url: input.imageUrl ?? null,
        location_id: input.locationId ?? null,
      })
      .select()
      .single();
    return mapProduct(throwIfError(data, error, 'addProduct'));
  }

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
    const payload: Record<string, unknown> = { last_updated: new Date().toISOString() };
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.stock !== undefined) payload.stock = patch.stock;
    if (patch.minStock !== undefined) payload.min_stock = patch.minStock;
    if (patch.vatRate !== undefined) payload.vat_rate = patch.vatRate;
    if (patch.cost !== undefined) payload.cost = patch.cost;
    if (patch.defaultPrice !== undefined) payload.default_price = patch.defaultPrice ?? null;
    if (patch.imageUrl !== undefined) payload.image_url = patch.imageUrl;

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    return mapProduct(throwIfError(data, error, 'updateProduct'));
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(`deleteProduct: ${error.message}`);
  }

  // ============== production logs ==============
  async listProductionLogs(opts?: ListOpts): Promise<ProductionLog[]> {
    let q = supabase.from('production_logs').select('*').order('date', { ascending: false });
    if (opts?.locationId) q = q.eq('location_id', opts.locationId);
    const { data, error } = await q;
    return throwIfError(data, error, 'listProductionLogs').map(mapProductionLog);
  }

  async addProductionLog(input: Omit<ProductionLog, 'id'> & { locationId?: string }): Promise<ProductionLog> {
    const { data, error } = await supabase
      .from('production_logs')
      .insert({
        product_id: input.productId,
        quantity: input.quantity,
        date: input.date,
        location_id: input.locationId ?? null,
      })
      .select()
      .single();
    return mapProductionLog(throwIfError(data, error, 'addProductionLog'));
  }

  async produceWithBom(productId: string, quantity: number, date?: string): Promise<void> {
    const { error } = await supabase.rpc('produce_with_bom', {
      p_product_id: productId,
      p_quantity: quantity,
      p_date: date ?? new Date().toISOString(),
    });
    if (error) {
      // surface the typed error so the UI can show the right toast
      throw new Error(error.message);
    }
  }

  // ============== bill of materials ==============
  async listBomItems(productId: string): Promise<BomItem[]> {
    const { data, error } = await supabase
      .from('bom_items')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });
    return throwIfError(data, error, 'listBomItems').map((r: BomItemRow) => ({
      id: r.id,
      productId: r.product_id,
      inputProductId: r.input_product_id,
      quantityPerUnit: Number(r.quantity_per_unit),
      note: r.note ?? undefined,
      createdAt: r.created_at,
    }));
  }

  async upsertBomItem(input: Omit<BomItem, 'id' | 'createdAt'>): Promise<BomItem> {
    // We rely on the (product_id, input_product_id) UNIQUE constraint to
    // collapse duplicates — this lets the UI "save" without checking first.
    const { data, error } = await supabase
      .from('bom_items')
      .upsert(
        {
          product_id: input.productId,
          input_product_id: input.inputProductId,
          quantity_per_unit: input.quantityPerUnit,
          note: input.note ?? null,
        },
        { onConflict: 'product_id,input_product_id' },
      )
      .select()
      .single();
    const r = throwIfError(data, error, 'upsertBomItem') as BomItemRow;
    return {
      id: r.id,
      productId: r.product_id,
      inputProductId: r.input_product_id,
      quantityPerUnit: Number(r.quantity_per_unit),
      note: r.note ?? undefined,
      createdAt: r.created_at,
    };
  }

  async deleteBomItem(id: string): Promise<void> {
    const { error } = await supabase.from('bom_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ============== sales ==============
  async listSales(opts?: ListOpts): Promise<Sale[]> {
    let q = supabase.from('sales').select('*').order('date', { ascending: false });
    if (opts?.locationId) q = q.eq('location_id', opts.locationId);
    const { data, error } = await q;
    return throwIfError(data, error, 'listSales').map(mapSale);
  }

  async addSale(input: Omit<Sale, 'id'> & { locationId?: string }): Promise<Sale> {
    const { data, error } = await supabase
      .from('sales')
      .insert({
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        items: input.items,
        total: input.total,
        payment_type: input.paymentType,
        cash_part: input.cashPart ?? null,
        debt_part: input.debtPart ?? null,
        note: input.note ?? null,
        date: input.date,
        location_id: input.locationId ?? null,
      })
      .select()
      .single();
    return mapSale(throwIfError(data, error, 'addSale'));
  }

  async deleteSale(id: string): Promise<void> {
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) throw new Error(`deleteSale: ${error.message}`);
  }

  async refundSale(id: string): Promise<void> {
    const { error } = await supabase.rpc('refund_sale', { p_sale_id: id });
    if (error) throw new Error(`refundSale: ${error.message}`);
  }

  async executeSale(input: {
    customerName: string;
    customerPhone: string;
    items: Sale['items'];
    paymentType: Sale['paymentType'];
    cashPart?: number;
    debtPart?: number;
    note?: string;
    date: string;
    locationId?: string;
    accountId?: string;
  }): Promise<{ saleId: string; debtId?: string; total: number }> {
    const { data, error } = await supabase.rpc('sell_products', {
      p_customer_name:  input.customerName,
      p_customer_phone: input.customerPhone,
      p_items:          input.items,
      p_payment_type:   input.paymentType,
      p_cash_part:      input.cashPart ?? null,
      p_debt_part:      input.debtPart ?? null,
      p_note:           input.note ?? null,
      p_date:           input.date,
      p_location_id:    input.locationId ?? null,
      p_account_id:     input.accountId ?? null,
    });
    if (error) {
      // Surface domain errors so the UI can show a friendly message.
      if (error.message.includes('insufficient_stock')) {
        throw new Error('insufficient_stock');
      }
      throw new Error(`executeSale: ${error.message}`);
    }
    const row = data as { sale_id: string; debt_id: string | null; total: number };
    return {
      saleId: row.sale_id,
      debtId: row.debt_id ?? undefined,
      total: Number(row.total),
    };
  }

  // ============== debts ==============
  async listDebts(opts?: ListOpts): Promise<Debt[]> {
    let debtsQ = supabase.from('debts').select('*').order('date', { ascending: false });
    if (opts?.locationId) debtsQ = debtsQ.eq('location_id', opts.locationId);
    const [debtsRes, paymentsRes] = await Promise.all([
      debtsQ,
      supabase.from('debt_payments').select('*').order('date', { ascending: true }),
    ]);
    if (debtsRes.error) throw new Error(`listDebts: ${debtsRes.error.message}`);
    if (paymentsRes.error) throw new Error(`listDebts.payments: ${paymentsRes.error.message}`);

    const grouped = new Map<string, DebtPayment[]>();
    for (const p of paymentsRes.data as DebtPaymentRow[]) {
      const list = grouped.get(p.debt_id) ?? [];
      list.push({ amount: Number(p.amount), date: p.date });
      grouped.set(p.debt_id, list);
    }

    return (debtsRes.data as DebtRow[]).map(r => mapDebt(r, grouped.get(r.id) ?? []));
  }

  async addDebt(
    input: Omit<Debt, 'id' | 'payments' | 'originalAmount'> & { originalAmount?: number; locationId?: string },
  ): Promise<Debt> {
    const { data, error } = await supabase
      .from('debts')
      .insert({
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        product: input.product,
        amount: input.amount,
        original_amount: input.originalAmount ?? input.amount,
        sale_id: input.saleId ?? null,
        date: input.date,
        due_date: input.dueDate ?? null,
        note: input.note ?? null,
        location_id: input.locationId ?? null,
      })
      .select()
      .single();
    return mapDebt(throwIfError(data, error, 'addDebt'), []);
  }

  async payDebtPartial(id: string, payment: DebtPayment): Promise<Debt> {
    // Insert the payment row.
    const { error: payErr } = await supabase
      .from('debt_payments')
      .insert({ debt_id: id, amount: payment.amount, date: payment.date });
    if (payErr) throw new Error(`payDebtPartial.insert: ${payErr.message}`);

    // Fetch the debt to compute the new remaining amount.
    const { data: debtRow, error: getErr } = await supabase
      .from('debts')
      .select('*')
      .eq('id', id)
      .single();
    if (getErr) throw new Error(`payDebtPartial.get: ${getErr.message}`);

    const remaining = Math.max(0, Number((debtRow as DebtRow).amount) - payment.amount);
    const { data: updated, error: updErr } = await supabase
      .from('debts')
      .update({ amount: remaining })
      .eq('id', id)
      .select()
      .single();
    if (updErr) throw new Error(`payDebtPartial.update: ${updErr.message}`);

    // Rehydrate all payments for accuracy.
    const { data: payments, error: payListErr } = await supabase
      .from('debt_payments')
      .select('*')
      .eq('debt_id', id)
      .order('date', { ascending: true });
    if (payListErr) throw new Error(`payDebtPartial.list: ${payListErr.message}`);

    const paymentObjs: DebtPayment[] = (payments as DebtPaymentRow[]).map(p => ({
      amount: Number(p.amount),
      date: p.date,
    }));
    return mapDebt(updated as DebtRow, paymentObjs);
  }

  async payDebtFull(id: string): Promise<void> {
    const { error } = await supabase.from('debts').delete().eq('id', id);
    if (error) throw new Error(`payDebtFull: ${error.message}`);
  }

  async deleteDebt(id: string): Promise<void> {
    const { error } = await supabase.from('debts').delete().eq('id', id);
    if (error) throw new Error(`deleteDebt: ${error.message}`);
  }

  // ============== expenses ==============
  async listExpenses(opts?: ListOpts): Promise<Expense[]> {
    let q = supabase.from('expenses').select('*').order('date', { ascending: false });
    if (opts?.locationId) q = q.eq('location_id', opts.locationId);
    const { data, error } = await q;
    return throwIfError(data, error, 'listExpenses').map(mapExpense);
  }

  async addExpense(input: Omit<Expense, 'id'> & { locationId?: string; accountId?: string }): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        category: input.category,
        description: input.description,
        amount: input.amount,
        payment_type: input.paymentType,
        date: input.date,
        auto: input.auto ?? false,
        location_id: input.locationId ?? null,
        account_id: input.accountId ?? null,
        supplier_id: input.supplierId ?? null,
      })
      .select()
      .single();
    return mapExpense(throwIfError(data, error, 'addExpense'));
  }

  async updateExpense(id: string, patch: Partial<Expense>): Promise<Expense> {
    const payload: Record<string, unknown> = {};
    if (patch.category !== undefined) payload.category = patch.category;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.amount !== undefined) payload.amount = patch.amount;
    if (patch.paymentType !== undefined) payload.payment_type = patch.paymentType;
    if (patch.date !== undefined) payload.date = patch.date;
    if (patch.auto !== undefined) payload.auto = patch.auto;
    if (patch.supplierId !== undefined) payload.supplier_id = patch.supplierId ?? null;

    const { data, error } = await supabase
      .from('expenses')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    return mapExpense(throwIfError(data, error, 'updateExpense'));
  }

  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(`deleteExpense: ${error.message}`);
  }

  // ============== recurring expenses ==============
  async listRecurringExpenses(): Promise<RecurringExpense[]> {
    const { data, error } = await supabase
      .from('recurring_expenses')
      .select('*')
      .order('day_of_month', { ascending: true });
    if (error) throw new Error(`listRecurringExpenses: ${error.message}`);
    return (data ?? []).map(r => ({
      id: r.id,
      category: r.category,
      description: r.description,
      amount: Number(r.amount),
      paymentType: r.payment_type,
      dayOfMonth: r.day_of_month,
      active: r.active,
      lastRunAt: r.last_run_at ?? undefined,
      createdAt: r.created_at,
    }));
  }

  async addRecurringExpense(
    input: Omit<RecurringExpense, 'id' | 'createdAt' | 'lastRunAt'>,
  ): Promise<RecurringExpense> {
    const { data, error } = await supabase
      .from('recurring_expenses')
      .insert({
        category: input.category,
        description: input.description,
        amount: input.amount,
        payment_type: input.paymentType,
        day_of_month: input.dayOfMonth,
        active: input.active,
      })
      .select()
      .single();
    if (error) throw new Error(`addRecurringExpense: ${error.message}`);
    return {
      id: data.id,
      category: data.category,
      description: data.description,
      amount: Number(data.amount),
      paymentType: data.payment_type,
      dayOfMonth: data.day_of_month,
      active: data.active,
      lastRunAt: data.last_run_at ?? undefined,
      createdAt: data.created_at,
    };
  }

  async updateRecurringExpense(id: string, patch: Partial<RecurringExpense>): Promise<RecurringExpense> {
    const payload: Record<string, unknown> = {};
    if (patch.category    !== undefined) payload.category     = patch.category;
    if (patch.description !== undefined) payload.description  = patch.description;
    if (patch.amount      !== undefined) payload.amount       = patch.amount;
    if (patch.paymentType !== undefined) payload.payment_type = patch.paymentType;
    if (patch.dayOfMonth  !== undefined) payload.day_of_month = patch.dayOfMonth;
    if (patch.active      !== undefined) payload.active       = patch.active;
    const { data, error } = await supabase
      .from('recurring_expenses')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`updateRecurringExpense: ${error.message}`);
    return {
      id: data.id,
      category: data.category,
      description: data.description,
      amount: Number(data.amount),
      paymentType: data.payment_type,
      dayOfMonth: data.day_of_month,
      active: data.active,
      lastRunAt: data.last_run_at ?? undefined,
      createdAt: data.created_at,
    };
  }

  async deleteRecurringExpense(id: string): Promise<void> {
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
    if (error) throw new Error(`deleteRecurringExpense: ${error.message}`);
  }

  // ============== workers ==============
  async listWorkers(): Promise<Worker[]> {
    const [workersRes, paymentsRes] = await Promise.all([
      supabase.from('workers').select('*').order('created_at', { ascending: true }),
      supabase.from('worker_payments').select('*').order('date', { ascending: false }),
    ]);
    if (workersRes.error) throw new Error(`listWorkers: ${workersRes.error.message}`);
    if (paymentsRes.error) throw new Error(`listWorkers.payments: ${paymentsRes.error.message}`);

    const grouped = new Map<string, WorkerPayment[]>();
    for (const p of paymentsRes.data as WorkerPaymentRow[]) {
      const list = grouped.get(p.worker_id) ?? [];
      list.push(mapWorkerPayment(p));
      grouped.set(p.worker_id, list);
    }

    return (workersRes.data as WorkerRow[]).map(r => mapWorker(r, grouped.get(r.id) ?? []));
  }

  async addWorker(
    input: Omit<Worker, 'id' | 'paymentHistory' | 'workDays' | 'bonus' | 'penalty' | 'advance'>,
  ): Promise<Worker> {
    const { data, error } = await supabase
      .from('workers')
      .insert({ name: input.name, monthly_salary: input.monthlySalary })
      .select()
      .single();
    return mapWorker(throwIfError(data, error, 'addWorker'), []);
  }

  async updateWorker(id: string, patch: Partial<Worker>): Promise<Worker> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.monthlySalary !== undefined) payload.monthly_salary = patch.monthlySalary;
    if (patch.workDays !== undefined) payload.work_days = patch.workDays;
    if (patch.bonus !== undefined) payload.bonus = patch.bonus;
    if (patch.penalty !== undefined) payload.penalty = patch.penalty;
    if (patch.advance !== undefined) payload.advance = patch.advance;

    const { data, error } = await supabase
      .from('workers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    const row = throwIfError(data, error, 'updateWorker');

    // refetch history (cheap and keeps the shape consistent)
    const { data: history } = await supabase
      .from('worker_payments')
      .select('*')
      .eq('worker_id', id)
      .order('date', { ascending: false });
    return mapWorker(row, (history as WorkerPaymentRow[] | null)?.map(mapWorkerPayment) ?? []);
  }

  async deleteWorker(id: string): Promise<void> {
    const { error } = await supabase.from('workers').delete().eq('id', id);
    if (error) throw new Error(`deleteWorker: ${error.message}`);
  }

  async payWorker(
    workerId: string,
    payment: Omit<WorkerPayment, 'id' | 'workerId'>,
  ): Promise<Worker> {
    // 1) record payment
    const { error: payErr } = await supabase.from('worker_payments').insert({
      worker_id: workerId,
      amount: payment.amount,
      payment_type: payment.paymentType,
      note: payment.note ?? null,
      date: payment.date,
      snapshot: payment.snapshot,
    });
    if (payErr) throw new Error(`payWorker.insert: ${payErr.message}`);

    // 2) reset worker counters
    const { data: workerRow, error: updErr } = await supabase
      .from('workers')
      .update({ work_days: 0, bonus: 0, penalty: 0, advance: 0 })
      .eq('id', workerId)
      .select()
      .single();
    if (updErr) throw new Error(`payWorker.update: ${updErr.message}`);

    // 3) return refreshed worker w/ history
    const { data: history } = await supabase
      .from('worker_payments')
      .select('*')
      .eq('worker_id', workerId)
      .order('date', { ascending: false });
    return mapWorker(
      workerRow as WorkerRow,
      (history as WorkerPaymentRow[] | null)?.map(mapWorkerPayment) ?? [],
    );
  }

  // ============== action logs ==============
  async listActionLogs(limit = 200): Promise<ActionLog[]> {
    const { data, error } = await supabase
      .from('action_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);
    const rows = throwIfError(data, error, 'listActionLogs') as ActionLogRow[];
    // Bulk-fetch names for the distinct user_ids present in the page.
    const userIds = Array.from(new Set(rows.map(r => r.user_id).filter((x): x is string => !!x)));
    let nameById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id,name')
        .in('id', userIds);
      nameById = new Map((profiles ?? []).map(p => [p.id as string, p.name as string]));
    }
    return rows.map(r => mapAction(r, r.user_id ? nameById.get(r.user_id) : undefined));
  }

  async addActionLog(input: Omit<ActionLog, 'id'>): Promise<ActionLog> {
    // Attach current user id automatically so all writes are attributed.
    const { data: sessionRes } = await supabase.auth.getSession();
    const userId = sessionRes.session?.user.id ?? null;
    const { data, error } = await supabase
      .from('action_logs')
      .insert({
        type: input.type,
        description: input.description,
        date: input.date,
        user_id: userId,
      })
      .select()
      .single();
    return mapAction(throwIfError(data, error, 'addActionLog'));
  }

  // ============== users / profiles ==============
  // Note: with Supabase Auth, "users" are auth.users; we expose the profile rows.
  // The `password` field on the User type is not stored in profiles — it's used
  // only as an input when AuthProvider signs the user up. We surface it as an
  // empty string here for type compatibility.
  async listUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    const rows = throwIfError(data, error, 'listUsers') as ProfileRow[];
    return rows.map(r => this.toUser(r));
  }

  private toUser(p: ProfileRow): User {
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      password: '',
      role: p.role,
      createdAt: p.created_at,
    };
  }

  async addUser(_input: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    // Creating users with email/password is handled by AuthProvider via
    // supabase.auth.signUp / admin RPC. See AuthProvider.createUser().
    void _input;
    throw new Error('not_supported: use AuthProvider.createUser');
  }

  async updateUser(id: string, patch: Partial<User>): Promise<User> {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.role !== undefined) payload.role = patch.role;

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.message.includes('only super admins')) throw new Error('forbidden_role_change');
      throw new Error(`updateUser: ${error.message}`);
    }
    return this.toUser(throwIfError(data, error, 'updateUser') as ProfileRow);
  }

  async deleteUser(id: string): Promise<void> {
    // Soft-delete: keep the row but mark deleted_at. AuthProvider treats
    // deleted profiles as signed-out, so the user can no longer access
    // the app even if their auth.users row remains. This avoids the
    // sign-in loop you'd get with a hard delete (auth user with no
    // profile keeps loading nothing).
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(`deleteUser: ${error.message}`);
  }

  // ============== session ==============
  // Session is owned by Supabase Auth; AuthProvider reads it via supabase.auth.
  // These stubs satisfy the Repository contract but are no-ops in the Supabase
  // backend.
  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    return {
      userId: data.session.user.id,
      signedInAt: new Date(data.session.expires_at ? data.session.expires_at * 1000 : Date.now()).toISOString(),
    };
  }

  async setSession(_session: Session | null): Promise<void> {
    // No-op; Supabase Auth manages sessions itself.
    void _session;
  }
}
