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

/**
 * Repository contract.
 *
 * All async even though the current implementation is sync,
 * so the SupabaseRepository (or any other) can be a drop-in
 * replacement without UI changes.
 */
export interface Repository {
  // products
  listProducts(): Promise<Product[]>;
  addProduct(input: Omit<Product, 'id' | 'createdAt' | 'lastUpdated'>): Promise<Product>;
  updateProduct(id: string, patch: Partial<Product>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  // production
  listProductionLogs(): Promise<ProductionLog[]>;
  addProductionLog(input: Omit<ProductionLog, 'id'>): Promise<ProductionLog>;
  /**
   * Atomic produce-with-BOM: increments the finished product's stock
   * AND deducts each raw input (`qty × quantity_per_unit`). Throws
   * `insufficient_raw_material` if any input is short. If the product
   * has no BOM rows, behaves like `addProductionLog`.
   */
  produceWithBom(productId: string, quantity: number, date?: string): Promise<void>;

  // bill of materials
  listBomItems(productId: string): Promise<BomItem[]>;
  upsertBomItem(input: Omit<BomItem, 'id' | 'createdAt'>): Promise<BomItem>;
  deleteBomItem(id: string): Promise<void>;

  // sales
  listSales(): Promise<Sale[]>;
  addSale(input: Omit<Sale, 'id'>): Promise<Sale>;
  /**
   * Atomic sell: validates stock, decrements products, inserts sale,
   * optionally creates a debt, and appends an action log — all in a
   * single transaction. Throws `insufficient_stock` if any item
   * cannot satisfy its quantity.
   */
  executeSale(input: {
    customerName: string;
    customerPhone: string;
    items: import('@/types').CartItem[];
    paymentType: import('@/types').PaymentType;
    cashPart?: number;
    debtPart?: number;
    note?: string;
    date: string;
  }): Promise<{ saleId: string; debtId?: string; total: number }>;
  /**
   * Reverse a sale (refund): restore stock, drop linked debt, log it.
   * Atomic on Supabase; best-effort on localStorage.
   */
  refundSale(id: string): Promise<void>;
  deleteSale(id: string): Promise<void>;

  // debts
  listDebts(): Promise<Debt[]>;
  addDebt(input: Omit<Debt, 'id' | 'payments' | 'originalAmount'> & { originalAmount?: number }): Promise<Debt>;
  payDebtPartial(id: string, payment: DebtPayment): Promise<Debt>;
  payDebtFull(id: string): Promise<void>;
  deleteDebt(id: string): Promise<void>;

  // expenses
  listExpenses(): Promise<Expense[]>;
  addExpense(input: Omit<Expense, 'id'>): Promise<Expense>;
  updateExpense(id: string, patch: Partial<Expense>): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;

  // recurring expenses (rules that auto-create expenses on a monthly cadence)
  listRecurringExpenses(): Promise<RecurringExpense[]>;
  addRecurringExpense(input: Omit<RecurringExpense, 'id' | 'createdAt' | 'lastRunAt'>): Promise<RecurringExpense>;
  updateRecurringExpense(id: string, patch: Partial<RecurringExpense>): Promise<RecurringExpense>;
  deleteRecurringExpense(id: string): Promise<void>;

  // workers
  listWorkers(): Promise<Worker[]>;
  addWorker(input: Omit<Worker, 'id' | 'paymentHistory' | 'workDays' | 'bonus' | 'penalty' | 'advance'>): Promise<Worker>;
  updateWorker(id: string, patch: Partial<Worker>): Promise<Worker>;
  deleteWorker(id: string): Promise<void>;
  payWorker(workerId: string, payment: Omit<WorkerPayment, 'id' | 'workerId'>): Promise<Worker>;

  // action log
  listActionLogs(limit?: number): Promise<ActionLog[]>;
  addActionLog(input: Omit<ActionLog, 'id'>): Promise<ActionLog>;

  // users
  listUsers(): Promise<User[]>;
  addUser(input: Omit<User, 'id' | 'createdAt'>): Promise<User>;
  updateUser(id: string, patch: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // session
  getSession(): Promise<Session | null>;
  setSession(session: Session | null): Promise<void>;
}
