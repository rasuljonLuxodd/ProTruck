import type { Debt, Expense, ProductionLog, Sale, Worker } from '@/types';

export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function isSameDay(aISO: string, bISO: string): boolean {
  const a = new Date(aISO);
  const b = new Date(bISO);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function inMonth(iso: string, year: number, monthZeroBased: number): boolean {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === monthZeroBased;
}

/**
 * Number of days in the given month (handles 28/29/30/31 correctly).
 * Trick: day 0 of the *next* month is the last day of *this* month.
 */
export function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

/** Days in the current calendar month. */
export function currentMonthDays(now: Date = new Date()): number {
  return daysInMonth(now.getFullYear(), now.getMonth());
}

export function salesIncome(sales: Sale[]): number {
  // All sales contribute to revenue; actual cash income is computed separately.
  return sales.reduce((sum, s) => sum + (s.total || 0), 0);
}

export function actualCashIncome(sales: Sale[]): number {
  // naqd + karta = real cash in. aralash counts only the cashPart. qarz = 0.
  return sales.reduce((sum, s) => {
    if (s.paymentType === 'naqd' || s.paymentType === 'karta') return sum + (s.total || 0);
    if (s.paymentType === 'aralash') return sum + (s.cashPart || 0);
    return sum;
  }, 0);
}

export function expenseTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
}

export function netProfit(sales: Sale[], expenses: Expense[]): number {
  return actualCashIncome(sales) - expenseTotal(expenses);
}

/**
 * Outstanding customer debt = the current balance from the `debts` table
 * (which gets decremented as payments come in via `payPartial` / `payFull`).
 *
 * Do NOT derive this from sales — sales record the ORIGINAL debt at sale
 * time and never get adjusted for subsequent payments, so summing them
 * would double-count anything that's already been paid off.
 */
export function outstandingDebt(debts: Debt[]): number {
  return debts.reduce((sum, d) => sum + (d.amount || 0), 0);
}

/**
 * Salary due to a worker this month.
 *
 *   base = (monthlySalary / daysInMonth) × workDays
 *   due  = base + bonus − penalty − advance
 *
 * Returns the SIGNED value — a negative result means the worker has been
 * paid more (via advances) than they earned. UI should surface this rather
 * than silently clamping to zero, otherwise the missing money disappears.
 */
export function workerPayoutDue(w: Worker, now: Date = new Date()): number {
  const dim = currentMonthDays(now);
  // Cap workDays at the actual days in the month — entering 31 in February
  // would otherwise inflate base pay by ~10%.
  const days = Math.max(0, Math.min(dim, w.workDays));
  const base = (w.monthlySalary / dim) * days;
  return base + w.bonus - w.penalty - w.advance;
}

export function productionThisMonth(logs: ProductionLog[], now: Date = new Date()): number {
  return logs
    .filter(l => inMonth(l.date, now.getFullYear(), now.getMonth()))
    .reduce((sum, l) => sum + (l.quantity || 0), 0);
}

export function last7DaysSeries(sales: Sale[], production: ProductionLog[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: Array<{ date: string; sales: number; production: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const label = `${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const sumSales = sales
      .filter(s => isSameDay(s.date, day.toISOString()))
      .reduce((acc, s) => acc + (s.total || 0), 0);
    const sumProd = production
      .filter(p => isSameDay(p.date, day.toISOString()))
      .reduce((acc, p) => acc + (p.quantity || 0), 0);
    out.push({ date: label, sales: sumSales, production: sumProd });
  }
  return out;
}

/**
 * Gross margin earned on a sale: sum over cart items of
 *   (sellingPrice − unitCost) × quantity.
 *
 * Looks up the product's `cost` by id; products missing from the map (or
 * with cost = 0) contribute 0 to the cost side, so the margin equals
 * revenue. UI should surface that as a warning so the owner knows the
 * margin is overstated.
 */
export function saleMargin(sale: Sale, productsById: Map<string, { cost: number }>): number {
  let margin = 0;
  for (const item of sale.items) {
    const cost = productsById.get(item.productId)?.cost ?? 0;
    margin += (item.price - cost) * item.quantity;
  }
  return margin;
}

/** Sum of margins across many sales. */
export function totalMargin(sales: Sale[], productsById: Map<string, { cost: number }>): number {
  return sales.reduce((sum, s) => sum + saleMargin(s, productsById), 0);
}

/**
 * Generic daily-series builder used by the StatCard sparklines.
 * Bucketizes items by day (oldest → newest) for the last `days` days
 * including today. Items without a parseable date are skipped.
 */
export function dailySeries<T>(
  items: T[],
  getDate: (item: T) => string,
  getValue: (item: T) => number,
  days = 14,
  now: Date = new Date(),
): number[] {
  const buckets = new Array(days).fill(0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const startMs = today.getTime() - (days - 1) * 86_400_000;
  for (const item of items) {
    const d = new Date(getDate(item));
    if (isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    const idx = Math.floor((d.getTime() - startMs) / 86_400_000);
    if (idx < 0 || idx >= days) continue;
    buckets[idx] += getValue(item) || 0;
  }
  return buckets;
}

export function top3Products(sales: Sale[]): Array<{ name: string; quantity: number }> {
  const totals = new Map<string, number>();
  for (const sale of sales) {
    for (const item of sale.items) {
      totals.set(item.productName, (totals.get(item.productName) ?? 0) + item.quantity);
    }
  }
  return [...totals.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3);
}
