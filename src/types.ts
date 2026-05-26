export type PaymentType = 'naqd' | 'karta' | 'qarz' | 'aralash';
export type ExpenseCategory = 'Ijara' | 'Elektr' | 'Xom ashyo' | 'Maosh' | 'Boshqa';
export type ActionType = 'sale' | 'expense' | 'production' | 'payment';

export interface Product {
  id: string;
  name: string;
  stock: number;
  createdAt: string;
  lastUpdated: string;
}

export interface ProductionLog {
  id: string;
  productId: string;
  quantity: number;
  date: string;
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
}

export interface DebtPayment {
  amount: number;
  date: string;
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
