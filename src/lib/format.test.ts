import { describe, expect, it } from 'vitest';
import {
  formatUZS, formatMoney, formatNumber, formatDate, daysBetween,
  percentChange, formatPercent,
} from './format';

// formatUZS deliberately uses non-breaking glyphs so big numbers don't wrap.
const NBSP = ' ';   // between "UZS" and the digits
const NNBSP = ' ';  // thousand-group separator (also used by formatNumber)

describe('formatUZS', () => {
  it('formats positive integers with thousands separators', () => {
    expect(formatUZS(1234567)).toBe(`UZS${NBSP}1${NNBSP}234${NNBSP}567`);
  });
  it('handles zero', () => {
    expect(formatUZS(0)).toBe(`UZS${NBSP}0`);
  });
  it('formats negative with Unicode minus', () => {
    expect(formatUZS(-1500)).toBe(`−UZS${NBSP}1${NNBSP}500`);
  });
  it('handles null / undefined / NaN', () => {
    expect(formatUZS(null)).toBe(`UZS${NBSP}0`);
    expect(formatUZS(undefined)).toBe(`UZS${NBSP}0`);
    expect(formatUZS(Number.NaN)).toBe(`UZS${NBSP}0`);
  });
});

describe('formatMoney', () => {
  it('delegates to formatUZS for UZS', () => {
    expect(formatMoney(1000, 'UZS')).toBe(`UZS${NBSP}1${NNBSP}000`);
  });
  it('uses Intl currency formatting for USD', () => {
    expect(formatMoney(1234.5, 'USD')).toContain('1,234.5');
  });
});

describe('formatNumber', () => {
  it('formats with ASCII thousand separators', () => {
    // formatNumber is the plain-text variant (no wrap protection needed).
    expect(formatNumber(1234567)).toBe('1 234 567');
  });
});

describe('formatDate', () => {
  it('returns YYYY-MM-DD', () => {
    expect(formatDate('2026-03-09T12:00:00Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('returns empty string on invalid input', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });
});

describe('daysBetween', () => {
  it('computes whole-day delta', () => {
    const a = '2026-03-01T00:00:00Z';
    const b = '2026-03-04T00:00:00Z';
    expect(daysBetween(a, b)).toBe(3);
  });
  it('never goes negative', () => {
    const a = '2026-03-04T00:00:00Z';
    const b = '2026-03-01T00:00:00Z';
    expect(daysBetween(a, b)).toBe(0);
  });
});

describe('percentChange + formatPercent', () => {
  it('returns 0 when current and previous are both 0', () => {
    expect(percentChange(0, 0)).toBe(0);
  });
  it('returns 100 when previous is 0 and current is non-zero', () => {
    expect(percentChange(50, 0)).toBe(100);
  });
  it('computes typical change', () => {
    expect(percentChange(120, 100)).toBeCloseTo(20);
    expect(percentChange(80, 100)).toBeCloseTo(-20);
  });
  it('formats percent with sign', () => {
    expect(formatPercent(12.34)).toBe('+12.3%');
    expect(formatPercent(-5)).toBe('-5.0%');
  });
});
