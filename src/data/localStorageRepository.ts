import type {
  Product,
  ProductionLog,
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
import type { Repository } from './repository';

const KEYS = {
  products: 'protrack:products',
  productionLogs: 'protrack:productionLogs',
  sales: 'protrack:sales',
  debts: 'protrack:debts',
  expenses: 'protrack:expenses',
  workers: 'protrack:workers',
  actionLogs: 'protrack:actionLogs',
  users: 'protrack:users',
  session: 'protrack:session',
  recurringExpenses: 'protrack:recurringExpenses',
} as const;

const DEFAULT_SUPER_ADMIN: Omit<User, 'id' | 'createdAt'> = {
  name: 'Admin',
  email: 'teamnovauzb@gmail.com',
  password: 'admin123',
  role: 'super_admin',
};

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(): string {
  return crypto.randomUUID();
}

function nowISO(): string {
  return new Date().toISOString();
}

export class LocalStorageRepository implements Repository {
  // -------- products --------
  async listProducts(): Promise<Product[]> {
    // Backfill optional fields for records created before columns existed.
    return read<Product>(KEYS.products).map(p => ({
      ...p,
      minStock: p.minStock ?? 10,
      vatRate: p.vatRate ?? 0,
    }));
  }

  async addProduct(input: Omit<Product, 'id' | 'createdAt' | 'lastUpdated'>): Promise<Product> {
    const products = read<Product>(KEYS.products);
    const product: Product = {
      ...input,
      minStock: input.minStock ?? 10,
      id: uid(),
      createdAt: nowISO(),
      lastUpdated: nowISO(),
    };
    products.push(product);
    write(KEYS.products, products);
    return product;
  }

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
    const products = read<Product>(KEYS.products);
    const idx = products.findIndex(p => p.id === id);
    if (idx < 0) throw new Error('Product not found');
    products[idx] = { ...products[idx], ...patch, lastUpdated: nowISO() };
    write(KEYS.products, products);
    return products[idx];
  }

  async deleteProduct(id: string): Promise<void> {
    const products = read<Product>(KEYS.products).filter(p => p.id !== id);
    write(KEYS.products, products);
  }

  // -------- production --------
  async listProductionLogs(): Promise<ProductionLog[]> {
    return read<ProductionLog>(KEYS.productionLogs);
  }

  async addProductionLog(input: Omit<ProductionLog, 'id'>): Promise<ProductionLog> {
    const logs = read<ProductionLog>(KEYS.productionLogs);
    const log: ProductionLog = { ...input, id: uid() };
    logs.push(log);
    write(KEYS.productionLogs, logs);
    return log;
  }

  // -------- sales --------
  async listSales(): Promise<Sale[]> {
    return read<Sale>(KEYS.sales);
  }

  async addSale(input: Omit<Sale, 'id'>): Promise<Sale> {
    const sales = read<Sale>(KEYS.sales);
    const sale: Sale = { ...input, id: uid() };
    sales.push(sale);
    write(KEYS.sales, sales);
    return sale;
  }

  async deleteSale(id: string): Promise<void> {
    const sales = read<Sale>(KEYS.sales).filter(s => s.id !== id);
    write(KEYS.sales, sales);
  }

  async refundSale(id: string): Promise<void> {
    const sales = read<Sale>(KEYS.sales);
    const sale = sales.find(s => s.id === id);
    if (!sale) return;

    // Restore stock.
    const products = read<Product>(KEYS.products);
    for (const item of sale.items) {
      const p = products.find(x => x.id === item.productId);
      if (p) {
        p.stock += item.quantity;
        p.lastUpdated = nowISO();
      }
    }
    write(KEYS.products, products);

    // Drop linked debts.
    write(KEYS.debts, read<Debt>(KEYS.debts).filter(d => d.saleId !== id));

    // Log + delete.
    const log: ActionLog = {
      id: uid(),
      type: 'sale',
      description: `${sale.customerName} — refund UZS ${sale.total.toLocaleString('en-US').replace(/,/g, ' ')}`,
      date: nowISO(),
    };
    const logs = read<ActionLog>(KEYS.actionLogs);
    write(KEYS.actionLogs, [log, ...logs].slice(0, 200));
    write(KEYS.sales, sales.filter(s => s.id !== id));
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
  }): Promise<{ saleId: string; debtId?: string; total: number }> {
    // Validate stock first; throw before mutating anything so we don't
    // half-apply a sale.
    const products = read<Product>(KEYS.products);
    const byId = new Map(products.map(p => [p.id, p]));
    for (const item of input.items) {
      const p = byId.get(item.productId);
      if (!p || p.stock < item.quantity) {
        const err = new Error('insufficient_stock');
        (err as Error & { detail?: string }).detail = item.productName;
        throw err;
      }
    }

    const total = input.items.reduce((a, i) => a + i.quantity * i.price, 0);
    const debtAmount =
      input.paymentType === 'qarz' ? total
      : input.paymentType === 'aralash' ? (input.debtPart ?? 0)
      : 0;

    // Decrement stock.
    for (const item of input.items) {
      const p = byId.get(item.productId)!;
      p.stock -= item.quantity;
      p.lastUpdated = nowISO();
    }
    write(KEYS.products, [...byId.values()]);

    // Insert sale.
    const sale: Sale = {
      id: uid(),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      items: input.items,
      total,
      paymentType: input.paymentType,
      cashPart: input.paymentType === 'aralash' ? input.cashPart : undefined,
      debtPart:
        input.paymentType === 'aralash' ? input.debtPart
        : input.paymentType === 'qarz'   ? total
        : undefined,
      note: input.note,
      date: input.date,
    };
    const sales = read<Sale>(KEYS.sales);
    sales.push(sale);
    write(KEYS.sales, sales);

    // Optionally insert debt.
    let debtId: string | undefined;
    if (debtAmount > 0) {
      const debt: Debt = {
        id: uid(),
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        product: input.items.map(i => `${i.productName} ×${i.quantity}`).join(', '),
        amount: debtAmount,
        originalAmount: debtAmount,
        saleId: sale.id,
        date: input.date,
        note: input.note,
        payments: [],
      };
      const debts = read<Debt>(KEYS.debts);
      debts.push(debt);
      write(KEYS.debts, debts);
      debtId = debt.id;
    }

    // Action log.
    const log: ActionLog = {
      id: uid(),
      type: 'sale',
      description: `${input.customerName} — UZS ${total.toLocaleString('en-US').replace(/,/g, ' ')}`,
      date: input.date,
    };
    const logs = read<ActionLog>(KEYS.actionLogs);
    write(KEYS.actionLogs, [log, ...logs].slice(0, 200));

    return { saleId: sale.id, debtId, total };
  }

  // -------- debts --------
  async listDebts(): Promise<Debt[]> {
    return read<Debt>(KEYS.debts);
  }

  async addDebt(
    input: Omit<Debt, 'id' | 'payments' | 'originalAmount'> & { originalAmount?: number },
  ): Promise<Debt> {
    const debts = read<Debt>(KEYS.debts);
    const debt: Debt = {
      ...input,
      id: uid(),
      payments: [],
      originalAmount: input.originalAmount ?? input.amount,
    };
    debts.push(debt);
    write(KEYS.debts, debts);
    return debt;
  }

  async payDebtPartial(id: string, payment: DebtPayment): Promise<Debt> {
    const debts = read<Debt>(KEYS.debts);
    const idx = debts.findIndex(d => d.id === id);
    if (idx < 0) throw new Error('Debt not found');
    const next: Debt = {
      ...debts[idx],
      amount: Math.max(0, debts[idx].amount - payment.amount),
      payments: [...debts[idx].payments, payment],
    };
    debts[idx] = next;
    write(KEYS.debts, debts);
    return next;
  }

  async payDebtFull(id: string): Promise<void> {
    const debts = read<Debt>(KEYS.debts).filter(d => d.id !== id);
    write(KEYS.debts, debts);
  }

  async deleteDebt(id: string): Promise<void> {
    const debts = read<Debt>(KEYS.debts).filter(d => d.id !== id);
    write(KEYS.debts, debts);
  }

  // -------- expenses --------
  async listExpenses(): Promise<Expense[]> {
    return read<Expense>(KEYS.expenses);
  }

  async addExpense(input: Omit<Expense, 'id'>): Promise<Expense> {
    const expenses = read<Expense>(KEYS.expenses);
    const expense: Expense = { ...input, id: uid() };
    expenses.push(expense);
    write(KEYS.expenses, expenses);
    return expense;
  }

  async updateExpense(id: string, patch: Partial<Expense>): Promise<Expense> {
    const expenses = read<Expense>(KEYS.expenses);
    const idx = expenses.findIndex(e => e.id === id);
    if (idx < 0) throw new Error('Expense not found');
    expenses[idx] = { ...expenses[idx], ...patch };
    write(KEYS.expenses, expenses);
    return expenses[idx];
  }

  async deleteExpense(id: string): Promise<void> {
    const expenses = read<Expense>(KEYS.expenses).filter(e => e.id !== id);
    write(KEYS.expenses, expenses);
  }

  // -------- workers --------
  async listWorkers(): Promise<Worker[]> {
    return read<Worker>(KEYS.workers);
  }

  async addWorker(
    input: Omit<Worker, 'id' | 'paymentHistory' | 'workDays' | 'bonus' | 'penalty' | 'advance'>,
  ): Promise<Worker> {
    const workers = read<Worker>(KEYS.workers);
    const worker: Worker = {
      ...input,
      id: uid(),
      workDays: 0,
      bonus: 0,
      penalty: 0,
      advance: 0,
      paymentHistory: [],
    };
    workers.push(worker);
    write(KEYS.workers, workers);
    return worker;
  }

  async updateWorker(id: string, patch: Partial<Worker>): Promise<Worker> {
    const workers = read<Worker>(KEYS.workers);
    const idx = workers.findIndex(w => w.id === id);
    if (idx < 0) throw new Error('Worker not found');
    workers[idx] = { ...workers[idx], ...patch };
    write(KEYS.workers, workers);
    return workers[idx];
  }

  async deleteWorker(id: string): Promise<void> {
    const workers = read<Worker>(KEYS.workers).filter(w => w.id !== id);
    write(KEYS.workers, workers);
  }

  async payWorker(workerId: string, payment: Omit<WorkerPayment, 'id' | 'workerId'>): Promise<Worker> {
    const workers = read<Worker>(KEYS.workers);
    const idx = workers.findIndex(w => w.id === workerId);
    if (idx < 0) throw new Error('Worker not found');
    const full: WorkerPayment = { ...payment, id: uid(), workerId };
    const next: Worker = {
      ...workers[idx],
      workDays: 0,
      bonus: 0,
      penalty: 0,
      advance: 0,
      paymentHistory: [full, ...workers[idx].paymentHistory],
    };
    workers[idx] = next;
    write(KEYS.workers, workers);
    return next;
  }

  // -------- action logs --------
  async listActionLogs(): Promise<ActionLog[]> {
    return read<ActionLog>(KEYS.actionLogs);
  }

  async addActionLog(input: Omit<ActionLog, 'id'>): Promise<ActionLog> {
    const logs = read<ActionLog>(KEYS.actionLogs);
    const log: ActionLog = { ...input, id: uid() };
    // keep newest first, capped at 200 entries
    const next = [log, ...logs].slice(0, 200);
    write(KEYS.actionLogs, next);
    return log;
  }

  // -------- users --------
  async listUsers(): Promise<User[]> {
    const users = read<User>(KEYS.users);
    if (users.length === 0) {
      const seeded: User = {
        ...DEFAULT_SUPER_ADMIN,
        id: uid(),
        createdAt: nowISO(),
      };
      write(KEYS.users, [seeded]);
      return [seeded];
    }
    return users;
  }

  async addUser(input: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const users = await this.listUsers();
    if (users.some(u => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error('duplicate_email');
    }
    const user: User = { ...input, id: uid(), createdAt: nowISO() };
    write(KEYS.users, [...users, user]);
    return user;
  }

  async updateUser(id: string, patch: Partial<User>): Promise<User> {
    const users = await this.listUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx < 0) throw new Error('user_not_found');
    if (patch.email && users.some(u => u.id !== id && u.email.toLowerCase() === patch.email!.toLowerCase())) {
      throw new Error('duplicate_email');
    }
    users[idx] = { ...users[idx], ...patch };
    write(KEYS.users, users);
    return users[idx];
  }

  async deleteUser(id: string): Promise<void> {
    const users = await this.listUsers();
    const remaining = users.filter(u => u.id !== id);
    // never allow zero users
    if (remaining.length === 0) throw new Error('cannot_delete_last_user');
    // never allow deleting the last super admin
    if (
      users.find(u => u.id === id)?.role === 'super_admin' &&
      remaining.every(u => u.role !== 'super_admin')
    ) {
      throw new Error('cannot_delete_last_super_admin');
    }
    write(KEYS.users, remaining);
  }

  // -------- session --------
  async getSession(): Promise<Session | null> {
    try {
      const raw = localStorage.getItem(KEYS.session);
      if (!raw) return null;
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }

  async setSession(session: Session | null): Promise<void> {
    if (!session) {
      localStorage.removeItem(KEYS.session);
      return;
    }
    localStorage.setItem(KEYS.session, JSON.stringify(session));
  }

  // -------- recurring expenses --------
  async listRecurringExpenses(): Promise<RecurringExpense[]> {
    return read<RecurringExpense>(KEYS.recurringExpenses);
  }

  async addRecurringExpense(
    input: Omit<RecurringExpense, 'id' | 'createdAt' | 'lastRunAt'>,
  ): Promise<RecurringExpense> {
    const list = read<RecurringExpense>(KEYS.recurringExpenses);
    const item: RecurringExpense = { ...input, id: uid(), createdAt: nowISO() };
    list.push(item);
    write(KEYS.recurringExpenses, list);
    return item;
  }

  async updateRecurringExpense(id: string, patch: Partial<RecurringExpense>): Promise<RecurringExpense> {
    const list = read<RecurringExpense>(KEYS.recurringExpenses);
    const idx = list.findIndex(x => x.id === id);
    if (idx < 0) throw new Error('recurring_not_found');
    list[idx] = { ...list[idx], ...patch };
    write(KEYS.recurringExpenses, list);
    return list[idx];
  }

  async deleteRecurringExpense(id: string): Promise<void> {
    write(KEYS.recurringExpenses, read<RecurringExpense>(KEYS.recurringExpenses).filter(x => x.id !== id));
  }
}
