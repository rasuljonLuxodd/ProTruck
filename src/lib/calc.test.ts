import { describe, expect, it } from 'vitest';
import {
  actualCashIncome, expenseTotal, netProfit, workerPayoutDue,
  productionThisMonth, top3Products, monthKey, isSameDay, inMonth,
} from './calc';
import type { Sale, Expense, Worker, ProductionLog } from '@/types';

function sale(part: Partial<Sale>): Sale {
  return {
    id: 's', customerName: 'c', customerPhone: '',
    items: [], total: 0, paymentType: 'naqd',
    date: new Date().toISOString(),
    ...part,
  };
}

function exp(amount: number): Expense {
  return {
    id: 'e', category: 'Boshqa', description: '',
    amount, paymentType: 'naqd',
    date: new Date().toISOString(),
  };
}

describe('actualCashIncome', () => {
  it('counts naqd + karta in full', () => {
    expect(actualCashIncome([
      sale({ total: 100, paymentType: 'naqd' }),
      sale({ total: 200, paymentType: 'karta' }),
    ])).toBe(300);
  });
  it('counts only cashPart of aralash', () => {
    expect(actualCashIncome([
      sale({ total: 500, paymentType: 'aralash', cashPart: 300, debtPart: 200 }),
    ])).toBe(300);
  });
  it('counts qarz as zero', () => {
    expect(actualCashIncome([
      sale({ total: 1000, paymentType: 'qarz' }),
    ])).toBe(0);
  });
});

describe('expenseTotal + netProfit', () => {
  it('sums expenses', () => {
    expect(expenseTotal([exp(100), exp(200)])).toBe(300);
  });
  it('net profit = cash income - expenses', () => {
    expect(netProfit(
      [sale({ total: 1000, paymentType: 'naqd' })],
      [exp(400)],
    )).toBe(600);
  });
});

describe('workerPayoutDue', () => {
  it('proportional salary + bonus - penalty - advance', () => {
    const w: Worker = {
      id: 'w', name: 'x', monthlySalary: 3000000,
      workDays: 15, bonus: 100000, penalty: 50000, advance: 200000,
      paymentHistory: [],
    };
    // 3,000,000 / 30 * 15 = 1,500,000; + 100,000 - 50,000 - 200,000 = 1,350,000
    expect(workerPayoutDue(w)).toBe(1_350_000);
  });
  it('never returns negative', () => {
    const w: Worker = {
      id: 'w', name: 'x', monthlySalary: 100,
      workDays: 1, bonus: 0, penalty: 9999, advance: 0,
      paymentHistory: [],
    };
    expect(workerPayoutDue(w)).toBe(0);
  });
});

describe('productionThisMonth', () => {
  it('sums quantities for current month only', () => {
    const now = new Date();
    const thisMonth: ProductionLog = {
      id: '1', productId: 'p', quantity: 10,
      date: new Date(now.getFullYear(), now.getMonth(), 5).toISOString(),
    };
    const lastMonth: ProductionLog = {
      id: '2', productId: 'p', quantity: 50,
      date: new Date(now.getFullYear(), now.getMonth() - 1, 5).toISOString(),
    };
    expect(productionThisMonth([thisMonth, lastMonth], now)).toBe(10);
  });
});

describe('top3Products', () => {
  it('returns the 3 best-selling items by quantity', () => {
    const s: Sale[] = [
      sale({ items: [{ productId: 'a', productName: 'A', quantity: 5, price: 1 }] }),
      sale({ items: [{ productId: 'b', productName: 'B', quantity: 10, price: 1 }] }),
      sale({ items: [{ productId: 'a', productName: 'A', quantity: 3, price: 1 }] }),
      sale({ items: [{ productId: 'c', productName: 'C', quantity: 1, price: 1 }] }),
      sale({ items: [{ productId: 'd', productName: 'D', quantity: 7, price: 1 }] }),
    ];
    expect(top3Products(s)).toEqual([
      { name: 'B', quantity: 10 },
      { name: 'A', quantity: 8 },
      { name: 'D', quantity: 7 },
    ]);
  });
});

describe('helpers', () => {
  it('monthKey returns YYYY-MM', () => {
    expect(monthKey('2026-04-15T00:00:00Z')).toBe('2026-04');
  });
  it('isSameDay handles same day in different times', () => {
    // Use local-time constructors to avoid TZ differences between dev / CI.
    const morning = new Date(2026, 4, 26, 9, 0, 0).toISOString();
    const evening = new Date(2026, 4, 26, 20, 30, 0).toISOString();
    const nextDay = new Date(2026, 4, 27, 0, 1, 0).toISOString();
    expect(isSameDay(morning, evening)).toBe(true);
    expect(isSameDay(morning, nextDay)).toBe(false);
  });
  it('inMonth picks the right rows', () => {
    expect(inMonth('2026-05-15T00:00:00Z', 2026, 4)).toBe(true);
    expect(inMonth('2026-06-15T00:00:00Z', 2026, 4)).toBe(false);
  });
});
