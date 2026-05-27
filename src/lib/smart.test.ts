import { describe, expect, it } from 'vitest';
import {
  suggestExpenseCategory,
  computeReorderHints,
  detectAnomalies,
} from './smart';
import type { Expense, Product, Sale } from '@/types';

function exp(part: Partial<Expense>): Expense {
  return {
    id: 'e', category: 'Boshqa', description: '', amount: 0,
    paymentType: 'naqd', date: new Date().toISOString(),
    ...part,
  };
}
function product(part: Partial<Product>): Product {
  return {
    id: 'p', name: 'X', stock: 0, minStock: 10, vatRate: 0, cost: 0,
    createdAt: '', lastUpdated: '',
    ...part,
  };
}
function sale(part: Partial<Sale>): Sale {
  return {
    id: 's', customerName: 'C', customerPhone: '',
    items: [], total: 0, paymentType: 'naqd',
    date: new Date().toISOString(),
    ...part,
  };
}

describe('suggestExpenseCategory', () => {
  const history: Expense[] = [
    exp({ description: "Elektr to'lovi", category: 'Elektr' }),
    exp({ description: 'Elektr energiya', category: 'Elektr' }),
    exp({ description: 'Ijara mart', category: 'Ijara' }),
    exp({ description: 'Sement xom ashyo', category: 'Xom ashyo' }),
  ];

  it('matches similar descriptions', () => {
    expect(suggestExpenseCategory("Elektr to'lovi aprel", history)).toBe('Elektr');
  });

  it('matches even when one word changes', () => {
    expect(suggestExpenseCategory('Ijara aprel', history)).toBe('Ijara');
  });

  it('returns null when nothing similar', () => {
    expect(suggestExpenseCategory('Unrelated thing', history)).toBeNull();
  });

  it('returns null on short input', () => {
    expect(suggestExpenseCategory('Ij', history)).toBeNull();
  });
});

describe('computeReorderHints', () => {
  const now = new Date(2026, 4, 27); // May 27, 2026

  it('flags a fast-moving product running out within the window', () => {
    const p = product({ id: 'a', name: 'Brick', stock: 50 });
    // 28 units sold in last 28 days = 7/week → 50 units = 50 days. Not urgent yet.
    const sales: Sale[] = [
      sale({
        date: new Date(2026, 4, 20).toISOString(),
        items: [{ productId: 'a', productName: 'Brick', quantity: 28, price: 1 }],
      }),
    ];
    const hints = computeReorderHints([p], sales, { now });
    // 50 days > 7-day window → no hint
    expect(hints).toEqual([]);
  });

  it('flags when stockout is imminent', () => {
    // 14 units sold over 28 days = 3.5/wk velocity; stock=1 → 2 days → high
    const p = product({ id: 'a', name: 'Brick', stock: 1 });
    const sales: Sale[] = [
      sale({
        date: new Date(2026, 4, 25).toISOString(),
        items: [{ productId: 'a', productName: 'Brick', quantity: 14, price: 1 }],
      }),
    ];
    const hints = computeReorderHints([p], sales, { now });
    expect(hints).toHaveLength(1);
    expect(hints[0].productId).toBe('a');
    expect(hints[0].urgency).toBe('high');
  });

  it('skips products with no recent sales', () => {
    const p = product({ id: 'a', name: 'Brick', stock: 0 });
    expect(computeReorderHints([p], [], { now })).toEqual([]);
  });
});

describe('detectAnomalies', () => {
  const now = new Date(2026, 4, 27, 12, 0, 0);

  it('flags two identical expenses within 5 minutes', () => {
    const expenses: Expense[] = [
      exp({ description: 'Elektr', amount: 500_000, date: new Date(2026, 4, 27, 10, 0, 0).toISOString() }),
      exp({ description: 'Elektr', amount: 500_000, date: new Date(2026, 4, 27, 10, 2, 0).toISOString() }),
    ];
    const anomalies = detectAnomalies(expenses, [], now);
    expect(anomalies.some(a => a.type === 'duplicate_expense')).toBe(true);
  });

  it('flags expense >3x average', () => {
    const expenses: Expense[] = [
      exp({ amount: 100_000, date: new Date(2026, 4, 20).toISOString() }),
      exp({ amount: 100_000, date: new Date(2026, 4, 21).toISOString() }),
      exp({ amount: 100_000, date: new Date(2026, 4, 22).toISOString() }),
      exp({ amount: 100_000, date: new Date(2026, 4, 23).toISOString() }),
      exp({ amount: 100_000, date: new Date(2026, 4, 24).toISOString() }),
      // 100k average, 800k = 8x — should fire
      exp({ description: 'Suspicious large', amount: 800_000, date: new Date(2026, 4, 25).toISOString() }),
    ];
    const anomalies = detectAnomalies(expenses, [], now);
    expect(anomalies.some(a => a.type === 'large_expense')).toBe(true);
  });

  it('returns empty when nothing is suspicious', () => {
    const expenses: Expense[] = [
      exp({ amount: 100_000, date: new Date(2026, 4, 20).toISOString() }),
      exp({ amount: 110_000, date: new Date(2026, 4, 21).toISOString() }),
    ];
    expect(detectAnomalies(expenses, [], now)).toEqual([]);
  });
});
