export type PaymentType = 'naqd' | 'karta' | 'qarz' | 'aralash';
export type ExpenseCategory = 'Ijara' | 'Elektr' | 'Xom ashyo' | 'Maosh' | 'Boshqa';
export type ActionType = 'sale' | 'expense' | 'production' | 'payment';

export type Currency = 'UZS' | 'USD' | 'RUB' | 'EUR';

export interface Product {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  vatRate: number;        // 0..100
  /**
   * Unit cost — what it costs to produce or acquire one unit. Used for
   * gross-margin calculations. Defaults to 0 for legacy rows; UI surfaces
   * a warning when cost is 0 so the owner can't be silently misled into
   * thinking everything is pure profit.
   */
  cost: number;
  /**
   * Optional default selling price. When set, the Sales modal pre-fills
   * this when the product is picked. Leave null to require manual entry
   * (useful when prices are negotiated per sale).
   */
  defaultPrice?: number;
  imageUrl?: string;
  createdAt: string;
  lastUpdated: string;
}

export interface ProductionLog {
  id: string;
  productId: string;
  quantity: number;
  date: string;
}

/**
 * One row of a product's Bill of Materials — describes a raw input
 * that gets consumed when one unit of the finished product is produced.
 */
export interface BomItem {
  id: string;
  /** finished product this BOM belongs to */
  productId: string;
  /** raw input consumed per unit produced */
  inputProductId: string;
  quantityPerUnit: number;
  note?: string;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Sale {
  id: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  total: number;
  paymentType: PaymentType;
  cashPart?: number;
  debtPart?: number;
  note?: string;
  date: string;
  currency?: Currency;   // defaults to UZS when absent
}

export interface DebtPayment {
  amount: number;
  date: string;
}

/**
 * A physical location (shop / warehouse). Most business tables grow
 * an optional location_id so a multi-shop owner can scope inventory,
 * sales, and reports per location. Today the foundation is in place
 * but query-time filtering is still rolling out.
 */
export interface Location {
  id: string;
  name: string;
  shortCode?: string;
  address?: string;
  phone?: string;
  isDefault: boolean;
  archived: boolean;
  note?: string;
  createdAt: string;
}

/**
 * A cash drawer / bank account / card. Every money movement (sale,
 * expense, worker payment, debt payment) optionally points at one of
 * these via account_id. Older rows have account_id = null.
 */
export interface Account {
  id: string;
  name: string;
  kind: 'cash' | 'card' | 'bank' | 'other';
  currency: Currency;
  openingBalance: number;
  isDefault: boolean;
  archived: boolean;
  note?: string;
  createdAt: string;
}

/** Live balance for an account, computed by the `account_balances` view. */
export interface AccountBalance {
  id: string;
  name: string;
  kind: Account['kind'];
  currency: Currency;
  openingBalance: number;
  balance: number;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId?: string;
  supplierName?: string;   // denormalized for display
  status: PurchaseOrderStatus;
  expectedAt?: string;
  note?: string;
  createdAt: string;
  orderedAt?: string;
  receivedAt?: string;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  poId: string;
  productId: string;
  productName?: string;   // denormalized for display
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  note?: string;
}

export interface AccountTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note?: string;
  createdAt: string;
}

export interface CustomerCreditLimit {
  id: string;
  name: string;
  phone: string;
  maxDebt: number;
  /** Free-form notes — promises, preferences, call notes. */
  notes?: string;
}

export interface Debt {
  id: string;
  customerName: string;
  customerPhone: string;
  product: string;
  amount: number;
  originalAmount: number;
  saleId?: string;
  date: string;
  dueDate?: string;
  note?: string;
  payments: DebtPayment[];
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentType: PaymentType;
  date: string;
  auto?: boolean;
  currency?: Currency;
  /** Optional supplier this expense was paid to (raw-material buys). */
  supplierId?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  note?: string;
  createdAt: string;
}

export interface RecurringExpense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentType: PaymentType;
  dayOfMonth: number;   // 1..28
  active: boolean;
  lastRunAt?: string;
  createdAt: string;
}

export interface WorkerPaymentSnapshot {
  workDays: number;
  bonus: number;
  penalty: number;
  advance: number;
  salary: number;
}

export interface WorkerPayment {
  id: string;
  workerId: string;
  amount: number;
  paymentType: PaymentType;
  note?: string;
  date: string;
  snapshot: WorkerPaymentSnapshot;
}

export interface Worker {
  id: string;
  name: string;
  monthlySalary: number;
  workDays: number;
  bonus: number;
  penalty: number;
  advance: number;
  paymentHistory: WorkerPayment[];
}

export interface ActionLog {
  id: string;
  type: ActionType;
  description: string;
  date: string;
  userId?: string;
  userName?: string;  // denormalized for cheap display
}

export type Language = 'uz' | 'en' | 'ru';
export type Theme = 'light' | 'dark';

export type Role = 'super_admin' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;       // stored in clear in localStorage; replaced by Supabase auth later
  role: Role;
  createdAt: string;
}

export interface Session {
  userId: string;
  signedInAt: string;
}
