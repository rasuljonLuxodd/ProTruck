import type { Expense, ProductionLog, Sale, Worker } from '@/types';

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

export function workerPayoutDue(w: Worker): number {
  const base = (w.monthlySalary / 30) * w.workDays;
  return Math.max(0, base + w.bonus - w.penalty - w.advance);
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
