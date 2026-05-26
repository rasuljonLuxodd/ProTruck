import { describe, expect, it } from 'vitest';
import { buildCsv, parseCsv } from './csv';

describe('buildCsv', () => {
  it('escapes commas, quotes, newlines', () => {
    const csv = buildCsv(
      [{ a: 'plain', b: 'with,comma' }, { a: 'has "quote"', b: 'line\nbreak' }],
      [{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }],
    );
    expect(csv).toContain('"with,comma"');
    expect(csv).toContain('"has ""quote"""');
    expect(csv).toContain('"line\nbreak"');
  });

  it('supports custom render', () => {
    const csv = buildCsv(
      [{ x: 5 }],
      [{ key: 'x', header: 'X', render: r => `${r.x * 2}` }],
    );
    expect(csv.split('\n')[1]).toBe('10');
  });
});

describe('parseCsv', () => {
  it('parses basic rows', () => {
    const text = 'a,b,c\n1,2,3\n4,5,6';
    expect(parseCsv(text)).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ]);
  });
  it('strips BOM and handles quoted fields with commas', () => {
    const text = '﻿name,note\n"Smith, Inc","hi, there"';
    expect(parseCsv(text)).toEqual([{ name: 'Smith, Inc', note: 'hi, there' }]);
  });
  it('handles escaped double quotes', () => {
    const text = 'q\n"He said ""hi"""';
    expect(parseCsv(text)).toEqual([{ q: 'He said "hi"' }]);
  });
  it('ignores blank trailing rows', () => {
    expect(parseCsv('a\nfoo\n\n')).toEqual([{ a: 'foo' }]);
  });
});
