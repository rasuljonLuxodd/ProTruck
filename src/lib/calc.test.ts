import { describe, expect, it } from 'vitest';
import {
  actualCashIncome, expenseTotal, netProfit, workerPayoutDue,
  productionThisMonth, top3Products, monthKey, isSameDay, inMonth,
  daysInMonth, outstandingDebt,
} from './calc';
import type { Sale, Expense, Worker, ProductionLog, Debt } from '@/types';

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

describe('daysInMonth', () => {
  it('returns 31 for Jan / 28 for Feb (non-leap) / 29 for Feb (leap)', () => {
    expect(daysInMonth(2026, 0)).toBe(31);
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2024, 1)).toBe(29); // leap year
    expect(daysInMonth(2026, 3)).toBe(30); // April
  });
});

describe('workerPayoutDue', () => {
  it('proportional salary + bonus - penalty - advance (pinned to a 30-day month)', () => {
    const w: Worker = {
      id: 'w', name: 'x', monthlySalary: 3_000_000,
      workDays: 15, bonus: 100_000, penalty: 50_000, advance: 200_000,
      paymentHistory: [],
    };
    // April has 30 days. 3,000,000 / 30 * 15 = 1,500,000; + 100k − 50k − 200k = 1,350,000
    const april = new Date(2026, 3, 15);
    expect(workerPayoutDue(w, april)).toBe(1_350_000);
  });

  it('uses actual days for February (28 in 2026)', () => {
    const w: Worker = {
      id: 'w', name: 'x', monthlySalary: 2_800_000,
      workDays: 14, bonus: 0, penalty: 0, advance: 0,
      paymentHistory: [],
    };
    // Feb 2026 = 28 days. 2,800,000 / 28 * 14 = 1,400,000
    const feb = new Date(2026, 1, 15);
    expect(workerPayoutDue(w, feb)).toBe(1_400_000);
  });

  it('returns signed value when overpaid (advance > earnings)', () => {
    const w: Worker = {
      id: 'w', name: 'x', monthlySalary: 100,
      workDays: 1, bonus: 0, penalty: 9_999, advance: 0,
      paymentHistory: [],
    };
    // Negative result surfaces that the worker is in the red — no silent clamping.
    const may = new Date(2026, 4, 15); // 31 days
    const expected = 100 / 31 - 9_999;
    expect(workerPayoutDue(w, may)).toBeCloseTo(expected);
  });

  it('clamps workDays > daysInMonth so Feb does not get a 31-day bonus', () => {
    const w: Worker = {
      id: 'w', name: 'x', monthlySalary: 2_800_000,
      workDays: 31, bonus: 0, penalty: 0, advance: 0,
      paymentHistory: [],
    };
    const feb = new Date(2026, 1, 15);
    // Should treat as 28/28, not (2.8M/28)*31 which would overpay.
    expect(workerPayoutDue(w, feb)).toBe(2_800_000);
  });
});

describe('outstandingDebt', () => {
  it('sums remaining balances from debts table', () => {
    const debts: Debt[] = [
      { id: '1', customerName: 'A', customerPhone: '', product: 'x',
        amount: 5_000, originalAmount: 10_000, date: '', payments: [] },
      { id: '2', customerName: 'B', customerPhone: '', product: 'y',
        amount: 3_000, originalAmount: 3_000, date: '', payments: [] },
    ];
    expect(outstandingDebt(debts)).toBe(8_000);
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
